---
title: "Build: Schema & Ingestion"
summary: Where the T-SQL, Python and JSON Schema work converge. Migrations, a validating ingestion endpoint, race-free idempotency, and the tests that prove it.
minutes: 140
objectives:
  - Apply database migrations in a repeatable, versioned way
  - Build an ingestion endpoint that validates, persists and is idempotent
  - Capture rejected payloads with field-level error detail
  - Write integration tests against a containerised SQL Server
  - Handle database failures without leaking internals to the caller
keyTerms:
  - term: Migration
    definition: A versioned, ordered script that moves the schema from one state to the next. Applied automatically and recorded so it runs once.
  - term: Connection pool
    definition: A set of reusable database connections. Opening a connection is expensive; pooling amortises that across requests.
  - term: Parameterised query
    definition: SQL with placeholders bound separately from values. Prevents injection and allows plan reuse.
  - term: Transaction
    definition: A unit of work that either fully commits or fully rolls back.
  - term: Integration test
    definition: A test exercising real components together — here, the API against a real SQL Server in a container.
resources:
  - label: FastAPI documentation
    url: https://fastapi.tiangolo.com/
  - label: pyodbc wiki
    url: https://github.com/mkleehammer/pyodbc/wiki
  - label: testcontainers-python
    url: https://testcontainers-python.readthedocs.io/
---

Build day one. Everything from Weeks 1 and 2 converges here: T-SQL schema design, parameterised access from Python, and JSON Schema as an enforced contract.

## Project layout

```text
support-tool/
├── compose.yaml
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
├── schemas/v1/ticket.schema.json
├── sql/migrations/
│   ├── 001_create_schema.sql
│   ├── 002_create_tickets.sql
│   └── 003_create_rejected.sql
├── src/
│   ├── __init__.py
│   ├── main.py            # FastAPI app and routes
│   ├── config.py          # settings from the environment
│   ├── db.py              # connection pool and queries
│   ├── models.py          # request/response models
│   ├── validation.py      # JSON Schema validation
│   ├── logging_setup.py   # Day 18's JsonFormatter
│   └── migrate.py         # migration runner
└── tests/
    ├── conftest.py
    ├── test_validation.py
    ├── test_ingest.py
    └── test_idempotency.py
```

## Migrations

Do not apply schema changes by hand. Even a small project benefits from ordered, recorded migrations.

```python title="src/migrate.py"
"""Apply SQL migrations in order, exactly once each."""
import logging
from pathlib import Path

import pyodbc

from .config import settings

log = logging.getLogger(__name__)

BOOTSTRAP = """
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SchemaMigrations')
CREATE TABLE dbo.SchemaMigrations (
    Filename    NVARCHAR(255) NOT NULL PRIMARY KEY,
    AppliedAtUtc DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
"""


def apply_migrations(connection_string: str, directory: Path) -> int:
    applied = 0
    with pyodbc.connect(connection_string, autocommit=True) as conn:
        conn.execute(BOOTSTRAP)
        done = {row[0] for row in conn.execute("SELECT Filename FROM dbo.SchemaMigrations")}

        for path in sorted(directory.glob("*.sql")):
            if path.name in done:
                continue
            log.info("applying_migration", extra={"migration": path.name})

            # SQL Server batches are separated by GO, which pyodbc does not understand.
            sql = path.read_text(encoding="utf-8")
            for batch in (b.strip() for b in sql.split("\nGO")):
                if batch:
                    conn.execute(batch)

            conn.execute(
                "INSERT INTO dbo.SchemaMigrations (Filename) VALUES (?)", path.name
            )
            applied += 1

    log.info("migrations_complete", extra={"applied": applied, "already_present": len(done)})
    return applied
```

:::hint{type=warning}
`GO` is a **batch separator understood by SSMS and sqlcmd, not by SQL Server itself.** Send a script containing `GO` to the engine through a driver and you get a syntax error. Splitting on it, as above, is the standard workaround — and it is a genuinely surprising fact the first time you meet it.
:::

## Configuration

```python title="src/config.py"
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    environment: str
    log_level: str
    schema_path: str
    max_body_bytes: int

    @classmethod
    def from_env(cls) -> "Settings":
        url = os.environ.get("DATABASE_CONNECTION_STRING")
        if not url:
            raise RuntimeError("DATABASE_CONNECTION_STRING is required")
        return cls(
            database_url=url,
            environment=os.environ.get("ENVIRONMENT", "local"),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
            schema_path=os.environ.get("SCHEMA_PATH", "schemas/v1/ticket.schema.json"),
            max_body_bytes=int(os.environ.get("MAX_BODY_BYTES", 64 * 1024)),
        )


settings = Settings.from_env()
```

