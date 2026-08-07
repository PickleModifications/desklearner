---
title: "Practice Day: Timed T-SQL & a Protected Repo"
summary: Consolidation. Twenty timed T-SQL problems to make the syntax automatic, then build the repository you will use for the rest of this course — properly protected.
minutes: 90
objectives:
  - Solve T-SQL problems under time pressure without reaching for reference material
  - Identify which SQL topics still need work, honestly
  - Create a GitHub repository with branch protection, a PR template and CODEOWNERS
  - Establish the repo structure the rest of the course builds into
keyTerms:
  - term: Branch protection rule
    definition: A GitHub setting that blocks direct pushes to a branch and enforces reviews and status checks before merge.
  - term: Status check
    definition: An automated result (test run, lint, build) reported against a commit, which branch protection can require to pass.
  - term: Retrieval practice
    definition: Recalling information from memory rather than re-reading it. Far more effective for retention, and considerably less comfortable.
resources:
  - label: GitHub Docs — Managing a branch protection rule
    url: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule
  - label: GitHub Docs — About code owners
    url: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
  - label: SQL practice — StrataScratch / DataLemur / HackerRank SQL
    url: https://www.hackerrank.com/domains/sql
---

No new concepts today. Two jobs: make the SQL automatic, and build the repository that will hold everything you produce over the next five weeks.

## Why timed practice specifically

You already understand joins. That is different from being able to write one without thinking. In a technical screen you will be talking, sharing a screen, and slightly nervous — and the syntax needs to be free so your attention can go to the *problem*.

The mechanism is **retrieval practice**: recalling from memory beats re-reading, by a wide margin, and it feels worse while you do it. Resist looking things up for at least two minutes per problem.

:::hint{type=tip}
Set a visible timer. Ten minutes per problem, hard stop. If you have not solved it, write down *where* you got stuck, move on, and come back at the end. The stuck point is the actual study material.
:::

## Part 1 — Twenty timed problems

All against AdventureWorks. Target: 90 seconds for the first five, three minutes for the middle ten, ten minutes for the last five.

### Warm-up (target: 90 seconds each)

:::checklist{title="Warm-up"}
- [ ] 1. The 10 most recently modified people, showing full name and modified date
- [ ] 2. Count of products per colour, excluding products with no colour
- [ ] 3. All products priced between 100 and 500, most expensive first
- [ ] 4. Distinct job titles in `HumanResources.Employee`, alphabetically
- [ ] 5. Orders placed in December 2013, count only
:::

### Core (target: 3 minutes each)

:::checklist{title="Core"}
- [ ] 6. Each product with its subcategory and category name (three-table join)
- [ ] 7. Products with no subcategory assigned
- [ ] 8. Total revenue per year, with year-over-year row count
- [ ] 9. The 10 customers with the highest lifetime spend
- [ ] 10. Salespeople with no orders in 2013
- [ ] 11. Average order value per territory, territories with fewer than 100 orders excluded
- [ ] 12. Orders where the sum of line totals disagrees with the header `SubTotal`
- [ ] 13. Products that have been ordered more than 500 times in total
- [ ] 14. For each customer, their first and most recent order date, and the gap in days
- [ ] 15. The count of orders per weekday name, most common first
:::

### Stretch (target: 10 minutes each)

:::checklist{title="Stretch"}
- [ ] 16. The three highest-value orders **per territory** (window function)
- [ ] 17. A monthly revenue table with a running cumulative total
- [ ] 18. Customers whose 2013 spend was more than double their 2012 spend
- [ ] 19. Month-over-month revenue change as an absolute figure and a percentage
- [ ] 20. A single query returning, per month: order count, distinct customers, revenue, average order value, and the percentage of orders that shipped late
:::

:::details{summary="Worked answer — #16, top three per territory"}
```sql
WITH Ranked AS (
    SELECT   soh.TerritoryID,
             st.Name AS TerritoryName,
             soh.SalesOrderID,
             soh.TotalDue,
             ROW_NUMBER() OVER (
                 PARTITION BY soh.TerritoryID
                 ORDER BY     soh.TotalDue DESC
             ) AS rn
    FROM     Sales.SalesOrderHeader AS soh
    JOIN     Sales.SalesTerritory   AS st ON st.TerritoryID = soh.TerritoryID
)
SELECT TerritoryName, SalesOrderID, TotalDue
FROM   Ranked
WHERE  rn <= 3
ORDER BY TerritoryName, rn;
```

The pattern — CTE, `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)`, filter on the rank — solves an entire family of questions. Memorise the shape, not this query.
:::

