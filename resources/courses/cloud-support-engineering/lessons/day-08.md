---
title: Python for Support Engineering
summary: Not application Python. The other Python — parsing logs, calling APIs, filtering data, and writing the small scripts that answer a question nobody built a dashboard for.
minutes: 110
objectives:
  - Parse both plain-text and JSON-structured log files with the standard library
  - Call an HTTP API with requests, handle errors properly, and page through results
  - Write a small CLI script with argparse that a colleague could run
  - Use pathlib, collections.Counter and csv for everyday data wrangling
  - Explain why support Python is a different discipline from application Python
keyTerms:
  - term: Standard library
    definition: The modules shipped with Python itself. On a locked-down production host it may be all you have, which is why knowing it matters.
  - term: Generator
    definition: A function using yield that produces values lazily. Lets you stream a 4 GB log file without loading it into memory.
  - term: requests.Session
    definition: A reusable HTTP client that keeps connections alive and carries shared headers — noticeably faster for repeated calls to one host.
  - term: Exponential backoff
    definition: Retrying a failed request after progressively longer waits, so a struggling service is not hammered further.
  - term: argparse
    definition: The standard-library command-line argument parser. Turns a script into a tool with --help.
resources:
  - label: Python docs — pathlib
    url: https://docs.python.org/3/library/pathlib.html
  - label: Requests documentation
    url: https://requests.readthedocs.io/
  - label: Python docs — collections
    url: https://docs.python.org/3/library/collections.html
  - label: Real Python — logging
    url: https://realpython.com/python-logging/
---

There are two Pythons. One builds applications: classes, frameworks, dependency injection, test pyramids. The other answers questions: *how many 500s did we serve yesterday, grouped by endpoint, and which customer IDs were affected?*

The second one is a genuinely different discipline, and it is the one a support engineer needs. The scripts are short, disposable, often run once. They must work on a machine where you cannot `pip install` whatever you like. Treating this as its own skill — rather than a degraded form of "real" Python — is the point of today.

:::hint{type=tip}
Bias hard toward the **standard library**. On a jump box, in a container, or over an SSH session into a locked-down VM, `requests` may not be installed and you may not be allowed to install it. `urllib.request`, `json`, `csv`, `re`, `collections` and `pathlib` are always there.
:::

## Reading log files without running out of memory

The naive version:

```python title="dont-do-this.py"
with open("app.log") as f:
    lines = f.readlines()      # a 4 GB file is now 4 GB of RAM
```

The version that works on a production log:

```python title="stream.py"
from pathlib import Path

def read_lines(path: Path):
    """Yield lines one at a time. Memory usage stays flat regardless of file size."""
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            yield line.rstrip("\n")

for line in read_lines(Path("app.log")):
    if "ERROR" in line:
        print(line)
```

Two details that matter in practice:

- `errors="replace"` — production logs contain broken bytes. A `UnicodeDecodeError` halfway through a 4 GB file, after eight minutes, is infuriating.
- Iterating the file object directly is a generator. It never holds more than one line.

### Parsing semi-structured lines

```python title="parse_plain.py"
import re
from collections import Counter
from pathlib import Path

# 2026-08-06T14:22:01Z  ERROR  [payments] customer=29825 code=GATEWAY_TIMEOUT latency_ms=30012
LINE = re.compile(
    r"^(?P<ts>\S+)\s+"
    r"(?P<level>[A-Z]+)\s+"
    r"\[(?P<component>[^\]]+)\]\s+"
    r"(?P<rest>.*)$"
)
KV = re.compile(r"(\w+)=([^\s]+)")

def parse(line: str) -> dict | None:
    m = LINE.match(line)
    if not m:
        return None                     # malformed lines are data too — count them
    record = m.groupdict()
    record.update(dict(KV.findall(record.pop("rest"))))
    return record

def main(path: str) -> None:
    codes = Counter()
    customers = Counter()
    unparsed = 0

    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        record = parse(line)
        if record is None:
            unparsed += 1
            continue
        if record["level"] == "ERROR":
            codes[record.get("code", "UNKNOWN")] += 1
            customers[record.get("customer", "UNKNOWN")] += 1

    print(f"Unparsed lines: {unparsed}")
    print("\nTop error codes:")
    for code, count in codes.most_common(10):
        print(f"  {count:>6}  {code}")
    print("\nTop affected customers:")
    for customer, count in customers.most_common(10):
        print(f"  {count:>6}  {customer}")

if __name__ == "__main__":
    import sys
    main(sys.argv[1])
```