:::hint{type=success}
**Fail fast on missing configuration.** Raising at import time means a misconfigured deployment refuses to start and the platform's health check catches it immediately. The alternative — defaulting to something and crashing on the first real request twenty minutes later — is much harder to diagnose.
:::

## Validation

```python title="src/validation.py"
import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from .config import settings


@lru_cache(maxsize=1)
def get_validator() -> Draft202012Validator:
    schema = json.loads(Path(settings.schema_path).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_ticket(payload: object) -> list[dict[str, str]]:
    """Return every problem. Empty list means the payload is valid."""
    validator = get_validator()
    problems: list[dict[str, str]] = []
    for error in sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path)):
        field = "/" + "/".join(str(p) for p in error.absolute_path)
        problems.append({"field": field if field != "/" else "(root)",
                         "problem": error.message})
    return problems
```

## Database access

```python title="src/db.py"
import json
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

import pyodbc

from .config import settings

log = logging.getLogger(__name__)

UNIQUE_VIOLATION = 2627          # SQL Server error for a unique constraint breach

INSERT_TICKET = """
INSERT INTO support.Tickets
    (TicketId, CustomerId, Subject, Body, Priority, Status,
     ReporterEmail, CreatedAtUtc, SourcePayload)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
"""

INSERT_REJECTION = """
INSERT INTO support.RejectedPayloads (CorrelationId, Payload, Errors)
VALUES (?, ?, ?);
"""

SELECT_TICKETS = """
SELECT   TicketId, CustomerId, Subject, Priority, Status, CreatedAtUtc, IngestedAtUtc
FROM     support.Tickets
WHERE    (? IS NULL OR CustomerId = ?)
  AND    (? IS NULL OR Status     = ?)
  AND    (? IS NULL OR Priority   = ?)
  AND    (? IS NULL OR CreatedAtUtc >= ?)
  AND    (? IS NULL OR CreatedAtUtc <  ?)
ORDER BY CreatedAtUtc DESC
OFFSET   ? ROWS FETCH NEXT ? ROWS ONLY;
"""


@contextmanager
def connection() -> Iterator[pyodbc.Connection]:
    """pyodbc pools connections per process by default when pooling is enabled."""
    conn = pyodbc.connect(settings.database_url, timeout=5)
    try:
        yield conn
    finally:
        conn.close()


def insert_ticket(ticket: dict[str, Any], raw_payload: str) -> str:
    """Return 'created' or 'exists'. Idempotency is enforced by the UNIQUE constraint."""
    reporter = ticket.get("reporter") or {}
    with connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                INSERT_TICKET,
                ticket["ticketId"],
                ticket["customerId"],
                ticket["subject"],
                ticket.get("body"),
                ticket["priority"],
                ticket.get("status", "open"),
                reporter.get("email"),
                datetime.fromisoformat(ticket["createdAt"].replace("Z", "+00:00")),
                raw_payload,
            )
            conn.commit()
            return "created"
        except pyodbc.IntegrityError as exc:
            conn.rollback()
            if _sql_error_number(exc) == UNIQUE_VIOLATION:
                return "exists"
            raise


def insert_rejection(correlation_id: str, payload: str, problems: list[dict]) -> None:
    with connection() as conn:
        conn.cursor().execute(INSERT_REJECTION, correlation_id, payload,
                              json.dumps(problems))
        conn.commit()


def _sql_error_number(exc: pyodbc.Error) -> int | None:
    """pyodbc surfaces the driver message; the SQL Server number is embedded in it."""
    for arg in exc.args:
        text = str(arg)
        if "(2627)" in text:
            return UNIQUE_VIOLATION
    return None
```

:::hint{type=danger}
Note the `(? IS NULL OR Column = ?)` pattern in the query. It builds one parameterised statement handling every combination of optional filters — safe against injection and with a single cached plan.

The alternative, string-concatenating filters, is both an injection vector and a plan-cache polluter. If the optional-filter pattern causes plan problems on a large table (it can — the optimiser may pick a plan suited to one parameter combination), the fix is `OPTION (RECOMPILE)`, not string concatenation.
:::

## The API

