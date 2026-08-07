# Cloud Development

(SQL Server tooling, Python for support, JSON schemas, Azure AD)

---

## Week 1: SQL Server (T-SQL) + Git

**Day 1 — SQL Server Setup + Fundamentals**
- Install SQL Server Developer Edition (free) or use Azure SQL free tier; install SSMS and Azure Data Studio — get comfortable with both interfaces, since the JD names both
- T-SQL basics: SELECT, WHERE, ORDER BY, TOP (not LIMIT — this is a real syntax difference from MySQL/Postgres)

**Day 2 — Joins**
- INNER, LEFT, RIGHT, FULL joins in T-SQL, using a sample DB (Microsoft's AdventureWorks or WideWorldImporters are the standard practice DBs)
- 15–20 join problems until automatic

**Day 3 — Aggregation & Grouping**
- GROUP BY, HAVING, COUNT/SUM/AVG, subqueries
- Practice writing queries a support engineer would actually run: "find all failed transactions for customer X in the last 7 days"

**Day 4 — Schema Design, Indexes & SSMS Tooling**
- Primary/foreign keys, normalization basics, indexes
- Spend real time in SSMS specifically: Object Explorer, execution plans, the query designer — tool fluency matters here as much as SQL knowledge

**Day 5 — Git Beyond the Basics**
- Branching strategies, rebase vs merge, interactive rebase
- Resolve a deliberately-created merge conflict

**Day 6 (heavier day) — Git Workflows**
- Full PR workflow: branch → commit → PR → review → squash/merge
- git bisect, stash, cherry-pick

**Day 7 — SQL + Git Practice Day**
- Timed T-SQL practice problems
- Set up a repo with branch protection and a PR template

---

## Week 2: Python for Support + JSON Schemas + AWS Start

**Day 8 — Python for Support Engineering**
- Not app-building Python — support-flavored: reading/parsing log files, using the `requests` library to hit an API, writing a small script that pulls and filters data
- This is a different muscle than web dev Python, worth treating as its own day

**Day 9 — JSON Schemas**
- What a JSON schema actually validates and why support teams care (malformed customer payloads, API contract mismatches)
- Use Python's `jsonschema` library: write a schema, validate both passing and failing sample data against it

**Day 10 — Cloud Fundamentals + AWS Setup**
- IaaS/PaaS/SaaS, regions/AZs; AWS Free Tier signup, $1 billing alert
- Start AWS Skill Builder "Cloud Practitioner Essentials"

**Day 11 — Compute (EC2) + Storage (S3)**
- Launch an EC2 instance, SSH in; create an S3 bucket, host a static page

**Day 12 — Networking + AWS IAM**
- VPC/subnet basics; scoped IAM user with least-privilege policy
- (Azure AD gets its own dedicated day in Week 4 — this day stays AWS-only)

**Day 13 (heavier day) — Lambda + Managed Database**
- Deploy a basic Lambda function via API Gateway
- Spin up free-tier RDS (SQL Server option available) or DynamoDB, connect to it — ties back to Week 1

**Day 14 — Cloud Practitioner Practice Exam**
- Full practice exam, review every miss

---

## Week 3: CI/CD + Logging

**Day 15 — CI/CD Concepts**
- Build/test/deploy stages, pipeline vs artifact vs environment promotion

**Day 16 — GitHub Actions**
- Write a workflow from scratch: test on PR, deploy on merge to main

**Day 17 — CI/CD on AWS**
- CodePipeline/CodeBuild conceptually, compare to GitHub Actions

**Day 18 — Logging Fundamentals**
- Structured vs unstructured logging, log levels, why JSON-structured logs matter at scale
- Connect this back to Day 9's JSON schema work — structured logs are just schema-validated JSON in practice

**Day 19 — Cloud-Native Logging & Monitoring**
- CloudWatch Logs + Metrics + Alarms on a deployed project

**Day 20 (heavier day) — Observability Beyond Logs**
- Metrics and traces as the other pillars of observability
- Look at Azure Monitor / Application Insights conceptually, since that's what you'll actually use day-to-day at a Microsoft-stack shop

**Day 21 — Tie It Together**
- Add real logging + an alarm to your project
- Write a short incident-response note: what you'd check first if this broke at 2am — directly relevant to the on-call rotation in the JD

---

## Week 4: Azure Fundamentals + Azure AD/Entra ID + Docker

**Day 22 — Azure Onboarding**
- Azure free account signup; map AWS → Azure equivalents

**Day 23 — Azure Compute, Storage, Functions**
- Deploy a VM, a Blob Storage container, a basic Azure Function

**Day 24 — Azure Active Directory / Entra ID (this is likely what you were thinking of)**
- User and group management, role assignments (RBAC), how SSO and conditional access work at a high level
- This is the Azure equivalent of the IAM day you did in AWS, and it's a near-certain topic if the company runs on Microsoft's stack

**Day 25 — Azure Monitor & Logging**
- Log Analytics, Application Insights — compare directly to your CloudWatch work in Week 3

**Day 26 — Docker Basics**
- Images vs containers, Dockerfile, docker-compose

**Day 27 (heavier day) — Containerize & Deploy**
- Containerize your project, push to ECR or Azure Container Registry, run it

**Day 28 — AZ-900 Practice**
- Microsoft Learn AZ-900 path + practice questions

---

## Week 5: Buffer/Cert + Project #2

**Day 29 — Buffer / Cert Exam**
- Sit AWS Cloud Practitioner and/or AZ-900 if scoring well, or catch up on anything from Weeks 1–4

**Day 30 — Plan Project #2 (support-flavored)**
- Design something that mirrors the actual job: a small tool that ingests support "tickets" (JSON, schema-validated), stores them in SQL Server/Azure SQL, and exposes a simple query interface

**Day 31 — Build Project #2 (part 1)**
- Database schema + ingestion script (this is where the Python + JSON schema + T-SQL work all converge)

**Day 32 — Build Project #2 (part 2)**
- Deploy it, wire up the CI/CD pipeline from Week 3

**Day 33 — Build Project #2 (part 3)**
- Add logging, monitoring, at least one alert; write the README explaining architecture and decisions

**Day 34 — Terminology & Concept Review**
- Drill out loud: T-SQL joins, rebase vs merge, CI vs CD, log levels, Azure AD roles vs AWS IAM, VM vs container vs serverless, what a JSON schema validates

**Day 35 (heavier day) — Mock Interview Prep**
- Draft answers using both projects as examples: "walk me through diagnosing a customer issue," "how would you triage an on-call outage," "explain a time you worked with a JSON schema mismatch"
- Prep a clean, confident answer about CJIS/background check readiness

---

## Week 6: Portfolio Finalization + Buffer

**Day 36 — Portfolio & Resume Update**
- Both projects on GitHub with clear READMEs
- Update resume/resume.yaml: SQL Server/T-SQL, SSMS & Azure Data Studio, Python scripting, JSON schema validation, Git workflows, CI/CD, AWS + Azure (incl. Azure AD), logging/observability

**Day 37 — Final Review / Rest Buffer**
- Anything still shaky gets one more pass
- Otherwise: you're done — two deployed, logged, schema-validated, CI/CD-wired projects and direct tool overlap with the JD

---

## Notes
- Every tool explicitly named in the JD (SSMS, Azure Data Studio, Python, GitHub, JSON schemas) now has dedicated time, not just incidental exposure.
- Azure AD/Entra ID is very likely what you were half-remembering — it's the standard "active directory and user identification" concept in a Microsoft-stack support role.