:::hint{type=warning}
Always count the lines you *failed* to parse. A script that silently skips 40% of a log will confidently report that everything is fine. Unparsed-line count is the first number I look at in anyone's log-analysis output.
:::

### Parsing JSON logs

Modern services emit one JSON object per line — "JSON Lines". Much easier, and the format you will encounter in CloudWatch and Log Analytics.

```python title="parse_jsonl.py"
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

def load(path: Path):
    with path.open(encoding="utf-8", errors="replace") as f:
        for lineno, raw in enumerate(f, 1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield json.loads(raw)
            except json.JSONDecodeError as exc:
                print(f"  ! line {lineno}: {exc.msg}")

def errors_in_last_hours(path: Path, hours: int = 24) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    by_hour: dict[str, Counter] = defaultdict(Counter)

    for event in load(path):
        if event.get("level") != "ERROR":
            continue
        ts = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
        if ts < cutoff:
            continue
        by_hour[ts.strftime("%Y-%m-%d %H:00")][event.get("error_code", "UNKNOWN")] += 1

    for hour in sorted(by_hour):
        total = sum(by_hour[hour].values())
        top = ", ".join(f"{c}={n}" for c, n in by_hour[hour].most_common(3))
        print(f"{hour}  total={total:<5}  {top}")
```

Notice the shape of the output: a time series with the top contributors per bucket. That is what makes a log analysis *useful* rather than merely correct — you can see when it started and what dominates.

```quiz
question: Why does a support script iterate a log file line by line rather than calling readlines()?
options:
  - readlines() is deprecated in Python 3
  - Iterating is the only way to handle encoding errors
  - readlines() loads the whole file into memory, which fails on large production logs
  - Iterating automatically parses JSON
answer: 2
explanation: readlines() materialises every line as a list in memory. Production logs are routinely gigabytes; iterating the file object streams it with flat memory use.
```

## Calling an API

```python title="api_client.py"
import time
import requests

BASE = "https://api.example.com/v1"

def make_session(token: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "support-tools/1.0",
    })
    return session

def get_json(session: requests.Session, path: str, **params) -> dict:
    """GET with a timeout, retries on transient failures, and useful errors."""
    for attempt in range(4):
        try:
            response = session.get(f"{BASE}{path}", params=params, timeout=10)
        except requests.Timeout:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
            continue

        if response.status_code == 429:                      # rate limited
            wait = int(response.headers.get("Retry-After", 2 ** attempt))
            time.sleep(wait)
            continue

        if 500 <= response.status_code < 600 and attempt < 3:
            time.sleep(2 ** attempt)
            continue

        response.raise_for_status()
        return response.json()

    raise RuntimeError(f"GET {path} failed after 4 attempts")
```

:::hint{type=danger}
**Always pass `timeout=`.** `requests` has no default timeout. A call to a hung service will block forever — and your "quick diagnostic script" becomes the thing someone has to kill. This is the most common bug in scripts written by people who are otherwise good at Python.
:::

Three more things this snippet does that a naive version would not:

- **Honours `Retry-After`** on a 429 instead of guessing.
- **Retries 5xx but not 4xx.** A 404 will still be a 404 on the fourth try; retrying it just wastes time and muddies the logs.
- **Uses a `Session`**, so the TCP connection is reused across calls.