:::details{summary="Worked answer — #20, the kitchen-sink monthly query"}
```sql
SELECT   DATEFROMPARTS(YEAR(soh.OrderDate), MONTH(soh.OrderDate), 1) AS MonthStart,
         COUNT(*)                                    AS Orders,
         COUNT(DISTINCT soh.CustomerID)              AS Customers,
         SUM(soh.TotalDue)                           AS Revenue,
         AVG(soh.TotalDue)                           AS AvgOrderValue,
         100.0 * SUM(CASE WHEN soh.ShipDate > DATEADD(DAY, 7, soh.OrderDate)
                          THEN 1 ELSE 0 END) / COUNT(*) AS PctShippedLate
FROM     Sales.SalesOrderHeader AS soh
GROUP BY DATEFROMPARTS(YEAR(soh.OrderDate), MONTH(soh.OrderDate), 1)
ORDER BY MonthStart;
```

Two details worth stealing: `DATEFROMPARTS` gives a sortable month bucket rather than separate year/month integers, and `100.0 *` forces float division — `100 * 1 / 4` is `0` in integer arithmetic, which is a silent, very common bug.
:::

## Part 2 — Build the course repository

Everything you produce for the rest of this course goes in one repo. Set it up properly now.

:::steps

1. **Create the repository** on GitHub. Name it something a hiring manager will read favourably: `cloud-support-engineering-lab`. Public. Add a README and a `.gitignore` (Python).

2. **Clone and create the structure.**

   ```bash
   git clone https://github.com/YOU/cloud-support-engineering-lab.git
   cd cloud-support-engineering-lab

   mkdir -p sql/{queries,schema} python/{scripts,tests} schemas docs .github/workflows
   ```

3. **Write a real README.** Not "this is my learning repo." Something like:

   ```markdown
   # Cloud Support Engineering Lab

   Working repository for a six-week programme covering SQL Server/T-SQL,
   Python for diagnostics, JSON Schema validation, AWS and Azure, CI/CD,
   and observability.

   ## Layout
   | Path | Contents |
   |---|---|
   | `sql/queries/` | Diagnostic and reporting queries, one file per question |
   | `sql/schema/`  | DDL for the ticket-ingestion project |
   | `python/`      | Log parsing, API clients, schema validation |
   | `schemas/`     | JSON Schema documents |
   | `docs/`        | Architecture notes and incident write-ups |
   ```

4. **Add the PR template** at `.github/pull_request_template.md` — use yesterday's.

5. **Add CODEOWNERS** at `.github/CODEOWNERS`. Solo, this is just you, but the file demonstrates you know the mechanism:

   ```text
   *        @your-username
   *.sql    @your-username
   /python/ @your-username
   ```

6. **Enable branch protection** on `main`: Settings → Branches → Add rule.
   - Require a pull request before merging
   - Require conversation resolution before merging
   - Do not allow bypassing the above settings

   :::hint{type=warning}
   Working solo, requiring an *approval* will lock you out of your own repository, since GitHub will not let you approve your own PR. Require the PR, require conversations resolved, but leave the approval count at zero until someone else is on the repo.
   :::

7. **Commit the day's SQL.** Put your twenty answers in `sql/queries/`, one file per problem, each with a comment header stating the question. Push via a branch and a PR — practise the workflow you just protected.

:::

```quiz
question: You enable "Require a pull request before merging" and "Require 1 approval" on a solo repository. What happens?
options:
  - Nothing changes; you can still merge your own PRs
  - You are locked out of merging, because GitHub will not accept self-approval
  - GitHub automatically approves your PRs after 24 hours
  - Branch protection only applies to other contributors
answer: 1
explanation: GitHub does not allow you to approve your own pull request, so a one-approval requirement on a solo repo blocks every merge. Require the PR itself, and add the approval requirement when a second person joins.
```

## Part 3 — Honest self-assessment

Rate yourself 1–5 on each. Anything at 3 or below gets fifteen minutes tomorrow morning before you start Week 2.

:::checklist{title="Week 1 self-check"}
- [ ] I can write a four-table join without reference material
- [ ] I can explain why a `WHERE` clause can break a `LEFT JOIN`
- [ ] I know when to use `HAVING` instead of `WHERE`, and why
- [ ] I can write a `ROW_NUMBER() OVER (PARTITION BY …)` query from memory
- [ ] I can read an execution plan and identify a scan versus a seek
- [ ] I can explain SARGability with an example
- [ ] I can articulate rebase versus merge, including when each is dangerous
- [ ] I have used `git bisect` on a real (if manufactured) bug
- [ ] I know what to do when I have made a Git mistake I do not understand
:::

:::hint{type=success}
If you got through Week 1, you now have a real database on your machine, twenty working diagnostic queries, and a properly-configured repository with a protected branch. That is more concrete evidence of capability than most candidates bring to an interview.
:::

## Where this is going

Week 2 changes tools. Python — not as an application language but as a diagnostic instrument — then JSON Schema, then your first cloud resources on AWS.
