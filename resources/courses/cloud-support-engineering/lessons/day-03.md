---
title: Aggregation, Grouping & Subqueries
summary: GROUP BY, HAVING and the aggregate functions — then the real skill, which is turning a vague customer complaint into a precise, time-bounded query.
minutes: 100
objectives:
  - Use COUNT, SUM, AVG, MIN and MAX correctly, including the COUNT(*) vs COUNT(column) distinction
  - Explain the difference between WHERE and HAVING and where each sits in the logical processing order
  - Write correlated and non-correlated subqueries, and know when a CTE reads better
  - Translate a support ticket into a precise diagnostic query
  - Use window functions for "top N per group" questions
keyTerms:
  - term: Aggregate function
    definition: A function that collapses many rows into one value — COUNT, SUM, AVG, MIN, MAX.
  - term: HAVING
    definition: A filter applied after GROUP BY, able to reference aggregates. WHERE cannot, because it runs before grouping.
  - term: CTE
    definition: Common Table Expression. A named temporary result set defined with WITH, used to give a subquery a name and make queries readable top to bottom.
  - term: Correlated subquery
    definition: A subquery that references a column from the outer query, so it is conceptually evaluated once per outer row.
  - term: Window function
    definition: A function that computes across a set of rows related to the current row without collapsing them, using OVER (PARTITION BY … ORDER BY …).
resources:
  - label: Microsoft Learn — GROUP BY
    url: https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql
  - label: Microsoft Learn — OVER clause
    url: https://learn.microsoft.com/en-us/sql/t-sql/queries/select-over-clause-transact-sql
---

Yesterday's joins get you the right rows. Today gets you the right *number*. Aggregation is where support queries become answers: not "here are 40,000 transactions" but "here are the three customers responsible for 80% of yesterday's failures."

## Logical processing order

Before the syntax, internalise this. SQL is written in one order and evaluated in another:

```mermaid
flowchart TD
  F["1 · FROM / JOIN<br/><i>build the row set</i>"] --> W["2 · WHERE<br/><i>filter individual rows</i>"]
  W --> G["3 · GROUP BY<br/><i>collapse into groups</i>"]
  G --> H["4 · HAVING<br/><i>filter groups</i>"]
  H --> S["5 · SELECT<br/><i>compute output columns</i>"]
  S --> D["6 · DISTINCT"]
  D --> O["7 · ORDER BY"]
  O --> T["8 · TOP / OFFSET-FETCH"]
```

Almost every confusing error message in T-SQL is explained by this diagram:

- *"Invalid column name 'Revenue'"* in a `WHERE` clause → you defined `Revenue` as an alias in `SELECT` (step 5), but `WHERE` runs at step 2. It does not exist yet.
- *"Column is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause"* → step 3 collapsed the rows; a non-grouped column no longer has a single value.
- You *can* use a `SELECT` alias in `ORDER BY`, because `ORDER BY` is step 7, after `SELECT`.

## The aggregate functions

```sql title="aggregates.sql"
SELECT COUNT(*)               AS TotalRows,
       COUNT(ShipDate)        AS RowsWithShipDate,   -- NULLs are NOT counted
       COUNT(DISTINCT CustomerID) AS UniqueCustomers,
       SUM(TotalDue)          AS Revenue,
       AVG(TotalDue)          AS AverageOrder,
       MIN(OrderDate)         AS FirstOrder,
       MAX(OrderDate)         AS LatestOrder
FROM   Sales.SalesOrderHeader;
```

:::hint{type=warning}
`COUNT(*)` counts rows. `COUNT(column)` counts **non-NULL values** in that column. The difference between those two numbers is exactly the count of NULLs, which makes it a one-line data-quality check:

```sql
SELECT COUNT(*) - COUNT(ShipDate) AS UnshippedOrders
FROM   Sales.SalesOrderHeader;
```
:::

`AVG` also ignores NULLs, which is usually what you want but occasionally is not. If a NULL means "zero" in your domain, `AVG(col)` and `AVG(ISNULL(col, 0))` give different answers, and only one of them is right.

`SUM` of an `INT` column can overflow. `SUM(CAST(Quantity AS BIGINT))` costs nothing and prevents an arithmetic overflow error at 3am.

## GROUP BY

```sql title="group-by.sql"
SELECT   YEAR(soh.OrderDate)  AS OrderYear,
         MONTH(soh.OrderDate) AS OrderMonth,
         COUNT(*)             AS OrderCount,
         SUM(soh.TotalDue)    AS Revenue
FROM     Sales.SalesOrderHeader AS soh
WHERE    soh.OrderDate >= '2013-01-01'
GROUP BY YEAR(soh.OrderDate), MONTH(soh.OrderDate)
ORDER BY OrderYear, OrderMonth;
```

