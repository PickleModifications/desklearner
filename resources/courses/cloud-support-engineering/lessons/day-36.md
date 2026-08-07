---
title: Portfolio & Résumé Update
summary: Make five weeks of work legible to someone who will spend ninety seconds on it. Repository presentation, a résumé that survives keyword filtering without lying, and a LinkedIn profile that matches.
minutes: 110
objectives:
  - Present both projects so a reader understands them without running anything
  - Write résumé bullets with concrete, verifiable outcomes
  - Cover every tool named in the job description honestly
  - Align your LinkedIn profile with your résumé and your repositories
  - Produce a short, specific covering note
keyTerms:
  - term: Applicant Tracking System
    definition: Software that parses and filters CVs before a human reads them. Rewards plain formatting and exact terminology.
  - term: Keyword alignment
    definition: Using the same words as the job description for skills you genuinely have. Not keyword stuffing.
  - term: Impact bullet
    definition: A résumé line stating what you did and what changed as a result, ideally with a number.
  - term: Portfolio README
    definition: The landing page of a repository. The main thing a hiring manager will actually read.
resources:
  - label: GitHub profile README documentation
    url: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme
  - label: Google — technical résumé tips
    url: https://www.google.com/about/careers/applications/how-we-hire/
---

You have done the work. Today is about making it **findable and legible**, which is a separate skill and one that quietly determines whether the work gets seen at all.

Assume a hiring manager gives your repository **ninety seconds**. Design for that.

## Repository presentation

### Both repositories need

:::checklist{title="Repository essentials"}
- [ ] A clear, descriptive name — `support-ticket-ingestion`, not `project2`
- [ ] A one-line description and topic tags on the GitHub repo page
- [ ] README opening with **what it does** and an architecture diagram
- [ ] The "why it is built this way" decisions table from Day 33
- [ ] Working local setup instructions someone could actually follow
- [ ] Green CI badge — and CI that is genuinely green
- [ ] A LICENSE file (MIT is fine)
- [ ] Clean commit history; no `WIP` or `asdf` commits on `main`
- [ ] No secrets, no `.env`, no connection strings anywhere in history
:::

:::hint{type=danger}
Check your history for secrets properly before making anything public. Deleting a file in a later commit does **not** remove it from history.

```bash
pip install detect-secrets
detect-secrets scan --all-files
gitleaks detect --source . --verbose
```

If you find one: **rotate the credential first**, then clean history with `git filter-repo` or BFG. Assume anything ever pushed to a public repository is compromised, even if the repo was public for four minutes — automated scanners are that fast.
:::

### The GitHub profile README

A special repository named after your username renders on your profile page. Most candidates do not have one.

```markdown title="README.md (in a repo named after your username)"
### Cloud support engineering — SQL Server, Python, AWS & Azure

I work on the diagnostic side of cloud systems: making them tell you what is
wrong before a customer has to.

**Recent work**

| Project | What it demonstrates |
|---|---|
| [Support ticket ingestion](link) | JSON Schema validation, idempotent T-SQL persistence, containerised deploy on Azure Container Apps, structured logging, alarms and a tested runbook |
| [Cloud support engineering lab](link) | 20 diagnostic T-SQL queries, Python log parsing and API clients, CI/CD with OIDC, AWS and Azure infrastructure |

**Tools** T-SQL · SSMS · Azure Data Studio · Python · JSON Schema · Git ·
GitHub Actions · Docker · AWS (EC2, S3, Lambda, IAM, CloudWatch) ·
Azure (Container Apps, SQL, Entra ID, Monitor, KQL)

**Certifications** AWS Cloud Practitioner · Microsoft Azure Fundamentals (AZ-900)
```

:::hint{type=tip}
Note the framing: *"making them tell you what is wrong before a customer has to."* That is a point of view, not a list of technologies, and it is what makes a profile memorable. Write one sentence about what you care about, then let the table do the rest.
:::

### Pin the right repositories

GitHub lets you pin six. Pin **two or three good ones**, not six mediocre ones. A profile with three polished repositories reads better than one with twelve, most of which are abandoned tutorials.

## The résumé

### Format

Plain, parseable, boring. Applicant Tracking Systems mangle columns, text boxes, tables and icons.

- **Single column.** No sidebars.
- **Standard headings**: Experience, Projects, Skills, Education, Certifications.
- **PDF**, exported from a word processor, with selectable text.
- **Standard fonts.** No graphics, no photo, no skill-rating bars.
- **Two pages maximum**; one if you are early-career.
- **Filename**: `Firstname-Lastname-CV.pdf`.

### Skills section — mirror the job description

The job description named specific tools. List those exact terms, grouped, for things you genuinely have.

