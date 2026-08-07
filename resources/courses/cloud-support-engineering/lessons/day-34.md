---
title: Terminology & Concept Review
summary: Drill the explanations out loud until they are fluent rather than reconstructed. Knowing something and being able to say it under mild pressure are different skills.
minutes: 90
objectives:
  - Explain every core concept from this course out loud, without notes
  - Identify which explanations are fluent and which are still being assembled
  - Use the Feynman technique to find and close the gaps
  - Build a personal glossary in your own words
keyTerms:
  - term: Feynman technique
    definition: Explain a concept in plain language as if to a beginner. Wherever you reach for jargon or hand-wave, you have found a gap.
  - term: Fluency
    definition: Retrieving and articulating knowledge without visible effort. Distinct from recognition, which is much easier and much less useful in an interview.
  - term: Illusion of competence
    definition: Mistaking familiarity with material for the ability to reproduce it. Re-reading produces it; retrieval practice destroys it.
resources:
  - label: Learning How to Learn — retrieval practice
    url: https://www.coursera.org/learn/learning-how-to-learn
  - label: The Protégé Effect (teaching to learn)
    url: https://en.wikipedia.org/wiki/Protégé_effect
---

Today has no new material. It is the day that converts *"I know this"* into *"I can explain this while someone watches."* Those are genuinely different capabilities, and interviews test the second one.

## How to do this properly

**Out loud.** Not in your head. Speaking exposes gaps that silent thought glides over — you will hear yourself say "and then it sort of… handles it", and that is the gap.

For each item below:

:::steps

1. **Set a 90-second timer** and explain the concept aloud, as though to a competent colleague who has not met it.
2. **Notice where you stall**, reach for jargon, or say "basically".
3. **Look it up**, then re-explain immediately.
4. **Mark it** ✅ fluent, ⚠️ shaky, or ❌ gap.
5. Anything ❌ or ⚠️ gets a second pass at the end of the session.

:::

:::hint{type=warning}
The temptation is to re-read your notes and feel satisfied. That produces the **illusion of competence** — recognition feels like knowledge and is not. If you have not said it out loud, you have not tested it.
:::

## Week 1 — SQL Server and Git

:::checklist{title="Drill: SQL Server"}
- [ ] What is T-SQL, and name three ways it differs from standard SQL
- [ ] Explain `TOP` versus `LIMIT`, including how it changes query structure
- [ ] Walk through all four join types and what each does to the row count
- [ ] Why can a `WHERE` clause turn a `LEFT JOIN` into an `INNER JOIN`?
- [ ] What is fan-out, and how do you detect it?
- [ ] Explain the difference between `WHERE` and `HAVING`, referencing logical processing order
- [ ] Explain `COUNT(*)` versus `COUNT(column)`
- [ ] Why is `NOT IN` dangerous with a nullable column?
- [ ] Describe `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` and what problem it solves
- [ ] Explain clustered versus non-clustered indexes
- [ ] What is a key lookup, and why might it stop an index being used?
- [ ] Define SARGability and give two examples of destroying it
- [ ] Walk through reading an execution plan: what do you look at, in what order?
- [ ] Explain 3NF, and give one good reason to deliberately break it
:::

:::checklist{title="Drill: Git"}
- [ ] What is a commit, at the data-model level?
- [ ] Explain rebase versus merge, including when each is dangerous
- [ ] What is the golden rule of rebasing, and why?
- [ ] Walk through a complete pull-request lifecycle
- [ ] Explain squash merge and why most teams default to it
- [ ] How does `git bisect` work, and roughly how many steps for 500 commits?
- [ ] When would you use `git revert` rather than `git reset --hard`?
- [ ] What is the reflog, and when has it saved you?
- [ ] Explain `git cherry-pick` and one risk of it
:::

## Week 2 — Python, schemas, AWS

:::checklist{title="Drill: Python and JSON Schema"}
- [ ] Why does a support script stream a log file rather than reading it all?
- [ ] Why must every `requests` call have a `timeout`?
- [ ] Which HTTP status codes should you retry, and which should you not?
- [ ] What does a JSON Schema validate, and what does it deliberately not?
- [ ] Explain `additionalProperties: false` and its versioning consequence
- [ ] Which schema changes are backwards-compatible and which are breaking?
- [ ] Why report all validation errors rather than the first?
- [ ] Why store money as an integer in minor units?
:::

