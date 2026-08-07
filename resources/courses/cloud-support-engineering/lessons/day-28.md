---
title: AZ-900 Practice
summary: The Microsoft Learn AZ-900 path and practice questions, plus the Azure-specific facts most likely to appear and most easily forgotten.
minutes: 90
objectives:
  - Complete the AZ-900 practice assessment under timed conditions
  - Review misses and classify them as on Day 14
  - Consolidate the Azure facts that are pure recall
  - Decide whether to sit AZ-900, AWS Cloud Practitioner, both, or neither
keyTerms:
  - term: AZ-900
    definition: Microsoft Certified Azure Fundamentals. Roughly 40-60 questions, 45 minutes of exam time, pass mark 700/1000.
  - term: Total Cost of Ownership
    definition: Capital plus operating cost over an asset's life. The basis of the cloud economics arguments the exam tests.
  - term: CapEx vs OpEx
    definition: Capital expenditure (buy the asset up front) versus operating expenditure (pay as you consume). Cloud shifts spend from the former to the latter.
  - term: Azure Advisor
    definition: Personalised recommendations across cost, security, reliability, performance and operational excellence.
  - term: Microsoft Purview
    definition: Data governance and compliance across the estate. Appears in the compliance domain.
resources:
  - label: AZ-900 exam page and skills outline
    url: https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/
  - label: Microsoft Learn — Azure Fundamentals learning path (free)
    url: https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/
  - label: AZ-900 official practice assessment (free)
    url: https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/practice/assessment
---

Same structure as Day 14: measure, then review properly. AZ-900 is a shorter and generally easier exam than the AWS Cloud Practitioner, and the Microsoft Learn material is free and good.

## The exam

| | |
|---|---|
| Code | AZ-900 |
| Questions | Roughly 40–60 |
| Time | 45 minutes of question time (65 minutes total seat time) |
| Pass | 700 / 1000 |
| Cost | ~£69 / US$99 |
| Question types | Multiple choice, multiple response, drag and drop, **hot area**, case study |

Three domains:

| Domain | Weight |
|---|---|
| Describe cloud concepts | 25–30% |
| Describe Azure architecture and services | 35–40% |
| Describe Azure management and governance | 30–35% |

:::hint{type=tip}
Microsoft uses question formats AWS does not: **drag-and-drop matching** and **hot area** (select a region of an image). Do the official practice assessment at least once specifically to meet these formats, so the interface is not a surprise on the day.
:::

## Sit the practice assessment

The official practice assessment on Microsoft Learn is free, unlimited, and drawn from the same style bank as the exam.

:::steps

1. **45-minute timer**, no notes, no second tab.
2. Answer everything — no penalty for wrong answers.
3. Flag uncertain questions and note your reasoning in one line.
4. Review flagged items only if time remains.
5. Submit and record the score.

:::

## Review, as on Day 14

For every miss, write the same four things: what you answered, what was correct, why you got it wrong, and the distinction to remember. Then classify: knowledge gap, misread, distractor trap, or careless.

Microsoft's qualifiers point to answers just as consistently as AWS's:

| Qualifier | Usually points to |
|---|---|
| "MINIMAL administrative effort" | PaaS or serverless over IaaS |
| "MINIMISE cost" | Consumption plans, reserved instances, Azure Hybrid Benefit, spot VMs |
| "Ensure compliance with a standard" | Azure Policy (enforce) — not RBAC (who) and not Blueprints (legacy) |
| "Restrict who can do what" | Azure RBAC |
| "Protect against regional outage" | GRS/GZRS storage, paired regions, Traffic Manager / Front Door |
| "Without exposing credentials" | Managed identity, Key Vault |
| "Identify cost savings" | Azure Advisor, Cost Management |
| "Estimate before migrating" | Pricing Calculator, then TCO Calculator |

:::hint{type=warning}
The Policy-versus-RBAC distinction is the single most commonly missed pair on AZ-900.