```text
DATABASES        SQL Server, T-SQL, Azure SQL, query optimisation, execution plans,
                 schema design, indexing, SSMS, Azure Data Studio
LANGUAGES        Python (requests, jsonschema, pytest, pyodbc), T-SQL, Bash, KQL
DATA CONTRACTS   JSON Schema (draft 2020-12), contract testing, API versioning
CLOUD — AWS      EC2, S3, Lambda, API Gateway, RDS, DynamoDB, IAM, VPC, CloudWatch
CLOUD — AZURE    Container Apps, App Service, Functions, Azure SQL, Blob Storage,
                 Microsoft Entra ID, Azure Monitor, Log Analytics, Bicep
DEVOPS           Git, GitHub Actions, CI/CD, OIDC federation, Docker, Docker Compose
OBSERVABILITY    Structured logging, CloudWatch, Application Insights, KQL,
                 OpenTelemetry, alerting, runbooks, incident response
```

:::hint{type=warning}
**Only list what you can be questioned on.** An interviewer will pick something from this list at random. "I have used it in a personal project" is an entirely acceptable answer; "I don't really know it, I just put it down" is fatal to everything else on the page.

If you used something once for twenty minutes, either leave it off or add it to a clearly-marked "Familiar with" line.
:::

### Project bullets

The formula: **what you built · how · what it demonstrates or achieved.**

```text
SUPPORT TICKET INGESTION SERVICE                        github.com/you/support-tool
Python · FastAPI · SQL Server · JSON Schema · Docker · Azure · GitHub Actions

• Built a ticket ingestion API validating payloads against a published JSON Schema
  and returning field-level errors, so integration failures are self-diagnosable
  by the caller rather than requiring a support round trip.
• Enforced idempotency at the storage layer with a UNIQUE constraint and
  INSERT/catch-2627 rather than MERGE, avoiding the race window of check-then-insert;
  verified with a concurrency test issuing eight simultaneous requests.
• Designed the SQL Server schema with covering indexes derived from the stated
  query patterns; documented every index against the requirement it serves.
• Deployed to Azure Container Apps via GitHub Actions using OIDC federation and
  managed identity — no credentials stored in source, image or CI.
• Instrumented with structured JSON logs, correlation IDs and custom metrics;
  configured three alarms, each mapped to a numbered runbook section.
• Wrote and tested the runbook by deliberately breaking the service in production
  and following it end to end, revising three inaccurate steps.

CLOUD SUPPORT ENGINEERING LAB                           github.com/you/cse-lab
T-SQL · Python · AWS · Azure · Terraform/Bicep · GitHub Actions

• Wrote 20 diagnostic T-SQL queries including window functions, anti-joins and
  conditional aggregation for incident triage patterns.
• Reduced a reporting query from a clustered index scan to a seek by removing a
  non-SARGable predicate, cutting logical reads from 12,400 to 38.
• Built a streaming log parser handling 100k JSON-lines events with explicit
  accounting for unparsed lines.
• Configured a least-privilege AWS IAM policy and verified the boundary with five
  positive and negative access tests plus the IAM Policy Simulator.
```

:::hint{type=success}
"Cutting logical reads from 12,400 to 38" is worth more than a paragraph of adjectives. **Find your numbers**: logical reads, image size, latency percentiles, build time, test counts, lines of log processed. Even modest numbers beat none, because they signal you measured.
:::

### Bullets to avoid

| Weak | Why | Better |
|---|---|---|
| "Familiar with SQL" | Says nothing | "Wrote 20 diagnostic T-SQL queries including window functions and anti-joins" |
| "Used AWS" | Which parts? | "Deployed Lambda behind API Gateway with DynamoDB, instrumented with CloudWatch alarms" |
| "Passionate about technology" | Everyone says this | Delete it |
| "Responsible for monitoring" | Responsible ≠ did | "Configured three alarms with documented runbook actions; tested each by causing the condition" |
| "Team player" | Unverifiable | Show it in a project bullet about code review or a PR template |

### The `resume.yaml` update

If you keep a structured résumé file, update the source rather than only the rendered output:

```yaml title="resume.yaml"
skills:
  databases:
    - SQL Server / T-SQL
    - Azure SQL Database
    - Query optimisation and execution plan analysis
    - Schema design, indexing, normalisation
    - SSMS, Azure Data Studio
  languages:
    - Python
    - T-SQL
    - Bash
    - KQL (Kusto Query Language)
  data_contracts:
    - JSON Schema (draft 2020-12)
    - Contract testing in CI
    - API versioning and compatibility
  cloud_aws: [EC2, S3, Lambda, API Gateway, RDS, DynamoDB, IAM, VPC, CloudWatch]
  cloud_azure: [Container Apps, App Service, Functions, Azure SQL, Blob Storage,
                Microsoft Entra ID, Azure Monitor, Log Analytics, Bicep]
  devops: [Git, GitHub Actions, CI/CD, OIDC federation, Docker, Docker Compose]
  observability: [Structured logging, CloudWatch, Application Insights, KQL,
                  OpenTelemetry, alerting, runbooks, incident response]

certifications:
  - name: AWS Certified Cloud Practitioner
    issuer: Amazon Web Services
    date: 2026-08
  - name: Microsoft Certified — Azure Fundamentals (AZ-900)
    issuer: Microsoft
    date: 2026-08
```