:::checklist{title="Drill: AWS"}
- [ ] Explain IaaS, PaaS and SaaS in terms of who is on call for what
- [ ] Explain the shared responsibility model, and name three things always yours
- [ ] Region versus availability zone versus edge location
- [ ] High availability versus disaster recovery; define RTO and RPO
- [ ] Security groups versus network ACLs — four differences
- [ ] What makes a subnet public?
- [ ] Walk through the four causes of "I cannot SSH to my instance"
- [ ] Explain IAM policy evaluation: default, explicit deny, guardrails
- [ ] Why are roles preferable to access keys?
- [ ] Explain a Lambda cold start and three ways to reduce its impact
- [ ] Why is Lambda plus RDS awkward, and what are the remedies?
:::

## Week 3 — CI/CD and observability

:::checklist{title="Drill: CI/CD"}
- [ ] Distinguish continuous integration, delivery and deployment
- [ ] Why "build once, promote" rather than rebuilding per environment?
- [ ] Explain blue/green, canary and rolling deployments with a trade-off each
- [ ] What is the expand/contract pattern, and why is it necessary?
- [ ] Explain the difference between deployment and release
- [ ] Why is OIDC better than a stored cloud access key in CI?
- [ ] Name the four DORA metrics and the counter-intuitive finding
:::

:::checklist{title="Drill: Observability"}
- [ ] Distinguish monitoring from observability with a concrete example of each
- [ ] Name the three pillars and what each is uniquely good at
- [ ] Why structured logs rather than formatted text?
- [ ] What is a correlation ID and why does it matter?
- [ ] Explain the five log levels and the test for `ERROR`
- [ ] Name five things you must never log
- [ ] Why alert on p95 or p99 rather than the mean?
- [ ] Why is a drop in traffic an important alarm?
- [ ] Explain metric cardinality and why customer ID is a bad dimension
- [ ] What is a trace, a span, and trace context propagation?
- [ ] What does OpenTelemetry give you that a vendor SDK does not?
- [ ] Define SLI, SLO, SLA and error budget
:::

## Week 4 — Azure, identity, containers

:::checklist{title="Drill: Azure"}
- [ ] Describe the Azure resource hierarchy and what resource groups give you
- [ ] Map ten AWS services to their Azure equivalents, out loud, without pausing
- [ ] Explain the difference between Entra ID roles and Azure RBAC roles
- [ ] Why can a Contributor not grant access, and why is that good design?
- [ ] Explain Azure Policy versus Azure RBAC with an example of each
- [ ] What is `az vm stop` versus `az vm deallocate`, and why does it matter?
- [ ] Why do Azure resource logs need diagnostic settings?
:::

:::checklist{title="Drill: Identity"}
- [ ] How does Entra ID differ from on-premises Active Directory? Name four differences
- [ ] Walk through SSO end to end
- [ ] What is a conditional access policy? Give three realistic examples
- [ ] Why is blocking legacy authentication the highest-value single policy?
- [ ] Why deploy a conditional access policy in report-only mode first?
- [ ] Walk through diagnosing "I cannot sign in"
- [ ] What does error 53003 mean, and what does the log entry give you?
- [ ] Why do client secrets cause outages, and what should you use instead?
:::

:::checklist{title="Drill: Containers"}
- [ ] Image versus container versus registry
- [ ] Explain layer caching and why instruction order matters
- [ ] Why multi-stage builds?
- [ ] Why run as a non-root user?
- [ ] Explain liveness versus readiness, and what goes wrong if you confuse them
- [ ] Why should you never deploy `:latest` to production?
- [ ] Name four reasons a container exits immediately
- [ ] Why must secrets never be baked into an image?
:::

## Week 5 — your project

The most likely interview topic, because it is yours and they can go deep.

:::checklist{title="Drill: the project"}
- [ ] Explain the whole system in 60 seconds
- [ ] Why containers rather than serverless? What did you give up?
- [ ] How is idempotency enforced, and how did you prove it?
- [ ] Why `INSERT`-and-catch rather than `MERGE`?
- [ ] Why 200 for a duplicate rather than 409?
- [ ] Why store the original payload verbatim?
- [ ] Why do migrations run as a separate job?
- [ ] How does the service authenticate to the database with no password?
- [ ] Why does the app user have `db_datareader`/`db_datawriter` and not `db_owner`?
- [ ] Walk through what happens when a customer sends a malformed payload
- [ ] Walk through diagnosing an error report using only your logs
- [ ] What would you build next, and why that first?
:::