```python title="src/main.py"
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from . import db
from .config import settings
from .logging_setup import configure, correlation_id
from .validation import validate_ticket, get_validator

configure(settings.log_level)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_validator()                       # fail fast if the schema is broken
    log.info("service_started", extra={"environment": settings.environment})
    yield
    log.info("service_stopping")


app = FastAPI(title="Support Ticket Ingestion", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def correlate_and_time(request: Request, call_next):
    cid = request.headers.get("x-correlation-id") or str(uuid.uuid4())
    correlation_id.set(cid)
    started = time.perf_counter()

    response: Response = await call_next(request)

    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["x-correlation-id"] = cid
    log.info("request_completed", extra={
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "latency_ms": round(elapsed_ms, 2),
    })
    return response


@app.post("/v1/tickets")
async def ingest(request: Request) -> JSONResponse:
    cid = correlation_id.get()
    raw = await request.body()

    if len(raw) > settings.max_body_bytes:
        return _error(413, "payload_too_large",
                      f"Body exceeds {settings.max_body_bytes} bytes", cid)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.warning("invalid_json", extra={"error": exc.msg})
        return _error(400, "invalid_json", exc.msg, cid)

    problems = validate_ticket(payload)
    if problems:
        log.warning("validation_failed", extra={
            "problem_count": len(problems),
            "fields": [p["field"] for p in problems],
        })
        try:
            db.insert_rejection(cid, raw.decode("utf-8", "replace"), problems)
        except Exception:
            log.exception("rejection_store_failed")     # never mask the 400
        return JSONResponse(
            status_code=400,
            content={
                "error": "validation_failed",
                "message": f"{len(problems)} field(s) failed validation.",
                "details": problems,
                "correlation_id": cid,
                "documentation": "https://example.com/schemas/v1/ticket.schema.json",
            },
        )

    try:
        outcome = db.insert_ticket(payload, raw.decode("utf-8"))
    except Exception:
        log.exception("persist_failed", extra={"ticket_id": payload.get("ticketId")})
        return _error(503, "storage_unavailable",
                      "Could not persist the ticket. Retry with the same ticketId.", cid)

    log.info("ticket_ingested", extra={
        "ticket_id": payload["ticketId"],
        "customer_id": payload["customerId"],
        "outcome": outcome,
    })
    return JSONResponse(
        status_code=201 if outcome == "created" else 200,
        content={"ticketId": payload["ticketId"], "outcome": outcome,
                 "correlation_id": cid},
    )


@app.get("/v1/tickets")
async def list_tickets(customerId: int | None = None, status: str | None = None,
                       priority: str | None = None, from_: str | None = None,
                       to: str | None = None, limit: int = 50, offset: int = 0):
    limit = max(1, min(limit, 200))
    rows = db.query_tickets(customerId, status, priority, from_, to, limit, offset)
    return {"count": len(rows), "items": rows}


@app.get("/health")
async def health():
    return {"status": "ok", "version": app.version}


@app.get("/ready")
async def ready():
    try:
        with db.connection() as conn:
            conn.cursor().execute("SELECT 1")
    except Exception as exc:
        log.warning("readiness_failed", extra={"error": str(exc)})
        return JSONResponse(status_code=503,
                            content={"status": "degraded", "database": "unreachable"})
    return {"status": "ok", "database": "ok"}


def _error(status: int, code: str, message: str, cid: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": code, "message": message, "correlation_id": cid})
```

:::hint{type=warning}
Notice that a failure writing the **rejection record** is logged but does not change the response. The caller's payload was invalid; that is still true regardless of whether we managed to file it. Letting a secondary-storage failure turn a clean 400 into a 500 would be actively misleading — the caller would retry a payload that can never succeed.
:::

Also note the 503 message: *"Retry with the same ticketId."* That is only safe advice **because** the endpoint is idempotent, and telling the caller so is what makes the idempotency useful to them.

## Tests

```python title="tests/conftest.py"
import os
import pytest
from pathlib import Path
from testcontainers.mssql import SqlServerContainer


@pytest.fixture(scope="session")
def sql_server():
    with SqlServerContainer("mcr.microsoft.com/mssql/server:2022-latest") as mssql:
        yield mssql


@pytest.fixture(scope="session")
def connection_string(sql_server):
    cs = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={sql_server.get_container_host_ip()},{sql_server.get_exposed_port(1433)};"
        "DATABASE=master;UID=sa;"
        f"PWD={sql_server.password};TrustServerCertificate=yes;"
    )
    os.environ["DATABASE_CONNECTION_STRING"] = cs
    from src.migrate import apply_migrations
    apply_migrations(cs, Path("sql/migrations"))
    return cs


@pytest.fixture
def client(connection_string):
    from fastapi.testclient import TestClient
    from src.main import app
    return TestClient(app)
```