- **Azure RBAC** controls **who** can perform actions. *"Alice can create VMs."*
- **Azure Policy** controls **what** may exist, regardless of who. *"No VM may be created outside UK South, and every resource must carry a `costCentre` tag."*

Policy applies even to an Owner. A question mentioning standards, allowed regions, required tags or allowed SKUs is a Policy question.
:::

## Azure facts that are pure recall

These are the memorisation items. Ten minutes here converts several marks.

### Support plans

| Plan | Cost | Response for critical | Includes |
|---|---|---|---|
| **Basic** | Free | — | Docs, community, health dashboard, Advisor |
| **Developer** | Low | < 8 business hours | Business-hours email support |
| **Standard** | Moderate | **< 1 hour, 24/7** | Round-the-clock technical support |
| **Professional Direct** | High | **< 1 hour, 24/7** | Plus proactive guidance and webinars |

There is no Enterprise tier in the standard list; Unified Support is a separate enterprise agreement.

### Cost tools — a common confusion

| Tool | Purpose |
|---|---|
| **Pricing Calculator** | Estimate the cost of a *proposed* Azure configuration |
| **TCO Calculator** | Compare *existing on-premises* cost against Azure |
| **Cost Management + Billing** | Analyse and control *actual* spend; budgets and alerts |
| **Azure Advisor** | Recommendations, including cost optimisation |

Pricing Calculator = future Azure. TCO Calculator = on-premises versus Azure. That is the discriminator.

### Ways to reduce cost

- Reservations (1 or 3 years) — up to ~72% off
- Azure Hybrid Benefit — reuse existing Windows Server / SQL Server licences
- Spot VMs — big discount, evictable
- Autoscale and scale-to-zero
- Right-sizing via Advisor
- Dev/Test pricing on non-production subscriptions
- Budgets and cost alerts
- Tagging for cost allocation

### Governance and compliance

| Tool | Does |
|---|---|
| **Azure Policy** | Enforce or audit rules on resources |
| **Management groups** | Apply policy and RBAC across many subscriptions |
| **Resource locks** | `CanNotDelete` or `ReadOnly` — protect from accidents, including your own |
| **Tags** | Metadata for cost allocation and organisation |
| **Azure Blueprints** | Package artefacts as a repeatable environment (deprecated in favour of Template Specs / Deployment Stacks) |
| **Microsoft Purview** | Data governance and classification |
| **Service Trust Portal** | Compliance reports and audit documentation |

:::hint{type=tip}
**Resource locks** are frequently examined and genuinely useful. A `CanNotDelete` lock on a production resource group stops even an Owner from deleting it until the lock is removed — a deliberate speed bump. Remember: **locks apply to control-plane operations, not data-plane ones.** A `ReadOnly` lock on a storage account does not stop someone deleting a blob.
:::

### Well-Architected Framework — five pillars

Reliability, Security, Cost Optimisation, Operational Excellence, Performance Efficiency.

Note this differs from AWS's six — AWS added **Sustainability**. If a question lists six pillars including sustainability, it is an AWS question.

### Identity terms

| Term | Meaning |
|---|---|
| **Authentication** | Who are you? |
| **Authorisation** | What may you do? |
| **SSO** | One sign-in, many applications |
| **MFA** | Something you know, have, are |
| **Conditional Access** | Policy-driven access decisions based on signals |
| **Zero Trust** | Verify explicitly, least privilege, assume breach |
| **Defence in depth** | Layered controls — physical, identity, perimeter, network, compute, application, data |

Defence in depth's layers get asked as an ordering question. The data layer is the innermost and most valuable.

### Service categories worth being able to place

| Need | Service |
|---|---|
| Serverless functions | Azure Functions |
| Managed web hosting | App Service |
| Managed Kubernetes | AKS |
| Serverless containers | Container Apps / Container Instances |
| Managed relational SQL | Azure SQL Database |
| Managed NoSQL | Cosmos DB |
| Object storage | Blob Storage |
| Managed file share (SMB) | Azure Files |
| Message queue | Service Bus (enterprise) / Storage Queues (simple) |
| Event streaming | Event Hubs |
| Event routing | Event Grid |
| Secrets | Key Vault |
| IoT | IoT Hub |
| Big data analytics | Synapse / Fabric |
| Virtual desktops | Azure Virtual Desktop |

