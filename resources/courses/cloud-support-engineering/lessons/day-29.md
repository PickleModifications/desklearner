---
title: Buffer & Certification Exam Day
summary: Sit an exam if you are ready, catch up if you are not. Either way, a deliberate consolidation day rather than a lost one.
minutes: 120
objectives:
  - Sit AWS Cloud Practitioner and/or AZ-900 if practice scores support it
  - Alternatively, close the specific gaps identified on Days 14 and 28
  - Verify the whole Week 1–4 toolchain still works end to end
  - Enter Week 5's project work with no loose ends
keyTerms:
  - term: Online proctored exam
    definition: An exam taken at home with remote monitoring via webcam and screen share. Requires a clear desk and a stable connection.
  - term: Spaced repetition
    definition: Reviewing material at increasing intervals. Substantially more efficient than massed review for long-term retention.
  - term: Interleaving
    definition: Mixing topics during practice rather than blocking them. Feels harder, transfers better.
resources:
  - label: Pearson VUE — online proctored exam requirements (AWS)
    url: https://www.aws.training/certification
  - label: Schedule a Microsoft certification exam
    url: https://learn.microsoft.com/en-us/credentials/certifications/schedule-through-pearson-vue
---

A buffer day. That is not slack — it is the day that absorbs the slippage every plan accumulates, and using it deliberately is the difference between finishing Week 6 on schedule and finishing it two weeks late.

Pick one of three tracks.

## Track A — Sit an exam

If your Day 14 or Day 28 practice score was 80% or above.

### Before

:::checklist{title="Exam-day preparation"}
- [ ] Booked, with the time and time zone confirmed
- [ ] For online proctored: quiet room, clear desk, ID ready, system check completed **in advance**
- [ ] For a test centre: route planned, arrive 30 minutes early, photo ID
- [ ] Slept properly. This matters more than an extra hour of revision
- [ ] Do **not** cram in the two hours beforehand — it raises anxiety and does not raise scores
:::

:::hint{type=warning}
Online proctored exams have strict environment rules: no second monitor, no phone, no paper, no food, nobody entering the room. Run the system check the **day before**, not fifteen minutes before. Failing the check on the day usually means forfeiting the booking.
:::

### During

- Read the **last sentence first**. It contains the actual question and the qualifier.
- Eliminate obviously wrong options before choosing between the plausible ones.
- Flag and move on. Both exams allow review.
- Watch for "select TWO" — a partially correct multiple-response answer scores zero.
- Answer everything. There is no penalty for a wrong answer.

### After

Both AWS and Microsoft give a provisional result immediately. Whatever it says, write down three questions you were unsure of and look them up while they are fresh — that is real learning either way.

:::hint{type=success}
If you pass: add it to LinkedIn and your CV today, with the credential ID. If you fail: it is a data point, not a verdict. Both exams can be retaken (AWS after 14 days, Microsoft after 24 hours for the first retake). Review the score report's domain breakdown and target the weak one.
:::

## Track B — Close the gaps

If your practice score was below 80%, or you postponed the exam.

Work from your Day 14 and Day 28 review documents. Rank your weak areas and spend two focused hours on the top two — not a general re-read.

Effective, in rough order:

:::steps

1. **Retrieval practice.** Close the notes and write out what you know. The gaps are the study list. Uncomfortable and highly effective.

2. **Teach it.** Write a one-page explanation as though for a colleague. If you cannot write it clearly, you do not understand it yet.

3. **Interleave.** Mix AWS and Azure questions rather than blocking them. It feels harder because it forces you to *identify* which model applies — which is exactly what the exam and the job require.

4. **Build, do not read.** For a weak service, spend twenty minutes deploying and deleting one. Concrete beats abstract every time.

:::

Common gaps at this point, with quick fixes:

| Gap | Twenty-minute fix |
|---|---|
| Service name recall | Flashcards from this course's key terms — the app generates them |
| Pricing models | Write both clouds' options side by side in one table |
| Shared responsibility | Write out who owns what for IaaS, PaaS, SaaS |
| Networking | Draw a VPC and a VNet from memory; label every component |
| Identity | Write the Entra roles vs Azure RBAC distinction with two examples |
| Cost tools | Pricing vs TCO calculator vs Cost Management vs Advisor |

## Track C — Verify the toolchain

Regardless of track, spend thirty minutes proving everything still works. Four weeks of labs accumulate rot — expired credentials, deleted resources, broken scripts.

