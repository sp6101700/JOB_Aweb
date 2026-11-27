"""Kestrel – RabbitMQ CONSUMER + automation processing.
Creates a login ID and a dummy account per employee message and writes output/automation_results.xlsx,
which you then import in the portal (Automation Control → Import consumer output Excel)."""
import json, os, re, secrets, string
import pika
from openpyxl import Workbook

URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
QUEUE = os.getenv("QUEUE_NAME", "kestrel.employee.jobs")
OUT = os.getenv("OUTPUT_FILE", "output/automation_results.xlsx")
IDLE = int(os.getenv("IDLE_SECONDS", "10"))     # stop after the queue has been empty this long
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
taken, results = set(), []

def temp_password():
    pools = [string.ascii_uppercase, string.ascii_lowercase, string.digits, "!@#$%&*"]
    chars = [secrets.choice(p) for p in pools] + [secrets.choice("".join(pools)) for _ in range(8)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)

def login_id(e):
    c = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    base = c(e["first"])[:1] + c(e["last"])
    if len(base) < 2:
        return ""
    l, n = base, 1
    while l in taken:
        n += 1; l = f"{base}{n}"
    taken.add(l)
    return l

def process(e):
    err, login = "", login_id(e)
    if not login:                              err = "Cannot derive login ID from name"
    elif not EMAIL.match(e.get("email", "")):  err = "Invalid email address"
    elif e.get("status") == "Inactive":        err = "Employee is Inactive"
    return [e["id"], f'{e["first"]} {e["last"]}', login, "Failed" if err else "Success",
            "" if err else temp_password(), err]

def write():
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    wb = Workbook(); ws = wb.active; ws.title = "Automation Results"
    ws.append(["Employee ID", "Employee Name", "Login ID", "Account Status", "Temp Password", "Error Message"])
    for r in results: ws.append(r)
    wb.save(OUT); print(f"Wrote {len(results)} results to {OUT}")

def main():
    conn = pika.BlockingConnection(pika.URLParameters(URL))
    ch = conn.channel()
    ch.queue_declare(queue=QUEUE, durable=True)
    ch.basic_qos(prefetch_count=1)
    for method, _, body in ch.consume(QUEUE, inactivity_timeout=IDLE):
        if method is None:                     # queue idle -> finish
            break
        try:
            results.append(process(json.loads(body)))
            ch.basic_ack(method.delivery_tag)  # ack only after successful processing
        except Exception as ex:                # bad message: do not requeue forever
            print("Bad message:", ex); ch.basic_nack(method.delivery_tag, requeue=False)
    ch.cancel(); conn.close(); write()

if __name__ == "__main__":
    main()
