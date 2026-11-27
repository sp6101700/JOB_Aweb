# Kestrel Logistics – IT Operations & Helpdesk Automation Portal

Files: `index.html`, `style.css`, `script.js` (website) · `employees_sample.xlsx` (10 new employees) · `producer.py`, `consumer.py`, `requirements.txt` (RabbitMQ side).

## 1. Run the website locally
1. Keep all files in one folder.
2. Double-click `index.html` (or run `python -m http.server 8080` in the folder and open http://localhost:8080).
3. An internet connection is needed once per page load: SheetJS (Excel support) loads from cdnjs.
   For offline use, download `xlsx.full.min.js` (SheetJS 0.18.5), put it in the folder and change the `<script src>` in `index.html`.

Demo data lives in your browser's localStorage; the sidebar button "Reset demo data" restores the 10 starter employees.

Quick demo: Employees → Upload Excel → choose `employees_sample.xlsx` → Import → Automation Control → **Process All Employees** → Automation Logs / Reports → Download Excel.

## 2. What is real and what is simulated
| Part | Status |
|---|---|
| Employee CRUD, 5 modules, logs, reports, Excel import/export, localStorage | Real, works in the browser |
| "Start Automation" / "Process All Employees" | **Local browser simulation** of the rules (login ID = first initial + last name, etc.) |
| Python, RabbitMQ, Agentix | **Not connected from the page.** The page only exchanges Excel files with them |

## 3. Connect Python + RabbitMQ
```
Website → Excel (employees_input.xlsx) → producer.py → RabbitMQ queue → consumer.py → output/automation_results.xlsx → Website
```
1. Start RabbitMQ: `docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management` (UI: http://localhost:15672, guest/guest).
2. `pip install -r requirements.txt`
3. Website → Automation Control → **Export producer input** → save `employees_input.xlsx` beside `producer.py`.
4. `python producer.py` — publishes one persistent message per employee to queue `kestrel.employee.jobs` (invalid rows are skipped and printed).
5. `python consumer.py` — processes ALL messages, acks each after success, stops when the queue is idle for 10 s, writes `output/automation_results.xlsx`.
6. Website → Automation Control → **Import consumer output Excel** → results appear in Login IDs, Accounts and Logs (type "Python Consumer Result").

Settings via environment variables: `RABBITMQ_URL`, `QUEUE_NAME`, `OUTPUT_FILE`, `IDLE_SECONDS`.
The consumer covers login IDs and account status. Access requests, resets and tickets are extended the same way (add a `task` field to the message and a handler in `process`).
I could not run RabbitMQ in my environment, so the Python scripts are syntax-checked and the processing function was tried locally, but not tested against a live broker.

## 4. Connect Agentix workflows
I cannot verify Agentix's exact node/step names, so map these steps to whatever your Agentix version offers:
1. **Trigger**: manual or file-arrival on `employees_input.xlsx`.
2. **Read Excel**: loop over every row (do not stop at the first one).
3. **Run Python / command step**: either call `python producer.py` once, or publish per row yourself.
4. **Run Python step**: `python consumer.py` (or let it run as a service).
5. **Read** `output/automation_results.xlsx`; optionally write status back to your own Excel report.
6. Upload/import that file in the website to see results.

If Agentix drives the browser instead (UI automation), the useful selectors are the `data-act` attributes (e.g. `[data-act="procAll"]`, `[data-act="exportProducer"]`) and the file input `#fileIn`.
