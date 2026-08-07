---
title: Final Review & Rest Buffer
summary: One last pass on anything still shaky, a verified inventory of what you built, and an honest look at where you now stand.
minutes: 90
objectives:
  - Verify every artefact from the course still works
  - Close the last remaining knowledge gaps
  - Produce a final capability inventory
  - Set up a maintenance rhythm so this does not decay
  - Stop, deliberately
keyTerms:
  - term: Spaced repetition
    definition: Reviewing at increasing intervals. The most efficient way to hold knowledge over months rather than days.
  - term: Skill decay
    definition: Loss of capability through disuse. Fastest for procedural knowledge you learned once and never repeated.
  - term: Evidence
    definition: Something a third party can verify. A deployed URL, a public repository, a credential ID.
resources:
  - label: AWS What's New (weekly, skimmable)
    url: https://aws.amazon.com/new/
  - label: Azure Updates
    url: https://azure.microsoft.com/en-us/updates/
  - label: Brent Ozar — SQL Server blog
    url: https://www.brentozar.com/blog/
---

Last day. Two jobs: verify everything actually works, and then stop.

That second one is not filler. Six weeks of sustained learning has a cost, and the instinct at this point is to keep pushing. Resist it — the marginal value of a seventh week of cramming is low, and arriving at interviews tired undoes real work.

## Part 1 — Verify the evidence

Everything you will claim must be demonstrable. Go through it and prove each item, rather than assuming.

:::checklist{title="Evidence verification"}
- [ ] Both repositories load, and the READMEs render correctly on GitHub
- [ ] Every link in both READMEs resolves
- [ ] The architecture diagrams render (Mermaid works on GitHub — check it actually displays)
- [ ] CI is green on `main` in both repositories
- [ ] Clone one repository into a fresh directory and follow your own setup instructions **exactly**. They will be wrong somewhere
- [ ] The deployed service responds at the URL in your README
- [ ] `POST` a ticket to it and get a 201; post again and get a 200
- [ ] `POST` an invalid payload; confirm the field-level error response
- [ ] `/ready` reports the database correctly
- [ ] Log queries return data
- [ ] Alarms exist and are in an OK state
- [ ] Certification credentials verifiable at their public URLs
- [ ] Résumé PDF opens, text is selectable, no formatting damage
- [ ] LinkedIn agrees with the résumé
:::

:::hint{type=warning}
The "clone it fresh and follow your own instructions" step catches something almost every time — a missing environment variable, a step you do from memory, a dependency you installed globally months ago. It takes fifteen minutes and it is the difference between a reviewer succeeding and giving up.
:::

### Keep the deployment alive — or do not

An interviewer clicking a dead link is worse than no link.

**If you keep it running:** Azure SQL serverless with auto-pause plus Container Apps scaling to zero costs very little. Set a budget alert, put the cost in your calendar monthly, and check the URL before every interview.

**If you tear it down:** replace the live link with:

```markdown
> **Note:** the live deployment is torn down to avoid ongoing cost. The full
> infrastructure is defined in [`infra/`](infra/) and deploys in about four
> minutes with `az deployment group create`. Happy to bring it up for a demo —
> or run it locally with `docker compose up`.
```

That reads as cost discipline, not as abandonment, and `docker compose up` gives them a way to try it anyway.

## Part 2 — Close the last gaps

From your Day 34 drill sheet, take the three items still marked ⚠️ or ❌. Twenty minutes each, and use the method that works:

:::steps

1. **Explain it aloud** from memory. Note exactly where you stall.
2. **Read the source** — but only for the specific gap, not the whole topic.
3. **Explain it again**, immediately, without looking.
4. **Write it in your glossary** in your own words.
5. **Do something with it** — one query, one command, one small script. Procedural memory outlasts declarative memory by a wide margin.

:::

:::hint{type=tip}
If a concept has resisted three attempts, the problem is usually a **missing prerequisite** rather than the concept itself. Execution plans do not make sense without indexes; conditional access does not make sense without understanding what a token is. Go one level down and the top level often resolves on its own.
:::

## Part 3 — The final inventory

Update `docs/inventory.md` from Day 29 with Weeks 5 and 6, and be specific. This is the document you will re-read before every interview.

```markdown title="docs/inventory.md (final)"
# Capability inventory — six weeks

## Can do without reference material
- Write a four-table join with correct outer-join semantics
- Diagnose a slow query from an execution plan; identify scans, key lookups, bad estimates
- Explain and fix SARGability problems
- Write window-function queries for top-N-per-group
- Run a full PR workflow; rebase, squash, bisect, cherry-pick, recover with reflog
- Stream and parse large log files in Python; call an API with proper timeout and retry
- Write a JSON Schema and a parametrised test suite for it
- Deploy compute, storage, identity and a database in both AWS and Azure
- Write a GitHub Actions pipeline with OIDC, matrix, caching and artifacts
- Write a multi-stage Dockerfile and explain every line
- Write structured logs with correlation IDs; query them in Logs Insights and KQL
- Set alarms on the right signals, including a low-traffic alarm
- Write and test a runbook; run a blameless post-mortem

## Can do with documentation
- Bicep and Terraform beyond the basics
- KQL beyond the operators drilled here
- Kubernetes (recognised, not operated)
- Advanced SQL Server internals — parameter sniffing, plan guides, wait stats

## Deliberately not covered
- Windows Server administration and Group Policy
- Networking beyond cloud VPC/VNet fundamentals
- Front-end development
- Data engineering and analytics pipelines

## Evidence
| Claim | Evidence |
|---|---|
| T-SQL | 20 queries in `sql/queries/`, schema with justified indexes |
| Python | Log parser, API client, FastAPI service, pytest suite |
| JSON Schema | `schemas/v1/`, valid and invalid corpora, CI gate |
| CI/CD | Two workflows, OIDC, automatic rollback |
| AWS | Lambda + API Gateway + DynamoDB, IAM boundary tests |
| Azure | Container Apps + Azure SQL + Entra auth, Bicep |
| Observability | Structured logs, metrics, three alarms, tested runbook |
| Incident response | Self-inflicted incident with a written post-mortem |
```