Rule: **every column in `SELECT` must either be in `GROUP BY` or wrapped in an aggregate.** No exceptions in T-SQL (unlike MySQL, which historically allowed it and produced arbitrary values — another dialect difference worth knowing).

### WHERE vs HAVING

```sql title="where-vs-having.sql"
SELECT   c.CustomerID,
         COUNT(*)          AS OrderCount,
         SUM(o.TotalDue)   AS Spend
FROM     Sales.SalesOrderHeader AS o
JOIN     Sales.Customer AS c ON c.CustomerID = o.CustomerID
WHERE    o.OrderDate >= '2013-01-01'      -- filters rows, before grouping
GROUP BY c.CustomerID
HAVING   COUNT(*) >= 5                     -- filters groups, after grouping
     AND SUM(o.TotalDue) > 10000
ORDER BY Spend DESC;
```

The practical guidance: **if the condition could be checked by looking at a single row, it belongs in `WHERE`.** `WHERE` runs first, so it reduces the volume the grouping has to chew through — it is both more correct and faster.

```quiz
question: You want customers whose 2013 spend exceeds £10,000. Where does the OrderDate filter go, and where does the spend filter go?
options:
  - Both in WHERE
  - Both in HAVING
  - OrderDate in WHERE, spend in HAVING
  - OrderDate in HAVING, spend in WHERE
answer: 2
explanation: OrderDate is a property of an individual row, so it filters before grouping in WHERE. Total spend is an aggregate that only exists after GROUP BY, so it must be filtered in HAVING.
```

## Subqueries

### Scalar subquery — returns one value

```sql title="scalar-subquery.sql"
SELECT   soh.SalesOrderID,
         soh.TotalDue,
         (SELECT AVG(TotalDue) FROM Sales.SalesOrderHeader) AS OverallAverage
FROM     Sales.SalesOrderHeader AS soh
WHERE    soh.TotalDue > (SELECT AVG(TotalDue) FROM Sales.SalesOrderHeader);
```

### Correlated subquery — references the outer row

```sql title="correlated.sql"
-- Orders that are the largest that customer has ever placed
SELECT o.SalesOrderID, o.CustomerID, o.TotalDue
FROM   Sales.SalesOrderHeader AS o
WHERE  o.TotalDue = (
         SELECT MAX(inner_o.TotalDue)
         FROM   Sales.SalesOrderHeader AS inner_o
         WHERE  inner_o.CustomerID = o.CustomerID   -- the correlation
       );
```

Correlated subqueries are conceptually a loop. The optimiser usually rewrites them into something smarter, but if you see one running slowly over millions of rows, that is your first suspect.

### CTEs — subqueries with names

```sql title="cte.sql"
WITH CustomerSpend AS (
    SELECT   CustomerID,
             COUNT(*)        AS OrderCount,
             SUM(TotalDue)   AS Spend
    FROM     Sales.SalesOrderHeader
    WHERE    OrderDate >= '2013-01-01'
    GROUP BY CustomerID
),
Ranked AS (
    SELECT *,
           NTILE(4) OVER (ORDER BY Spend DESC) AS Quartile
    FROM   CustomerSpend
)
SELECT   Quartile,
         COUNT(*)      AS Customers,
         SUM(Spend)    AS TotalSpend
FROM     Ranked
GROUP BY Quartile
ORDER BY Quartile;
```

:::hint{type=tip}
Prefer CTEs over nested subqueries once you have more than one level. A query you can read top-to-bottom is a query you can debug at 3am. You can also `SELECT * FROM CustomerSpend` on its own to check an intermediate step — just comment out the rest.
:::

## Window functions: top N per group

"Show me the three most recent failed transactions **for each customer**" cannot be done with `GROUP BY` alone, because grouping collapses the rows you want to see. This is the canonical window-function problem.

```sql title="top-n-per-group.sql"
WITH Ranked AS (
    SELECT   o.CustomerID,
             o.SalesOrderID,
             o.OrderDate,
             o.TotalDue,
             ROW_NUMBER() OVER (
                 PARTITION BY o.CustomerID
                 ORDER BY     o.OrderDate DESC
             ) AS rn
    FROM     Sales.SalesOrderHeader AS o
)
SELECT CustomerID, SalesOrderID, OrderDate, TotalDue
FROM   Ranked
WHERE  rn <= 3
ORDER BY CustomerID, rn;
```

`PARTITION BY` is "restart the numbering for each of these." `ORDER BY` inside `OVER` decides what "first" means.

Three ranking functions worth knowing the difference between, because it is a standard interview question:

| Function | Ties | Gaps after ties |
|---|---|---|
| `ROW_NUMBER()` | Broken arbitrarily — always 1, 2, 3 | n/a |
| `RANK()` | Share a rank — 1, 1, 3 | Yes |
| `DENSE_RANK()` | Share a rank — 1, 1, 2 | No |