### Pagination

```python title="paginate.py"
def iter_all(session, path: str, **params):
    """Yield every item across all pages. Cursor-style; adapt to your API."""
    cursor = None
    while True:
        page = get_json(session, path, cursor=cursor, limit=100, **params)
        yield from page["items"]
        cursor = page.get("next_cursor")
        if not cursor:
            return

# Usage stays simple even though paging is happening underneath
for ticket in iter_all(session, "/tickets", status="open"):
    print(ticket["id"], ticket["subject"])
```

Wrapping pagination in a generator is the single best ergonomic improvement you can make to an API script. The caller writes a plain `for` loop.

## Making it a tool

A script becomes useful to other people the moment it has `--help`.

```python title="log_report.py"
#!/usr/bin/env python3
"""Summarise errors in a JSON-lines application log."""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("logfile", type=Path, help="path to a .jsonl log file")
    parser.add_argument("--level", default="ERROR", help="log level to report on")
    parser.add_argument("--top", type=int, default=10, help="how many rows to show")
    parser.add_argument("--customer", help="restrict to one customer id")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    return parser

def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if not args.logfile.exists():
        print(f"error: {args.logfile} does not exist", file=sys.stderr)
        return 2

    counts: Counter[str] = Counter()
    with args.logfile.open(encoding="utf-8", errors="replace") as f:
        for raw in f:
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if event.get("level") != args.level:
                continue
            if args.customer and str(event.get("customer_id")) != args.customer:
                continue
            counts[event.get("error_code", "UNKNOWN")] += 1

    if args.json:
        json.dump(dict(counts.most_common(args.top)), sys.stdout, indent=2)
        print()
    else:
        width = max((len(c) for c, _ in counts.most_common(args.top)), default=10)
        for code, n in counts.most_common(args.top):
            print(f"{code:<{width}}  {n:>6}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

Four conventions in there that are worth adopting permanently:

1. **Return an exit code.** `0` success, non-zero failure. This is what makes a script usable in a pipeline or a `git bisect run`.
2. **Errors to `stderr`, data to `stdout`.** So `./log_report.py x.jsonl > out.txt` captures data and still shows you errors.
3. **A `--json` flag.** Human-readable by default, machine-readable on request.
4. **`main(argv)` taking arguments**, so it is testable without a subprocess.

## Everyday standard-library tools

```python title="toolbox.py"
from collections import Counter, defaultdict
from pathlib import Path
import csv, json, itertools

# Frequency counts — the workhorse
Counter(["a", "b", "a"]).most_common()        # [('a', 2), ('b', 1)]

# Grouping without KeyError dances
by_customer = defaultdict(list)
by_customer[29825].append("order-1")

# Paths that work on Windows and Linux without string surgery
for path in Path("logs").rglob("*.jsonl"):
    print(path.stem, path.stat().st_size)