:::hint{type=warning}
The three "event" services blur together and get examined:

- **Event Grid** — *reactive routing* of discrete events. "A blob was created, trigger a function."
- **Event Hubs** — *high-throughput streaming ingestion*. Millions of telemetry events per second.
- **Service Bus** — *enterprise messaging* with ordering, transactions, dead-lettering and sessions.

Discriminating words: "react to an event" → Grid. "Telemetry stream at scale" → Hubs. "Reliable ordered business messages" → Service Bus.
:::

```quiz
question: An organisation must ensure no resource is created outside UK South, regardless of who creates it — including subscription Owners. Which service enforces this?
options:
  - Azure RBAC, by removing create permissions in other regions
  - Azure Policy, with an allowed-locations policy assigned at the management group
  - Resource locks on each resource group
  - Microsoft Entra ID Conditional Access
answer: 1
explanation: RBAC controls who may act, not where resources may exist, and it cannot express a location constraint. Azure Policy evaluates resources against rules and denies non-compliant deployments regardless of the caller's role. Locks prevent deletion or modification, not creation elsewhere, and Conditional Access governs sign-in.
```

## Decide

Same table as Day 14:

| Practice score | Do this |
|---|---|
| **85%+** | Book AZ-900 for Day 29 |
| **75–84%** | One more practice pass, then book |
| **65–74%** | Rework the weak domain during Week 5; retest before booking |
| **< 65%** | Complete the Microsoft Learn path properly first |

:::hint{type=success}
**AZ-900 plus AWS Cloud Practitioner together is a stronger signal than either alone** for a support role, because it says "I am not tied to one vendor's vocabulary." They also overlap heavily — having done one, the other is typically a few days of work rather than a few weeks.

That said: if you have to choose between one certification and one polished, deployed, monitored portfolio project, **choose the project every time.** Certifications get you past a keyword filter. Projects get you through the interview.
:::

## Exercise

:::checklist{title="Day 28 checklist"}
- [ ] Official AZ-900 practice assessment completed under timed conditions
- [ ] Score recorded
- [ ] Every miss written up with the four-part template
- [ ] Errors classified and tallied by domain
- [ ] Support plans table reproduced from memory
- [ ] Pricing Calculator vs TCO Calculator distinction written down
- [ ] Policy vs RBAC distinction written down with an example of each
- [ ] Event Grid / Event Hubs / Service Bus discriminators memorised
- [ ] Flashcards created for the service-category table
- [ ] `docs/az900-review.md` committed
- [ ] Decision recorded on which exam(s), if any, to book
:::

:::details{summary="Week 4 self-check"}
Rate 1–5. Anything at 3 or below gets fifteen minutes before Week 5.

- [ ] I can explain the Azure resource hierarchy and what resource groups give you
- [ ] I can map twenty AWS services to their Azure equivalents without looking
- [ ] I can explain the difference between Entra ID roles and Azure RBAC roles
- [ ] I can describe how SSO works end to end
- [ ] I can read an Entra sign-in log and diagnose a failure from the error code
- [ ] I can write a KQL query with `where`, `summarize`, `bin` and a join
- [ ] I can explain why Azure resource logs need diagnostic settings
- [ ] I can write a multi-stage Dockerfile and explain every line
- [ ] I can explain the liveness/readiness distinction and why it matters
- [ ] I have deployed a container to a managed cloud platform from CI
:::

## Where this is going

Four weeks done. You have SQL, Git, Python, schemas, two clouds, pipelines, observability, identity and containers.

Week 5 assembles them into the thing that actually gets you hired: a support-flavoured project that ingests schema-validated tickets, stores them in SQL, deploys through CI/CD, and is logged and monitored. Then interview preparation built around it.
