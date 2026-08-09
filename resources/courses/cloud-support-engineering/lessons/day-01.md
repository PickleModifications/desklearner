---
title: Azure SQL Setup & T-SQL Fundamentals
summary: Provision a real Azure SQL Database on the free offer with Microsoft's AdventureWorksLT sample already loaded, learn the two tools the job description names, and write your first queries in the dialect Microsoft shops actually use.
minutes: 90
objectives:
  - Provision an Azure SQL Database on the free offer with the AdventureWorksLT sample data loaded at creation
  - Connect to it from both SSMS and Azure Data Studio, and triage a failed connection in the right order
  - Write SELECT statements using WHERE, ORDER BY and TOP against the SalesLT schema
  - Explain why T-SQL uses TOP instead of LIMIT, and why USE does not work against Azure SQL
keyTerms:
  - term: T-SQL
    definition: Transact-SQL — Microsoft's dialect of SQL, used by SQL Server and Azure SQL. A superset of standard SQL with its own procedural extensions.
  - term: Azure SQL Database
    definition: Microsoft's fully managed relational database service (PaaS). Same engine and T-SQL as SQL Server, but Microsoft owns the host, the patching and the backups.
  - term: Logical server
    definition: The Azure container that databases live under, addressed as yourserver.database.windows.net. It holds the admin login and the firewall rules, but it is not a machine you can log into.
  - term: SalesLT
    definition: The single schema in AdventureWorksLT — Microsoft's lightweight sample database. Twelve tables covering customers, addresses, products and sales orders.
  - term: Serverless auto-pause
    definition: A serverless Azure SQL database with no activity for a set period is paused to stop billing compute. The next connection resumes it, which takes up to a minute and can fail the first attempt.
  - term: Predicate
    definition: The boolean expression in a WHERE or ON clause that decides whether a row is kept.
resources:
  - label: Azure SQL Database free offer
    url: https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer
  - label: AdventureWorks sample databases (AdventureWorksLT)
    url: https://learn.microsoft.com/en-us/sql/samples/adventureworks-install-configure
  - label: Download SQL Server Management Studio (SSMS)
    url: https://learn.microsoft.com/en-us/ssms/download-sql-server-management-studio-ssms
  - label: Azure Data Studio documentation
    url: https://learn.microsoft.com/en-us/azure-data-studio/
  - label: T-SQL reference — SELECT
    url: https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql
---

Most people arrive at a support engineering role having written SQL somewhere — a bootcamp, a side project, a MySQL-backed web app. That experience transfers, but not cleanly. Microsoft-stack shops run **SQL Server** and **Azure SQL**, query them in **T-SQL**, and administer them through **SSMS** and **Azure Data Studio**. Those tools have their own vocabulary, their own keyboard shortcuts, and at least one syntax difference that will trip you up in an interview if you have never met it.

Today you provision a real database in Azure and get your hands dirty in it. Not a browser sandbox where the connection is handled for you — a database with your name on the firewall rule, which you can connect to, query, and misconfigure.

## Why Azure SQL rather than a local install

You could install SQL Server Developer Edition locally, and plenty of courses do. For a **cloud** support role, Azure SQL is the better teacher, for one reason: the things that break are the things that break in production.

A local install never teaches you that a connection failure is usually a firewall rule. It never shows you a database that paused itself overnight. It has no service tier to run out of. Every one of those is a real ticket, and you will meet all three in the next six weeks.

There is a second reason, which is that you need an Azure subscription for Week 4 anyway. Creating it now spreads the setup cost.

:::hint{type=tip}
**Free offer, not free trial.** Azure SQL Database has a standing free offer — one serverless General Purpose database per subscription, with a monthly allowance of compute seconds and 32 GB of storage. It is not a 12-month countdown; it renews monthly. That is enough for everything in this course.
:::

## Provisioning the database

:::steps

1. **Create an Azure account** if you do not have one. A personal Microsoft account is fine.

2. **Portal → Create a resource → SQL Database.** Create a new resource group — call it `rg-support-lab`, so that on Day 29 you can delete the whole thing in one action.

3. **Database name:** `supportlab`. Under **Server**, create a new logical server. The name must be globally unique — `sql-supportlab-yourname` works. Pick the region nearest you.

4. **Authentication:** enable **SQL authentication** and set an admin login and password. Keep Entra ID authentication on as well; you will use it in Week 4. Write the password down somewhere real — there is no recovery, only a reset.

5. **Compute + storage:** click **Configure database** and select the **free offer** (Apply offer / *"Want to use the free offer?"*). This lands you on General Purpose serverless. Leave auto-pause enabled.