# CSV in and out — DictReader gives you named columns
with open("tickets.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

with open("out.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["id", "status", "count"])
    writer.writeheader()
    writer.writerows(rows)

# Chunking an iterable — for batched API calls
def chunks(iterable, size):
    it = iter(iterable)
    while batch := list(itertools.islice(it, size)):
        yield batch
```

:::hint{type=tip}
`newline=""` in the `csv` calls is not optional on Windows. Omit it and every row gets a blank line between it and the next. It is the single most-Googled Python CSV problem.
:::

## Talking to Azure SQL from Python

This ties Week 1 to Week 2, and previews the Week 5 project.

```python title="query_azure_sql.py"
import os
import pyodbc     # pip install pyodbc

CONN = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=tcp:yourserver.database.windows.net,1433;"
    "DATABASE=supportlab;"
    f"UID={os.environ['SQL_USER']};"
    f"PWD={os.environ['SQL_PASSWORD']};"
    "Encrypt=yes;"                       # mandatory for Azure SQL, and the default in driver 18
    "TrustServerCertificate=no;"         # verify the certificate — this is a real endpoint
    "Connection Timeout=60;"             # long enough to survive a serverless resume
)

SQL = """
SELECT   TOP (?) t.FailureCode, COUNT(*) AS Occurrences
FROM     dbo.Transactions AS t
WHERE    t.CustomerId    = ?
  AND    t.CreatedAtUtc >= DATEADD(DAY, -?, SYSUTCDATETIME())
GROUP BY t.FailureCode
ORDER BY Occurrences DESC;
"""

customer_id = 1   # resolve this from the ticket; never hard-code it in real work

with pyodbc.connect(CONN) as conn:
    cursor = conn.cursor()
    for code, count in cursor.execute(SQL, 10, customer_id, 7):
        print(f"{code:<20} {count}")
```

:::hint{type=warning}
Three Azure-specific details in that connection string, all of which produce confusing failures if you get them wrong:

- **`Encrypt=yes`** is required. ODBC Driver 18 defaults to it; driver 17 did not, which is why an old script that worked locally fails against Azure with a TLS error.
- **`TrustServerCertificate=no`** is correct here. Tutorials tell you to set it to `yes` — that is advice for a self-signed local certificate, and copying it to a cloud endpoint disables the check that would catch an interception.
- **A short connection timeout will bite you.** If the database has auto-paused, the first connection has to wait for a resume. The default 15 seconds is often not enough, and the resulting error says nothing about pausing.
:::

:::hint{type=danger}
Note the `?` placeholders. **Never** build SQL by string formatting user input — `f"WHERE CustomerId = {customer_id}"` is a SQL injection waiting to happen, even in an internal script. Parameterised queries are also faster, because SQL Server can reuse the cached plan.
:::

## Exercise

:::checklist{title="Day 8 checklist"}
- [ ] Generate a synthetic log file of 100,000 JSON-lines events with a small script
- [ ] Write a parser that reports the top 10 error codes and counts unparsed lines
- [ ] Extend it into a proper CLI with `argparse`, including `--help` and `--json`
- [ ] Confirm it returns exit code 0 on success and 2 on a missing file
- [ ] Call a public API (`https://api.github.com/repos/python/cpython` works) with `requests`, with a timeout
- [ ] Add retry-with-backoff and verify it by pointing at a URL that 500s
- [ ] Write a paginating generator against any paged public API
- [ ] Read a CSV with `DictReader`, filter it, and write the result back out
- [ ] Connect to your SQL Server from Python with a parameterised query
- [ ] Commit all of it to `python/scripts/` via a pull request
:::

:::details{summary="Generating a synthetic log to practise on"}
```python
import json, random
from datetime import datetime, timedelta, timezone

CODES = ["GATEWAY_TIMEOUT", "INVALID_CARD", "INSUFFICIENT_FUNDS", "RATE_LIMITED"]
LEVELS = ["INFO"] * 90 + ["WARN"] * 7 + ["ERROR"] * 3
start = datetime.now(timezone.utc) - timedelta(days=2)

with open("app.jsonl", "w", encoding="utf-8") as f:
    for i in range(100_000):
        level = random.choice(LEVELS)
        event = {
            "timestamp": (start + timedelta(seconds=i * 1.7)).isoformat().replace("+00:00", "Z"),
            "level": level,
            "component": random.choice(["payments", "auth", "ingest"]),
            "customer_id": random.randint(1000, 1050),
            "message": "request completed",
        }
        if level == "ERROR":
            event["error_code"] = random.choice(CODES)
        f.write(json.dumps(event) + "\n")
        if random.random() < 0.001:
            f.write("this line is not json\n")     # realism
```
:::

## Where this is going

Tomorrow: JSON Schema. Your log parser currently assumes fields exist. Schemas are how you turn that assumption into an enforced, testable contract — and how you explain to a customer that *their* payload is the problem.