## The Feynman pass

For the four or five items you marked ❌, do this properly:

:::steps

1. **Write the concept name** at the top of a blank page.
2. **Explain it in plain language**, as if to someone intelligent who has never met it. No jargon; if you must use a term, define it first.
3. **Find the point where you get vague.** That is the gap — it is always specific and always smaller than it felt.
4. **Go back to the source** and fix only that.
5. **Rewrite the explanation** without looking.
6. **Simplify with an analogy** if it helps — but check the analogy does not smuggle in something false.

:::

:::hint{type=success}
Example of the technique working. Attempt one:

> "SARGability is when the query is written so the index can be used efficiently."

That is a definition, not an explanation, and it hides the mechanism. Attempt two:

> "An index is a sorted list. Sorted lists let you jump straight to a value — that is what makes them fast. If I write `WHERE YEAR(OrderDate) = 2013`, the engine has to compute `YEAR()` for every single row before it can compare, so the sort order is useless and it reads the whole table. If I write `WHERE OrderDate >= '2013-01-01' AND OrderDate < '2014-01-01'`, it can jump to the first matching entry and walk forward, because the values are still in their original sorted form.
>
> Both queries return the same rows. The second one just does not destroy the thing that made the index useful. And you only notice on large tables, which is why it passes testing and fails in production."

The second version explains the *mechanism* and the *support consequence*. That is what fluent sounds like.
:::

## Build your glossary

As you drill, write each term **in your own words** in `docs/glossary.md`. Not the textbook definition — yours.

```markdown title="docs/glossary.md"
## SARGable
A predicate the engine can satisfy by seeking into an index rather than scanning.
Wrapping the column in a function — `YEAR(col)`, `LEFT(col, 3)` — or forcing an
implicit type conversion destroys it. Same results, wildly different cost, and
only on big tables. Classic "worked in dev" bug.

## Idempotent
Doing it twice has the same effect as doing it once. Matters wherever a caller
might retry — which is everywhere, because networks fail after the write but
before the response. Enforce it at the storage layer (a UNIQUE constraint), not
in application code, because check-then-insert has a race window.

## Error budget
100% minus your SLO. At 99.5% over 30 days that is about 3.6 hours of failure
you are allowed. Useful because it turns "should we ship this risky change?"
from an argument into arithmetic.
```

```quiz
question: You can recognise a correct explanation of rebase versus merge when you read one, but stumble when asked to give it aloud. What does that indicate?
options:
  - You understand it well and simply need more confidence
  - You have recognition but not retrieval fluency — the gap that interviews actually test
  - The concept is inherently difficult to verbalise
  - You should re-read the material until it feels familiar
answer: 1
explanation: Recognition is far easier than recall, which is why re-reading feels productive and produces the illusion of competence. Only retrieval practice — explaining without the source in front of you — builds the fluency an interview requires.
```

## Exercise

:::checklist{title="Day 34 checklist"}
- [ ] Every drill item above attempted **out loud** and marked ✅ / ⚠️ / ❌
- [ ] Feynman pass completed on every ❌
- [ ] Second pass on the ⚠️ items at the end of the session
- [ ] `docs/glossary.md` written with at least 30 terms in your own words
- [ ] The AWS ↔ Azure mapping recited from memory in under three minutes
- [ ] The "explain the project in 60 seconds" pitch rehearsed five times
- [ ] Record yourself explaining three concepts; listen back and note filler and vagueness
- [ ] Weakest three concepts identified and scheduled for a review tomorrow morning
:::

:::hint{type=tip}
Recording yourself is unpleasant and unusually effective. You will hear hedging ("kind of", "basically", "sort of"), and you will hear the exact sentence where you stop explaining and start describing. Both are fixable once you have heard them, and neither is visible from the inside.
:::

## Where this is going

Tomorrow is the last heavy day: mock interview preparation. Structured answers to the behavioural and scenario questions this kind of role actually asks, built on the two projects you have now finished.