:::hint{type=success}
The "can do with documentation" and "deliberately not covered" sections matter as much as the first one. Being able to say *"I have not operated Kubernetes — I can read a manifest and I know what the components do, but I would not claim to run a cluster"* is far stronger than a vague claim that collapses under one question.

Calibrated confidence is itself a signal. People who know the edges of their knowledge are much easier to work with on call.
:::

## Part 4 — Do not let it decay

Six weeks of knowledge with no maintenance is noticeably degraded in three months. A light rhythm prevents most of it.

| Cadence | Activity | Time |
|---|---|---|
| **Daily** | Ten flashcards (this app generates them from lesson key terms) | 5 min |
| **Weekly** | Skim AWS What's New and Azure Updates | 15 min |
| **Weekly** | One SQL practice problem, timed | 15 min |
| **Fortnightly** | One small addition to a project — a feature, a test, a fix | 1–2 h |
| **Monthly** | Re-read your own runbook; check the deployment still works | 30 min |
| **Monthly** | Check cloud bills | 5 min |

:::hint{type=tip}
The fortnightly project addition is the one that compounds. A repository with commits spread over months reads completely differently from one with a six-week burst and then silence — the first says "this person builds things", the second says "this person did a course".

Small is fine. Adding a `/summary` endpoint, or the schema-compatibility CI check you listed as future work, is a perfectly good fortnight's contribution.
:::

## Part 5 — Where you actually stand

An honest assessment, since flattery is not useful here.

**You have** working knowledge of the entire toolchain a cloud support engineer touches, two deployed and documented projects, possibly two certifications, and — most importantly — the *habits*: check blast radius, correlate with change, mitigate before diagnosing, write the runbook, measure before optimising.

**You do not have** production experience, and no course substitutes for it. There is no amount of self-directed work that replicates being paged at 3am for a system you did not build, with a customer waiting.

What you have done is close the gap enough to be **interviewable and trainable**, and to demonstrate that with evidence rather than assertion. That is what this was for.

:::hint{type=success}
The single strongest thing you can say in an interview is this:

> "I built a service, deployed it, instrumented it, wrote a runbook for it — and then I deliberately broke it in production and followed my own runbook. Three of the steps were wrong. I fixed them and wrote a post-mortem."

Almost nobody does that. It demonstrates operational instinct rather than claiming it, and it is a direct answer to "how would you handle being on call?"
:::

```quiz
question: An interviewer asks about a technology you listed but have only used briefly. What is the best response?
options:
  - Describe what you know in general terms and hope the questions stay shallow
  - Say plainly what you have and have not done with it, then describe the closest thing you have done properly
  - Change the subject to a technology you know well
  - Admit you should not have listed it and move on
answer: 1
explanation: Calibrated honesty is a positive signal, not a negative one — interviewers are assessing whether they can trust your self-assessment on call. Pivoting to adjacent work you did do keeps the answer substantive rather than just apologetic.
```

## Exercise

:::checklist{title="Day 37 checklist"}
- [ ] Every item in the evidence verification list checked
- [ ] Fresh-clone setup test completed and instructions corrected
- [ ] Deployment kept alive with a budget alert, **or** torn down with the README note added
- [ ] Last three knowledge gaps closed
- [ ] Final inventory written, including the honest limits
- [ ] Maintenance rhythm scheduled in a calendar, with reminders
- [ ] Repositories tidy — branches pruned, issues closed, no stray TODOs
- [ ] Résumé, LinkedIn and repositories all agree with each other
- [ ] Applied to at least one role, or scheduled the time to
:::

## Finish

Thirty-seven days ago this was a list of topics. It is now:

- A local SQL Server, twenty diagnostic queries and a schema you can defend
- Python that parses logs, calls APIs and talks to databases safely
- A JSON Schema enforced as a contract in CI
- A protected repository with a real PR workflow
- Working resources in two clouds, with least-privilege identities
- A pipeline that builds, tests, scans, migrates, deploys and verifies
- A containerised service running in production with no stored credentials
- Structured logs, metrics, alarms and a runbook you have actually tested
- A post-mortem for an incident you caused on purpose
- Two documented projects and prepared answers about both

:::hint{type=success}
Now stop.

Not permanently — there is a maintenance rhythm above, and there is always more. But today, deliberately, stop. Close the laptop. The work is done and it is good.

Then go and apply.
:::

:::details{summary="If you are not getting interviews"}
The problem is almost never the technical work at this point. In rough order of likelihood:

1. **The CV is not surviving the filter.** Plain single-column PDF, exact terminology from the posting, no tables or graphics. Test it by pasting into a plain-text editor — if it comes out scrambled, so does the ATS parse.
2. **You are applying to too few roles.** Response rates are low for everyone. Twenty applications is a small sample.
3. **The covering note is generic.** One specific sentence about *their* posting outperforms three paragraphs of enthusiasm.
4. **Nobody is finding you.** Recruiters search LinkedIn by keyword. If your headline says "Aspiring cloud engineer" you will not appear in a search for "SQL Server support engineer".
5. **The repository is not being read.** Apply the ninety-second test from Day 36 with two more people.
6. **You are only applying cold.** Referrals convert at a far higher rate. A polite message to someone in the team, referencing something specific about their work, is worth more than ten cold applications.

Fix them in that order. None of them is about needing more technical knowledge.
:::