6. **Networking tab:** set connectivity to **Public endpoint**, and turn on both **Allow Azure services to access this server** and **Add current client IP address**. Skipping the second one is how you get a connection error that reads like a credentials problem and is not.

7. **Additional settings tab → Use existing data → `Sample`.** This is the important click. It loads **AdventureWorksLT** into the database at creation time. No backup file, no restore, no download.

8. **Review + create.** Deployment takes two or three minutes.

:::

:::hint{type=warning}
Set a **budget alert** on the subscription before you create anything else. Cost Management → Budgets → a £5 monthly budget with an alert at 50%. Free offers have edges. Discovering one via a card statement is a bad way to learn where they are.
:::

:::details{summary="I already created the database without the sample data"}
The `Sample` option only applies at creation. You have two choices:

1. **Delete and recreate.** Takes five minutes and is genuinely the simplest answer on day one.
2. **Import the bacpac.** Download `AdventureWorksLT2022.bacpac` from Microsoft's samples repository, then in the portal: your **logical server** → **Import database** → point at the bacpac in a storage account. Note this is an *import* of a portable bacpac, not a `RESTORE` of a `.bak` — Azure SQL has no `RESTORE DATABASE` statement, because you do not own the file system it would read from.

That second point is worth holding on to. A large amount of SQL Server tutorial material assumes you can restore a `.bak`, and none of it applies to Azure SQL.
:::

## The two tools

The job description names both SSMS and Azure Data Studio, which means someone on the team uses each. Get comfortable in both — they are good at different things.

| | SSMS | Azure Data Studio |
|---|---|---|
| Platform | Windows only | Windows, macOS, Linux |
| Strength | Administration: security, agent jobs, deep object scripting | Querying, notebooks, source-controlled `.sql` files, extensions |
| Object Explorer | Deep — every server object is browsable | Lighter, focused on schema |
| Execution plans | Rich graphical plan viewer | Good, improving, plan viewer built in |
| Against Azure SQL | Some nodes are greyed out — no Agent, no Backups, no Activity Monitor | Feels native; the Azure sign-in is built in |
| Feels like | A management console | VS Code |

A practical division: **SSMS when you are administering, Azure Data Studio when you are investigating.** Support work is mostly investigating.

## Your first connection

Open SSMS. The connect dialog wants four things:

:::steps

1. **Server type** — Database Engine.

2. **Server name** — `yourserver.database.windows.net`. The full name, including the suffix. Copy it from the portal's database overview blade rather than typing it.

3. **Authentication** — SQL Server Authentication, with the admin login and password from step 4 above.

4. **Connect.** Then, importantly, expand **Databases** in Object Explorer. You will see `supportlab`, and *not much else* — you are not an administrator of a machine here, you are a user of a service.

:::

:::details{summary="Connection fails — what do you check first?"}
In rough order of likelihood:

1. **Firewall rule.** Your client IP must be listed on the logical server. Home IPs change, VPNs change them constantly, and the error — *"Cannot open server ... requested by the login. Client with IP address ... is not allowed to access the server"* — helpfully tells you the IP it saw. Add it: portal → logical server → Networking → firewall rules.
2. **Wrong server name.** It must be the fully qualified `*.database.windows.net`. Just the short name resolves to nothing.
3. **The database is paused.** Serverless auto-pause means the first connection after an idle period triggers a resume and may fail outright with error **40613, "Database ... is not currently available"**. Wait sixty seconds and connect again. This is expected behaviour, not a fault.
4. **Outbound port 1433 blocked.** Corporate and some public networks block it. Symptom: a timeout rather than a rejection. Test from a phone hotspot to confirm.
5. **Login is wrong.** Genuinely the least likely, and the first thing everyone assumes.

Note the shape of that list: network permission → address → service state → transport → credentials. That is the same triage order you will use for every connectivity ticket for the rest of your career, and note that credentials come **last**.
:::

### Two things that work differently from SQL Server

```sql title="azure-differences.sql"
-- This FAILS on Azure SQL: "USE statement is not supported to switch between databases."
USE supportlab;
GO

-- You change database by reconnecting, or with the database dropdown in
-- the SSMS toolbar / the connection picker in Azure Data Studio.

-- And from inside a user database, this shows you almost nothing:
SELECT name, state_desc FROM sys.databases;   -- master + this database only
```

Each Azure SQL database is an island. There is no cross-database querying, no `USE`, and no server-wide view from inside one. When a tutorial opens with `USE AdventureWorks2022; GO`, that line is the first thing you delete.

## What is actually in the database

AdventureWorksLT is a trimmed version of the AdventureWorks sample: a fictional bicycle manufacturer, twelve tables, all in one schema called **`SalesLT`**.