Running totals use the same mechanism:

```sql title="running-total.sql"
SELECT   OrderDate,
         TotalDue,
         SUM(TotalDue) OVER (ORDER BY OrderDate
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningTotal
FROM     Sales.SalesOrderHeader
WHERE    CustomerID = 29825
ORDER BY OrderDate;
```

## The real skill: ticket → query

A support ticket says:

> *"Customer 29825 says their payments have been failing since Tuesday. Can you check?"*

That is not a query. Turning it into one means making four decisions explicit:

:::steps

1. **Which entity?** Customer 29825 — is that a `CustomerID`, an account number, or an external reference? Confirm before you filter on it.

2. **What is a "failure"?** A status column? An error code? A missing downstream record? "Failed" is domain vocabulary, not a schema column. Find the actual representation.

3. **What time window?** "Since Tuesday" is ambiguous — which Tuesday, and in which timezone? Widen it: last 10 days, so you can see the *before* as well as the *after*.

4. **What does "normal" look like?** A count of failures is meaningless without the success count next to it. Three failures out of three is an outage; three out of three thousand is noise.

:::

Here is the query that actually answers it:

```sql title="incident-triage.sql"
DECLARE @CustomerId INT = 29825;
DECLARE @Since DATETIME2 = DATEADD(DAY, -10, SYSUTCDATETIME());

-- 1. Shape of the problem: failures vs successes per day
SELECT   CAST(t.CreatedAtUtc AS DATE)                                AS [Day],
         SUM(CASE WHEN t.Status = 'Failed'    THEN 1 ELSE 0 END)     AS Failed,
         SUM(CASE WHEN t.Status = 'Succeeded' THEN 1 ELSE 0 END)     AS Succeeded,
         COUNT(*)                                                    AS Total
FROM     dbo.Transactions AS t
WHERE    t.CustomerId   = @CustomerId
  AND    t.CreatedAtUtc >= @Since
GROUP BY CAST(t.CreatedAtUtc AS DATE)
ORDER BY [Day];

-- 2. What is the actual error? Group by reason, most common first.
SELECT   t.FailureCode,
         t.FailureReason,
         COUNT(*)             AS Occurrences,
         MIN(t.CreatedAtUtc)  AS FirstSeen,
         MAX(t.CreatedAtUtc)  AS LastSeen
FROM     dbo.Transactions AS t
WHERE    t.CustomerId   = @CustomerId
  AND    t.CreatedAtUtc >= @Since
  AND    t.Status       = 'Failed'
GROUP BY t.FailureCode, t.FailureReason
ORDER BY Occurrences DESC;

-- 3. Is it only this customer? If not, it is an incident, not a support ticket.
SELECT   COUNT(DISTINCT t.CustomerId) AS AffectedCustomers,
         COUNT(*)                     AS FailureCount
FROM     dbo.Transactions AS t
WHERE    t.CreatedAtUtc >= @Since
  AND    t.Status       = 'Failed'
  AND    t.FailureCode  = 'GATEWAY_TIMEOUT';
```

:::hint{type=tip}
Query 3 is the one that separates a support engineer from someone who can write SQL. **Always check the blast radius.** If one customer is affected, it is a configuration or data problem. If two hundred are, you should be escalating, not investigating.
:::

`SUM(CASE WHEN … THEN 1 ELSE 0 END)` is the conditional-aggregation idiom. It lets you produce several differently-filtered counts in a single pass over the data instead of running three queries. Learn it; you will type it weekly.

## Exercise

:::checklist{title="Day 3 drills"}
- [ ] Orders per month for 2013, with revenue, sorted chronologically
- [ ] Customers with more than 5 orders, showing count and total spend
- [ ] The single largest order per territory (window function)
- [ ] Products whose average review rating is below 3, with the review count
- [ ] Count of NULL `ShipDate` rows, computed with `COUNT(*) - COUNT(col)`
- [ ] A conditional-aggregation query producing three status counts in one pass
- [ ] Running total of daily revenue across a month
- [ ] Rewrite one of your nested subqueries as a CTE and confirm the results match
- [ ] Write the three-query incident-triage set above against AdventureWorks tables of your choosing
:::

:::details{summary="Common mistake: HAVING without GROUP BY"}
`HAVING` without `GROUP BY` is legal — it treats the whole result as one group:

```sql
SELECT COUNT(*) FROM Sales.SalesOrderHeader HAVING COUNT(*) > 1000;
```

This returns the count if it exceeds 1000, and no rows otherwise. Occasionally useful for assertions in scripts. Usually a sign someone meant `WHERE`.
:::

## Where this is going

Tomorrow: how the data is *stored* — keys, normalisation, indexes — and how to read an execution plan in SSMS so that "the query is slow" becomes a diagnosis instead of a complaint.