## LinkedIn

It must agree with your résumé. Recruiters check.

:::checklist{title="LinkedIn checklist"}
- [ ] Headline states the role you want, not just what you have done
- [ ] "About" section: three or four sentences, first person, specific
- [ ] Skills section mirrors the résumé's terms
- [ ] Certifications added with credential IDs
- [ ] Projects section links both repositories
- [ ] "Open to work" configured, with the target job titles
- [ ] Location and work preferences set correctly
:::

```text title="Headline"
Cloud Support Engineer · SQL Server & T-SQL · Python · AWS & Azure · CI/CD & Observability
```

```text title="About"
I work on the diagnostic side of cloud systems — the tooling and instrumentation
that make a problem visible before a customer has to report it.

Recently I built a support ticket ingestion service end to end: JSON Schema
validation with field-level error responses, idempotent persistence to SQL Server,
containerised deployment to Azure via GitHub Actions with no stored credentials,
and structured logging with alarms mapped to a runbook I tested by deliberately
breaking the service.

Comfortable across the Microsoft stack (SQL Server, SSMS, Azure Data Studio,
Entra ID, Azure Monitor/KQL) and AWS. Certified in both AWS Cloud Practitioner
and Azure Fundamentals.
```

## The covering note

Short. Specific. Three paragraphs, and never generic.

> Dear [name],
>
> I'm applying for the Cloud Support Engineer role. The posting names SQL Server, SSMS and Azure Data Studio, Python, JSON schemas and Azure AD — those are the specific tools I've spent the last six weeks building with, and I have working examples of each.
>
> The most relevant is a ticket ingestion service I built and deployed: it validates incoming JSON against a published schema and returns field-level errors, so a malformed payload becomes a self-service fix rather than a support round trip. It persists to SQL Server with idempotency enforced at the storage layer, deploys through GitHub Actions with no stored credentials, and has structured logging and alarms mapped to a runbook I tested by deliberately breaking it. It is at [link], and the README explains the design decisions.
>
> I'm also comfortable with the on-call element of the role, and happy to complete the CJIS background check. I'd welcome the chance to talk about what your most common ticket categories are and where the tooling gaps are.
>
> Best regards,
> [name]

:::hint{type=tip}
That last line — asking about their common ticket categories — does two things. It shows you are thinking about their actual work, and it gives them something easy to reply to. Ending with a genuine question converts a broadcast into a conversation.
:::

```quiz
question: Which résumé bullet is strongest for a support engineering role?
options:
  - "Passionate about cloud technologies and eager to learn"
  - "Responsible for database performance monitoring"
  - "Reduced a reporting query from a clustered index scan to a seek by removing a non-SARGable predicate, cutting logical reads from 12,400 to 38"
  - "Extensive experience with SQL Server, Python, AWS, Azure, Docker and Kubernetes"
answer: 2
explanation: It names a specific technique, a specific diagnosis and a measured outcome. It is also verifiable and gives the interviewer an obvious follow-up question you can answer well. The others state enthusiasm, responsibility rather than action, or an unsubstantiated list.
```

## Exercise

:::checklist{title="Day 36 checklist"}
- [ ] Both repositories public, named well, with topics and descriptions
- [ ] Both READMEs open with what it does plus an architecture diagram
- [ ] Secret scan run on both; nothing found (or found, rotated and purged)
- [ ] CI green on both; badges in the READMEs
- [ ] LICENSE added to both
- [ ] Two or three repositories pinned on your profile
- [ ] GitHub profile README written
- [ ] Résumé updated: skills mirroring the job description, project bullets with numbers
- [ ] Every skill listed is one you could be questioned on
- [ ] `resume.yaml` (or equivalent source) updated
- [ ] Résumé exported as a plain, ATS-parseable PDF and named properly
- [ ] LinkedIn headline, About, skills, certifications and projects all updated
- [ ] Covering note drafted for one specific role
- [ ] Ask someone to read the README cold and tell you what the project does — if they cannot, rewrite it
:::

:::details{summary="The ninety-second test"}
Give your repository to someone who has never seen it. Time them. After ninety seconds, ask:

1. What does this do?
2. What technologies does it use?
3. Why did the author make one of the design decisions?
4. Would you want to talk to this person?

If they cannot answer 1 and 2, the README is buried — move the summary and diagram to the very top. If they cannot answer 3, add or surface the decisions table. Question 4 is the one that matters, and it is usually answered by whether the first screen made them feel the author was thoughtful.

Do this test with two different people. It is uncomfortable and it is the highest-return ninety seconds of the week.
:::

## Where this is going

One day left. Tomorrow: a final pass on anything still shaky, verified evidence that everything works, and a clear-eyed look at what you have actually built.
