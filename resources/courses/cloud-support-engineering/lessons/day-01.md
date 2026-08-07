---
title: SQL Server Setup & T-SQL Fundamentals
summary: Get a real SQL Server running locally, learn the two tools the job description names, and write your first queries in the dialect Microsoft shops actually use.
minutes: 90
objectives:
  - Install SQL Server Developer Edition (or provision Azure SQL free tier) and connect to it
  - Navigate both SSMS and Azure Data Studio well enough to run a query and read a result grid
  - Write SELECT statements using WHERE, ORDER BY and TOP
  - Explain why T-SQL uses TOP instead of LIMIT and what that changes about query structure
keyTerms:
  - term: T-SQL
    definition: Transact-SQL — Microsoft's dialect of SQL, used by SQL Server and Azure SQL. A superset of standard SQL with its own procedural extensions.
  - term: SSMS
    definition: SQL Server Management Studio. The full-featured Windows administration and query tool for SQL Server.
  - term: Azure Data Studio
    definition: A lighter, cross-platform, notebook-friendly query editor for SQL Server and Azure SQL. Built on the same foundation as VS Code.
  - term: Instance
    definition: A running copy of the SQL Server engine. One machine can host several named instances, each with its own databases and configuration.
  - term: Predicate
    definition: The boolean expression in a WHERE or ON clause that decides whether a row is kept.
resources:
  - label: SQL Server Developer Edition download
    url: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
  - label: Download SQL Server Management Studio (SSMS)
    url: https://learn.microsoft.com/en-us/ssms/download-sql-server-management-studio-ssms
  - label: Azure Data Studio documentation
    url: https://learn.microsoft.com/en-us/azure-data-studio/
  - label: T-SQL reference — SELECT
    url: https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql
---

Most people arrive at a support engineering role having written SQL somewhere — a bootcamp, a side project, a MySQL-backed web app. That experience transfers, but not cleanly. Microsoft-stack shops run **SQL Server**, query it in **T-SQL**, and administer it through **SSMS** and **Azure Data Studio**. Those tools have their own vocabulary, their own keyboard shortcuts, and at least one syntax difference that will trip you up in an interview if you have never met it.

Today is about getting a real server running on your own machine and getting your hands dirty in it. Not a hosted sandbox where someone else has already loaded the data — an actual instance you installed, connected to, and can break.

## Why a local install matters

You could learn SQL entirely in a browser sandbox. Support engineers cannot. When a customer says "the query times out," the useful next questions are *which instance*, *what is the connection string*, *what does the execution plan look like*, *is the statistics object stale*. None of those questions exist in a sandbox where the connection is handled for you.

:::hint{type=tip}
Developer Edition is the full Enterprise feature set, licensed free for non-production use. It is the right choice for learning — Express Edition has caps (10 GB per database, limited memory) that will quietly change the behaviour you observe when you get to indexes and execution plans.
:::

## Getting a server

You have two reasonable paths. Pick one; you can add the other later.

:::tabs

:::tab{title="Local: SQL Server Developer Edition"}
1. Download **SQL Server 2022 Developer Edition** from Microsoft.
2. Choose the **Basic** installation type unless you have a reason not to. It installs the Database Engine with sensible defaults.
3. Note the **instance name** the installer gives you — usually `MSSQLSERVER` (the default instance) or `SQLEXPRESS`. You will connect to `localhost` for a default instance, or `localhost\INSTANCENAME` for a named one.
4. Leave authentication as **Windows Authentication** for now. Mixed Mode (which adds SQL logins) becomes relevant on Day 4.

Advantages: fast, free forever, works offline, and you can wreck it without consequence.
:::

:::tab{title="Cloud: Azure SQL free tier"}
1. Create an Azure account (you will need one for Week 4 anyway).
2. Create an **Azure SQL Database** and select the **free offer** — at time of writing this grants a small vCore database at no cost, with a monthly compute allowance.
3. Under **Networking**, add your client IP to the firewall, or you will get a connection error that looks like a credentials problem but is not.

Advantages: it is the thing you will actually support in a cloud role, and you get practice with the Azure portal early.
:::

:::

:::hint{type=warning}
If you go the Azure route, set a **budget alert** on the subscription before you create anything. Free tiers have edges. Discovering one via a credit card statement is a bad way to learn about them.
:::

## The two tools

The job description names both SSMS and Azure Data Studio, which means someone on the team uses each. Get comfortable in both — they are good at different things.

| | SSMS | Azure Data Studio |
|---|---|---|
| Platform | Windows only | Windows, macOS, Linux |
| Strength | Administration: agent jobs, security, backups, maintenance plans | Querying, notebooks, source-controlled `.sql` files, extensions |
| Object Explorer | Deep — every server object is browsable | Lighter, focused on schema |
| Execution plans | Rich graphical plan viewer | Good, improving, plan viewer built in |
| Feels like | A management console | VS Code |