```sql title="explore-schema.sql"
-- The first question to ask about any database you have never seen:
-- what are the tables, and how big are they?
SELECT   s.name  AS SchemaName,
         t.name  AS TableName,
         p.rows  AS ApproxRowCount
FROM     sys.tables     AS t
JOIN     sys.schemas    AS s ON s.schema_id = t.schema_id
JOIN     sys.partitions AS p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
ORDER BY p.rows DESC;
```

That query is worth remembering. `sys.partitions` carries a maintained row count for the heap or clustered index, so it answers "how big is this table?" **instantly**, without scanning anything — which is exactly what you want when a customer asks during an incident and the table has two billion rows.

Run it and you get roughly this shape:

| Table | Rows | What it is |
|---|---|---|
| `SalesLT.Customer` | ~847 | People and the companies they buy for |
| `SalesLT.SalesOrderDetail` | ~542 | Line items |
| `SalesLT.Address` | ~450 | Addresses, with `City`, `StateProvince`, `CountryRegion` |
| `SalesLT.CustomerAddress` | ~417 | The many-to-many between the two above |
| `SalesLT.Product` | ~295 | Products, with `ListPrice`, `Color`, `Size` |
| `SalesLT.ProductDescription` | ~762 | Descriptions, in several languages |
| `SalesLT.ProductModel` | ~128 | Models, grouping products |
| `SalesLT.ProductCategory` | ~41 | Categories — **self-referencing**, via `ParentProductCategoryID` |
| `SalesLT.SalesOrderHeader` | **32** | Orders |

:::hint{type=warning}
Look hard at that last number. **Thirty-two orders**, and in the shipped sample they all carry the same `OrderDate`. That is fine for learning join shapes and syntax — a small table is easy to verify by eye — and useless for learning anything about *performance* or *time series*, because every query against it is instant and every date grouping produces one row.

That is a real limitation, and we fix it in the next section rather than pretending otherwise.
:::

## Seeding the lab data

Run this once. It creates a `dbo.Transactions` table with 200,000 rows of synthetic payment activity spread over the last 90 days, referencing real customers from `SalesLT`. Days 3, 4 and 8 all use it, and it is the table that makes execution plans and incident triage meaningful.

```sql title="lab-seed.sql"
IF OBJECT_ID('dbo.Transactions', 'U') IS NOT NULL
    DROP TABLE dbo.Transactions;
GO

CREATE TABLE dbo.Transactions (
    TransactionId INT IDENTITY(1,1) NOT NULL,
    CustomerId    INT               NOT NULL,
    Amount        DECIMAL(10,2)     NOT NULL,
    Status        VARCHAR(20)       NOT NULL,
    FailureCode   VARCHAR(40)       NULL,
    FailureReason NVARCHAR(200)     NULL,
    CreatedAtUtc  DATETIME2(3)      NOT NULL,
    CONSTRAINT PK_Transactions PRIMARY KEY CLUSTERED (TransactionId)
);
GO

-- A tally table: 200,000 numbers, generated without a loop.
WITH Tally AS (
    SELECT TOP (200000)
           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
    FROM   sys.all_objects AS a
    CROSS JOIN sys.all_objects AS b
),
Cust AS (
    SELECT CustomerID,
           ROW_NUMBER() OVER (ORDER BY CustomerID) AS rn,
           COUNT(*)    OVER ()                    AS total
    FROM   SalesLT.Customer
)
INSERT dbo.Transactions (CustomerId, Amount, Status, FailureCode, FailureReason, CreatedAtUtc)
SELECT  c.CustomerID,
        CAST(10 + (t.i % 4000) / 7.0 AS DECIMAL(10,2)),
        CASE WHEN t.i % 25 = 0 THEN 'Failed' ELSE 'Succeeded' END,
        CASE WHEN t.i % 25 = 0
             THEN CHOOSE(1 + (t.i / 25) % 4,
                         'CARD_DECLINED', 'INSUFFICIENT_FUNDS',
                         'GATEWAY_TIMEOUT', 'INVALID_CVV')
        END,
        CASE WHEN t.i % 25 = 0
             THEN CHOOSE(1 + (t.i / 25) % 4,
                         N'Issuer declined the authorisation',
                         N'Insufficient funds on the funding source',
                         N'Upstream gateway did not respond within 30s',
                         N'Card verification value did not match')
        END,
        DATEADD(SECOND, -(t.i % 7776000), SYSUTCDATETIME())   -- spread over 90 days
FROM    Tally AS t
JOIN    Cust  AS c ON c.rn = 1 + (t.i % c.total);   -- deal customers round-robin
GO

-- Now inject an incident: a gateway-timeout spike, in the last four days,
-- for the customer with the lowest ID that has actually placed an order.
DECLARE @IncidentCustomer INT = (SELECT MIN(CustomerID) FROM SalesLT.SalesOrderHeader);

INSERT dbo.Transactions (CustomerId, Amount, Status, FailureCode, FailureReason, CreatedAtUtc)
SELECT TOP (900)
       @IncidentCustomer,
       49.99,
       'Failed',
       'GATEWAY_TIMEOUT',
       N'Upstream gateway did not respond within 30s',
       DATEADD(MINUTE,
               -((ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) * 6) % 5760),
               SYSUTCDATETIME())   -- 900 failures spread across the last ~4 days
FROM   sys.all_objects AS a
CROSS JOIN sys.all_objects AS b;
GO

SELECT COUNT(*) AS Rows_Loaded,
       MIN(CreatedAtUtc) AS Oldest,
       MAX(CreatedAtUtc) AS Newest
FROM   dbo.Transactions;
```