:::checklist{title="Toolchain verification"}
- [ ] SQL Server running; `SELECT @@VERSION` returns
- [ ] SSMS and Azure Data Studio both connect
- [ ] AdventureWorks queryable
- [ ] `git status` clean; `git push` works
- [ ] CI pipeline green on `main`
- [ ] `aws sts get-caller-identity` returns your identity
- [ ] `az account show` returns your subscription
- [ ] `docker run hello-world` works
- [ ] Python environment has `requests`, `jsonschema`, `pytest`, `pyodbc`
- [ ] Your JSON Schema validation script still passes
- [ ] **AWS and Azure bills both near zero** — check Cost Explorer and Cost Management
:::

:::hint{type=danger}
Check both bills properly today. Four weeks of labs is exactly long enough to have left a NAT gateway, an RDS instance, an Elastic IP or a Container Apps environment running. Look at the **service breakdown**, not just the total — a small total can hide something that will grow.

```bash
aws ce get-cost-and-usage --time-period Start=$(date -d '30 days ago' +%F),End=$(date +%F) \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE --output table

az consumption usage list --start-date $(date -d '30 days ago' +%F) --end-date $(date +%F) \
  --query "[].{Service:meterDetails.meterCategory, Cost:pretaxCost}" --output table
```
:::

## Prepare for tomorrow

Tomorrow you design the project that will carry the interview. Two things will make it go faster:

:::steps

1. **Re-read the job description.** Not skim — read it with a pen. Underline every named tool, every named responsibility. Tomorrow's design should map onto it.

2. **List what you have already built.** Across four weeks you have: SQL queries and a schema, Python log parsing and API scripts, JSON Schemas with a test suite, a CI pipeline, a Lambda or Function, structured logging, alarms, a runbook, and a container. Project #2 mostly *assembles* these rather than starting fresh — recognising that is what makes it achievable in three days.

:::

```quiz
question: Your practice exam score is 72% and you have a buffer day. What is the most useful use of it?
options:
  - Book and sit the exam anyway — a fail is a useful data point
  - Re-read the entire course material from the beginning
  - Target the two weakest domains identified in your review, using retrieval practice and hands-on work
  - Skip ahead and start the project early
answer: 2
explanation: 72% is close enough that targeted work on identified gaps is likely to be decisive, and you already have the diagnosis from your review documents. A general re-read is inefficient, and sitting an exam you are likely to fail costs money and momentum.
```

## Exercise

:::checklist{title="Day 29 checklist"}
- [ ] Track chosen and completed: exam sat, gaps closed, or both
- [ ] Toolchain verification completed
- [ ] Both cloud bills checked, with the service breakdown reviewed
- [ ] Any orphaned resources deleted
- [ ] Job description re-read with annotations
- [ ] Inventory written of everything built in Weeks 1–4, in `docs/inventory.md`
- [ ] Repository tidy: no stray branches, README current, CI green
:::

:::details{summary="An inventory template — you will reuse this for your CV"}
```markdown
# What I have built — Weeks 1 to 4

## SQL Server / T-SQL
- 20 diagnostic queries in `sql/queries/`, including window functions and anti-joins
- Schema with keys, constraints and indexes in `sql/schema/`
- Execution plan analysis: turned a clustered index scan into a seek, N logical reads → M

## Python
- Streaming log parser handling 100k JSON-lines events, with unparsed-line accounting
- CLI with argparse, exit codes, and both human and JSON output
- API client with timeouts, exponential backoff, Retry-After handling and pagination
- Parameterised SQL Server access via pyodbc

## JSON Schema
- Ticket schema with formats, enums, nested objects and $ref reuse
- Valid and invalid example corpus; parametrised pytest suite
- Schema validation enforced as a CI gate

## Git / CI/CD
- Protected repository with PR template, CODEOWNERS and required checks
- GitHub Actions: matrix tests, caching, artifacts, secret scanning
- Deploy workflow using OIDC — no stored cloud credentials
- git bisect used to locate an injected regression

## AWS
- EC2 + nginx, S3 static site, IAM least-privilege user with verified boundary
- Lambda behind API Gateway; DynamoDB / RDS SQL Server
- CloudWatch structured logs, EMF metrics, error-rate and low-traffic alarms

## Azure
- VM, Blob Storage with user-delegation SAS, Azure Function, App Service with slots
- Entra ID users, dynamic groups, conditional access in report-only, sign-in log triage
- Log Analytics + Application Insights; 10 saved KQL queries

## Containers
- Multi-stage Dockerfile, non-root, healthcheck, ~130 MB image
- docker compose with SQL Server 2022 and a healthcheck gate
- Image pushed to a private registry and deployed to a managed platform from CI

## Operations
- Runbook for the ingest service, tested by breaking it deliberately
- Post-mortem for the self-inflicted incident
```

That document is a CV, a portfolio README and an interview crib sheet at the same time. Keep it current.
:::

## Where this is going

Tomorrow: design Project #2. A tool that ingests support tickets as schema-validated JSON, stores them in SQL, and exposes a query interface — which is, more or less, a miniature of the job itself.