A practical division: **SSMS when you are administering, Azure Data Studio when you are investigating.** Support work is mostly investigating.

## Your first connection

Open SSMS. The connect dialog wants four things:

:::steps

1. **Server type** — Database Engine.

2. **Server name** — `localhost` for a default local instance, `localhost\SQLEXPRESS` for a named one, or `yourserver.database.windows.net` for Azure SQL.

3. **Authentication** — Windows Authentication locally; SQL Server Authentication for Azure SQL.

4. **Connect.** If the Object Explorer tree appears on the left, you are in.

:::

:::details{summary="Connection fails — what do you check first?"}
In rough order of likelihood:

1. **Is the service running?** `services.msc` → look for `SQL Server (MSSQLSERVER)`. A stopped service produces a "network-related or instance-specific error."
2. **Right instance name?** A named instance needs `host\instance`. This is the single most common local mistake.
3. **Firewall** — for Azure SQL, your client IP must be allowed. For remote SQL Server, TCP 1433 must be open.
4. **TCP/IP protocol enabled?** In SQL Server Configuration Manager, TCP/IP is sometimes disabled by default on Express installs.

Note the shape of that list: service → address → network → protocol. That is the same triage order you will use for every connectivity ticket for the rest of your career.
:::

## Getting a database to practise on

Empty servers are useless for learning. Microsoft publishes two sample databases, and both are worth having:

- **AdventureWorks** — a fictional bicycle manufacturer. Widely used in tutorials and interview questions. Moderately normalised, good for joins.
- **WideWorldImporters** — a newer, more realistic sample with temporal tables and better-designed schemas.

Download the `.bak` backup file, then in SSMS: right-click **Databases** → **Restore Database** → **Device** → point at the `.bak` → OK.

```sql title="verify-restore.sql"
-- Confirm the database is online and see what is in it.
SELECT name, state_desc, recovery_model_desc
FROM   sys.databases
ORDER BY name;

USE AdventureWorks2022;
GO

SELECT TOP (20)
       s.name  AS SchemaName,
       t.name  AS TableName,
       p.rows  AS ApproxRowCount
FROM   sys.tables       AS t
JOIN   sys.schemas      AS s ON s.schema_id = t.schema_id
JOIN   sys.partitions   AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
ORDER BY p.rows DESC;
```

That second query is worth remembering. "What are the biggest tables in this database?" is the first thing you want to know about a database you have never seen, and `sys.partitions` answers it without scanning anything.

## T-SQL fundamentals

### SELECT, WHERE, ORDER BY

```sql title="basics.sql"
SELECT   p.FirstName,
         p.LastName,
         p.ModifiedDate
FROM     Person.Person AS p
WHERE    p.PersonType = 'IN'
  AND    p.ModifiedDate >= '2013-01-01'
ORDER BY p.LastName ASC, p.FirstName ASC;
```

Three habits to build immediately:

1. **Alias your tables** (`AS p`) and prefix every column. In a two-table query it looks like ceremony. In a six-table support query it is the difference between readable and unreadable.
2. **Schema-qualify** (`Person.Person`, not `Person`). SQL Server resolves unqualified names through the default schema, which is a source of surprising bugs.
3. **Never `SELECT *` in something you will keep.** It is fine while exploring. It is a liability in a saved query, because the shape of your result changes when someone adds a column.

### TOP — the difference that matters

This is the syntax difference the job description implicitly cares about, and the one that catches people out:

```sql title="top-vs-limit.sql"
-- MySQL / PostgreSQL
-- SELECT * FROM Orders ORDER BY OrderDate DESC LIMIT 10;

-- T-SQL
SELECT TOP (10) *
FROM   Sales.SalesOrderHeader
ORDER BY OrderDate DESC;
```

`TOP` goes **immediately after `SELECT`**, before the column list. `LIMIT` goes at the **end**. That is not just cosmetic — it changes how you build a query incrementally. In Postgres you append `LIMIT 10` to a finished query; in T-SQL you have to go back to the top.

:::hint{type=warning}
`TOP` without `ORDER BY` is non-deterministic. `SELECT TOP (10) * FROM Sales.SalesOrderHeader` returns *ten arbitrary rows* — whichever ten the engine finds first. It will look stable in testing and then change when an index changes. Always pair `TOP` with `ORDER BY` when the identity of the rows matters.
:::

The parentheses around the number are optional for a literal (`TOP 10` works) but required for a variable or expression, and Microsoft's own style guide uses them everywhere. Use them.

There is also `OFFSET … FETCH`, which is the ANSI-standard pagination syntax and what you want for "page 3 of results":