:::hint{type=tip}
Save that file into the folder you will turn into a Git repository on Day 5. Being able to rebuild your lab data from a script in source control — rather than from a `.bak` on your downloads folder — is exactly the habit the rest of this course is training.
:::

Note what the seed script deliberately does **not** do: it does not modify `SalesLT`. The sample stays pristine, so every example in Microsoft's own documentation still produces the results it claims. Your synthetic data lives in `dbo`, cleanly separated.

## T-SQL fundamentals

### SELECT, WHERE, ORDER BY

```sql title="basics.sql"
SELECT   c.FirstName,
         c.LastName,
         c.CompanyName,
         c.ModifiedDate
FROM     SalesLT.Customer AS c
WHERE    c.CompanyName LIKE 'A%'
  AND    c.ModifiedDate >= '2007-01-01'
ORDER BY c.LastName ASC, c.FirstName ASC;
```

Three habits to build immediately:

1. **Alias your tables** (`AS c`) and prefix every column. In a two-table query it looks like ceremony. In a six-table support query it is the difference between readable and unreadable.
2. **Schema-qualify** (`SalesLT.Customer`, not `Customer`). SQL Server resolves unqualified names through your default schema, which is `dbo` — so an unqualified `Customer` fails here, and that surprises people every time.
3. **Never `SELECT *` in something you will keep.** It is fine while exploring. It is a liability in a saved query, because the shape of your result changes when someone adds a column.

### TOP — the difference that matters

This is the syntax difference the job description implicitly cares about, and the one that catches people out:

```sql title="top-vs-limit.sql"
-- MySQL / PostgreSQL
-- SELECT * FROM Orders ORDER BY OrderDate DESC LIMIT 10;

-- T-SQL
SELECT TOP (10) *
FROM   SalesLT.SalesOrderHeader
ORDER BY OrderDate DESC;
```

`TOP` goes **immediately after `SELECT`**, before the column list. `LIMIT` goes at the **end**. That is not just cosmetic — it changes how you build a query incrementally. In Postgres you append `LIMIT 10` to a finished query; in T-SQL you have to go back to the top.

:::hint{type=warning}
`TOP` without `ORDER BY` is non-deterministic. `SELECT TOP (10) * FROM dbo.Transactions` returns *ten arbitrary rows* — whichever ten the engine finds first. It will look stable in testing and then change when an index changes. Always pair `TOP` with `ORDER BY` when the identity of the rows matters.
:::

The parentheses around the number are optional for a literal (`TOP 10` works) but required for a variable or expression, and Microsoft's own style guide uses them everywhere. Use them.

There is also `OFFSET … FETCH`, the ANSI-standard pagination syntax, and what you want for "page 3 of results":

```sql title="pagination.sql"
SELECT   CreatedAtUtc, TransactionId, Amount, Status
FROM     dbo.Transactions
ORDER BY CreatedAtUtc DESC
OFFSET   40 ROWS
FETCH    NEXT 20 ROWS ONLY;
```

`OFFSET … FETCH` requires an `ORDER BY`. The engine enforces it, which is a small kindness.

```quiz
question: Which statement returns the ten most recent orders, deterministically?
options:
  - "SELECT * FROM SalesLT.SalesOrderHeader LIMIT 10"
  - "SELECT TOP (10) * FROM SalesLT.SalesOrderHeader"
  - "SELECT TOP (10) * FROM SalesLT.SalesOrderHeader ORDER BY OrderDate DESC"
  - "SELECT * FROM SalesLT.SalesOrderHeader ORDER BY OrderDate DESC LIMIT 10"
answer: 2
explanation: LIMIT is not T-SQL syntax at all, and TOP without ORDER BY returns an arbitrary set of rows. Only TOP combined with ORDER BY is both valid T-SQL and deterministic.
```

