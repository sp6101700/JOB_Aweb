"""Kestrel – RabbitMQ PRODUCER.
Reads employees_input.xlsx (exported from the portal) and publishes ONE message per employee."""
import json, os, re, sys
import pika
from openpyxl import load_workbook

URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
QUEUE = os.getenv("QUEUE_NAME", "kestrel.employee.jobs")
SRC = sys.argv[1] if len(sys.argv) > 1 else "employees_input.xlsx"
KEYS = {"employeeid": "id", "firstname": "first", "lastname": "last", "email": "email", "department": "dept",
        "designation": "desig", "joiningdate": "joined", "requesttype": "reqType", "status": "status"}
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def read_employees(path):
    ws = load_workbook(path, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    head = [KEYS.get(re.sub(r"[^a-z]", "", str(h or "").lower())) for h in next(rows)]
    for r in rows:
        if not any(r):
            continue
        e = {k: ("" if v is None else (v.date().isoformat() if hasattr(v, "date") else str(v).strip()))
             for k, v in zip(head, r) if k}
        yield e

def main():
    sent = skipped = 0
    conn = pika.BlockingConnection(pika.URLParameters(URL))   # raises if RabbitMQ is not reachable
    ch = conn.channel()
    ch.queue_declare(queue=QUEUE, durable=True)
    ch.confirm_delivery()                                      # broker confirms each publish
    for e in read_employees(SRC):
        if not (e.get("id") and e.get("first") and e.get("last") and EMAIL.match(e.get("email", ""))):
            print("SKIPPED invalid row:", e); skipped += 1; continue
        ch.basic_publish("", QUEUE, json.dumps(e).encode(),
                         pika.BasicProperties(delivery_mode=2, content_type="application/json"))
        sent += 1
    conn.close()
    print(f"Published {sent} messages to '{QUEUE}' ({skipped} skipped)")

if __name__ == "__main__":
    main()