```sql title="pagination.sql"
SELECT   OrderDate, SalesOrderNumber, TotalDue
FROM     Sales.SalesOrderHeader
ORDER BY OrderDate DESC
OFFSET   40 ROWS
FETCH    NEXT 20 ROWS ONLY;
```

`OFFSET … FETCH` requires an `ORDER BY`. The engine enforces it, which is a small kindness.

```quiz
question: Which statement returns the ten most recent orders, deterministically?
options:
  - "SELECT * FROM Sales.SalesOrderHeader LIMIT 10"
  - "SELECT TOP (10) * FROM Sales.SalesOrderHeader"
  - "SELECT TOP (10) * FROM Sales.SalesOrderHeader ORDER BY OrderDate DESC"
  - "SELECT * FROM Sales.SalesOrderHeader ORDER BY OrderDate DESC LIMIT 10"
answer: 2
explanation: LIMIT is not T-SQL syntax at all, and TOP without ORDER BY returns an arbitrary set of rows. Only TOP combined with ORDER BY is both valid T-SQL and deterministic.
```

### Filtering carefully

```sql title="where-patterns.sql"
-- Ranges: BETWEEN is inclusive on both ends
WHERE OrderDate BETWEEN '2013-01-01' AND '2013-12-31'

-- Sets
WHERE Status IN (1, 2, 5)

-- Pattern matching. Leading wildcards prevent index seeks — note it, do not fear it.
WHERE LastName LIKE 'Sm%'

-- NULL is not a value; it is the absence of one. = NULL is never true.
WHERE ShipDate IS NULL
```

:::hint{type=danger}
`WHERE ShipDate = NULL` returns **zero rows**, always, even for rows where `ShipDate` is null. `NULL` compared to anything — including `NULL` — evaluates to *unknown*, not *true*. Use `IS NULL` / `IS NOT NULL`. This bug is silent, which is what makes it dangerous: your query runs, returns nothing, and you conclude the data is missing.
:::

### Dates, the support engineer's constant companion

Almost every real support query is time-bounded. "Show me what happened in the last 24 hours" is the job.

```sql title="date-filters.sql"
-- Last 7 days, relative to now
SELECT   TOP (100) *
FROM     Sales.SalesOrderHeader
WHERE    OrderDate >= DATEADD(DAY, -7, GETDATE())
ORDER BY OrderDate DESC;

-- Prefer half-open ranges for whole days: >= start AND < next day.
-- This avoids the classic "misses rows timestamped 23:59:30" bug.
WHERE OrderDate >= '2013-06-01'
  AND OrderDate <  '2013-06-02'
```

:::hint{type=tip}
Use `SYSUTCDATETIME()` rather than `GETDATE()` when you care about correctness across regions. Cloud servers run in UTC; your laptop does not. Mixing the two produces off-by-hours bugs that only appear for some customers.
:::

## A note on how to read query results

When you run a query in SSMS, look at three places, not one:

1. **The results grid** — the data.
2. **The Messages tab** — row counts, warnings, and anything `PRINT`ed.
3. **The status bar** — execution time and rows returned.

Get in the habit now. On Day 4 we add a fourth: the execution plan.

## Exercise

:::checklist{title="Day 1 checklist"}
- [ ] SQL Server Developer Edition installed **or** Azure SQL free-tier database created
- [ ] SSMS installed and connected to the instance
- [ ] Azure Data Studio installed and connected to the same instance
- [ ] AdventureWorks (or WideWorldImporters) restored and queryable
- [ ] Ran the `sys.partitions` query and identified the three largest tables
- [ ] Wrote a query using `TOP` + `ORDER BY` and confirmed the result changes when you flip `ASC`/`DESC`
- [ ] Wrote a query using `IS NULL` and confirmed `= NULL` returns nothing
- [ ] Saved your queries to a folder you will turn into a Git repo on Day 5
:::

### Stretch problems

Write each of these against AdventureWorks. Do not look up the answer until you have tried.

1. The 20 most expensive line items on any order, showing product ID, order ID and line total.
2. Every person whose last name starts with `Sa`, sorted by first name.
3. All sales orders placed in July 2013 that have not shipped.
4. The count of rows in `Sales.SalesOrderDetail` — then find a way to get an *approximate* count without scanning the table.

:::details{summary="Hint for #4"}
You already ran the query. `sys.partitions` carries a maintained `rows` value for the heap or clustered index (`index_id IN (0,1)`). It is approximate, but it is instant even on a billion-row table — which is why it is the right tool when a customer asks "how big is this table?" during an incident.
:::

## Where this is going

Tomorrow: joins. The single most common source of both wrong answers and slow queries in support work, and the topic most likely to be probed in a technical screen.