```python title="tests/test_idempotency.py"
VALID = {
    "ticketId": "TKT-000001",
    "customerId": 29825,
    "subject": "Payments failing with gateway timeout",
    "priority": "high",
    "createdAt": "2026-08-06T14:22:01Z",
    "reporter": {"name": "Ada Lovelace", "email": "ada@example.com"},
}


def test_first_submission_creates(client):
    response = client.post("/v1/tickets", json=VALID)
    assert response.status_code == 201
    assert response.json()["outcome"] == "created"


def test_duplicate_submission_is_idempotent(client):
    client.post("/v1/tickets", json=VALID)
    response = client.post("/v1/tickets", json=VALID)
    assert response.status_code == 200
    assert response.json()["outcome"] == "exists"


def test_duplicate_does_not_create_a_second_row(client):
    for _ in range(5):
        client.post("/v1/tickets", json=VALID)
    listing = client.get("/v1/tickets", params={"customerId": VALID["customerId"]}).json()
    matching = [t for t in listing["items"] if t["TicketId"] == VALID["ticketId"]]
    assert len(matching) == 1


def test_concurrent_submissions_create_exactly_one(client):
    """The real test of idempotency: race two requests and require one winner."""
    from concurrent.futures import ThreadPoolExecutor
    payload = {**VALID, "ticketId": "TKT-000099"}

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: client.post("/v1/tickets", json=payload), range(8)))

    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1, codes       # exactly one creation
    assert codes.count(200) == 7, codes       # the rest recognised as duplicates


def test_every_response_carries_a_correlation_id(client):
    response = client.post("/v1/tickets", json={**VALID, "ticketId": "TKT-000002"})
    assert response.headers["x-correlation-id"]
    assert response.json()["correlation_id"] == response.headers["x-correlation-id"]
```

:::hint{type=success}
`test_concurrent_submissions_create_exactly_one` is the test worth showing an interviewer. It is the difference between "I made it idempotent" and "I proved it is idempotent under concurrency" — and it is the test that would fail if you had used check-then-insert instead of the UNIQUE constraint.
:::

```quiz
question: Your ingestion endpoint returns 503 when the database is unreachable, with the message "Retry with the same ticketId". Why is that advice safe?
options:
  - Because 503 responses are automatically retried by HTTP clients
  - Because the endpoint is idempotent — a retry with the same ticketId cannot create a duplicate
  - Because the payload was already written to the rejection store
  - Because the database rolls back on connection loss
answer: 1
explanation: Advising a retry is only responsible when retrying is harmless. The UNIQUE constraint on TicketId guarantees that a second successful attempt either creates the row (if the first never landed) or reports it already exists — never two rows.
```

## Exercise

:::checklist{title="Day 31 checklist"}
- [ ] Migration runner written; migrations applied and recorded in `SchemaMigrations`
- [ ] Run the migrations twice; confirm the second run applies nothing
- [ ] Configuration read from the environment, failing fast when absent
- [ ] Validation returns **all** problems, not just the first
- [ ] `POST /v1/tickets` returns 201 on create, 200 on duplicate, 400 with field detail
- [ ] Rejected payloads stored with correlation ID and errors
- [ ] A rejection-store failure does not turn a 400 into a 500
- [ ] `GET /v1/tickets` with all five optional filters, fully parameterised
- [ ] `/health` and `/ready` behave differently when the database is down
- [ ] Integration tests running against a containerised SQL Server
- [ ] The **concurrency** idempotency test passing
- [ ] Every response carries a correlation ID, in the body and the header
- [ ] All tests green in CI
:::

:::details{summary="Common pyodbc problems on this exercise"}
1. **`Data source name not found`** — the ODBC driver is not installed. Install "ODBC Driver 18 for SQL Server". The name in the connection string must match exactly, braces included.

2. **`SSL Provider: certificate chain… not trusted`** — Driver 18 encrypts by default. Add `TrustServerCertificate=yes` for local development; use a proper certificate in production.

3. **`Login failed for user 'sa'`** — the container password policy requires 8+ characters with upper, lower, digit and symbol. SQL Server rejects weak passwords at startup and the container appears to start then immediately fail.

4. **Datetime binding errors** — pass a Python `datetime`, not a string. `datetime.fromisoformat(value.replace("Z", "+00:00"))` handles the ISO 8601 `Z` suffix, which `fromisoformat` did not accept before Python 3.11.

5. **Tests pass individually, fail together** — shared state in the database. Either use a unique `ticketId` per test, or truncate the tables in a fixture.
:::

## Where this is going

Tomorrow: get it deployed. Containerise it, push it to a registry, run it in the cloud, and wire the whole thing into the pipeline from Week 3.