### Filtering carefully

```sql title="where-patterns.sql"
-- Ranges: BETWEEN is inclusive on both ends
WHERE Amount BETWEEN 100 AND 500

-- Sets
WHERE FailureCode IN ('GATEWAY_TIMEOUT', 'CARD_DECLINED')

-- Pattern matching. Leading wildcards prevent index seeks — note it, do not fear it.
WHERE LastName LIKE 'Sm%'

-- NULL is not a value; it is the absence of one. = NULL is never true.
WHERE FailureCode IS NULL
```

:::hint{type=danger}
`WHERE FailureCode = NULL` returns **zero rows**, always, even for the 192,000 rows where `FailureCode` genuinely is null. `NULL` compared to anything — including `NULL` — evaluates to *unknown*, not *true*. Use `IS NULL` / `IS NOT NULL`. This bug is silent, which is what makes it dangerous: your query runs, returns nothing, and you conclude the data is missing.
:::

### Dates, the support engineer's constant companion

Almost every real support query is time-bounded. "Show me what happened in the last 24 hours" is the job. This is what the seeded table is for — `SalesLT` alone cannot teach it.

```sql title="date-filters.sql"
-- Last 7 days, relative to now
SELECT   TOP (100) *
FROM     dbo.Transactions
WHERE    CreatedAtUtc >= DATEADD(DAY, -7, SYSUTCDATETIME())
ORDER BY CreatedAtUtc DESC;

-- Prefer half-open ranges for whole days: >= start AND < next day.
-- This avoids the classic "misses rows timestamped 23:59:59.997" bug.
WHERE CreatedAtUtc >= '2025-06-01'
  AND CreatedAtUtc <  '2025-06-02'
```

:::hint{type=tip}
Use `SYSUTCDATETIME()` rather than `GETDATE()`. Azure SQL runs in **UTC regardless of the region you picked** — `GETDATE()` on your database does not return your local time, and mixing the two produces off-by-hours bugs that only appear for some customers. Seeding the lab table in UTC is deliberate for the same reason.
:::

## A note on how to read query results

When you run a query, look at three places, not one:

1. **The results grid** — the data.
2. **The Messages tab** — row counts, warnings, and anything `PRINT`ed.
3. **The status bar** — execution time and rows returned.

Get in the habit now. On Day 4 we add a fourth: the execution plan.

## Exercise

:::checklist{title="Day 1 checklist"}
- [ ] Azure SQL Database created on the free offer, with `Sample` (AdventureWorksLT) selected at creation
- [ ] Budget alert set on the subscription
- [ ] Your client IP added to the logical server firewall
- [ ] SSMS installed and connected
- [ ] Azure Data Studio installed and connected to the same database
- [ ] Ran the `sys.partitions` query and identified the three largest tables in `SalesLT`
- [ ] Ran `lab-seed.sql`; confirmed ~200,900 rows in `dbo.Transactions`
- [ ] Confirmed `USE supportlab;` fails, and found the database dropdown instead
- [ ] Wrote a query using `TOP` + `ORDER BY` and confirmed the result changes when you flip `ASC`/`DESC`
- [ ] Wrote a query using `IS NULL` and confirmed `= NULL` returns nothing
- [ ] Saved every query to a folder you will turn into a Git repo on Day 5
:::

### Stretch problems

Write each of these. Do not look up the answer until you have tried.

1. The 20 most expensive line items on any order, showing product ID, order ID and line total. (`SalesLT.SalesOrderDetail`)
2. Every customer whose last name starts with `Sa`, sorted by first name.
3. Every product still on sale — `SellEndDate IS NULL` — priced above 1,000, most expensive first.
4. The exact row count of `dbo.Transactions` — then get an *approximate* count without scanning the table, and compare how long each takes.

:::details{summary="Hint for #4"}
You already ran it. `sys.partitions` carries a maintained `rows` value for the heap or clustered index (`index_id IN (0,1)`). It is approximate, but it is instant even on a billion-row table — which is why it is the right tool when a customer asks "how big is this table?" mid-incident. Compare with `SELECT COUNT(*) FROM dbo.Transactions` and turn on `SET STATISTICS IO ON` to see the difference in pages read.
:::

## Where this is going

Tomorrow: joins. The single most common source of both wrong answers and slow queries in support work, and the topic most likely to be probed in a technical screen. `SalesLT` is small enough that you can verify every join result by eye, which is precisely why it is a good place to learn them.
