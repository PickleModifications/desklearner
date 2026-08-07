---
title: Mock Interview Preparation
summary: Structured answers to the questions this role actually asks — diagnostic scenarios, behavioural stories built on your two projects, and the background-check question, prepared calmly rather than improvised.
minutes: 130
objectives:
  - Answer diagnostic scenario questions with a visible, repeatable method
  - Build STAR-format stories from the work you have actually done
  - Prepare a fluent walkthrough of both projects
  - Answer the CJIS / background-check question confidently and briefly
  - Prepare questions that make you sound like a colleague rather than a candidate
keyTerms:
  - term: STAR
    definition: Situation, Task, Action, Result. The structure behind a good behavioural answer, with most of the weight on Action.
  - term: Scenario question
    definition: A hypothetical diagnostic problem. It tests method and reasoning, not whether you guess the same answer they had in mind.
  - term: Signal
    definition: Evidence an interviewer is actually assessing. Usually method, communication and judgement rather than recall.
  - term: CJIS
    definition: Criminal Justice Information Services. A US security policy standard; roles touching CJIS data require fingerprinting and a background check.
resources:
  - label: STAR method guidance
    url: https://www.themuse.com/advice/star-interview-method
  - label: Google SRE Book — Being On-Call
    url: https://sre.google/sre-book/being-on-call/
  - label: FBI CJIS Security Policy
    url: https://le.fbi.gov/informational-tools/cjis/cjis-security-policy-resource-center
---

Last heavy day. The goal is not to memorise answers — memorised answers sound memorised. It is to have **thought about each of these once already**, so that in the room you are recalling rather than composing.

## What is actually being assessed

For a support engineering role, interviewers are looking for four things:

| Signal | How they test it |
|---|---|
| **Diagnostic method** | Scenario questions. Do you have a system, or do you guess? |
| **Communication** | Can you explain something technical to a non-technical listener? |
| **Judgement under pressure** | "What would you do first?" Do you mitigate before investigating? |
| **Ownership** | Behavioural questions. Do you finish things and follow up? |

Notice that **raw recall is not on the list.** They can look things up too. What they cannot look up is how you think when the answer is not obvious.

## Scenario questions

These are the core of a support interview. They have no single right answer — the interviewer is watching your method.

### The universal framework

Use it out loud. Saying the structure is itself part of the answer.

:::steps

1. **Clarify.** What exactly is failing? Since when? Who is affected — one customer or many?
2. **Establish blast radius.** One user, one tenant, or everyone? This decides whether it is a ticket or an incident.
3. **Correlate with change.** What deployed, what configuration changed, what certificate expired?
4. **Narrow the layer.** Client, network, application, dependency, data.
5. **Mitigate.** Restore service. Rollback, failover, disable the feature.
6. **Diagnose.** Now find the cause, with the evidence you preserved.
7. **Prevent.** What check would have caught this? Write the action item.

:::

:::hint{type=success}
Two things in that list separate strong candidates from average ones:

- **Step 2 before step 6.** Blast radius determines urgency and escalation, and most candidates jump straight to debugging.
- **Step 5 before step 6.** Restoring service is not the same as understanding the problem, and prioritising understanding extends outages. Say this explicitly.
:::

### Worked example — "Walk me through diagnosing a customer issue"

> **Interviewer:** A customer says our API is rejecting their requests. Walk me through it.

> **You:** "First I'd want three things from them: an example request, a timestamp, and ideally a correlation or request ID — most of our APIs return one, and that lets me find the exact invocation rather than searching.
>
> Before touching their case, I'd check the blast radius. If I query error counts by customer over the last few hours and it is only them, this is a configuration or contract problem on one integration. If it is two hundred customers, I stop and escalate, because that is an incident, not a ticket.
>
> Assuming it is isolated, I'd look at the error code rather than the status. A 400 tells me the payload is malformed and the fix is theirs; a 401 or 403 is credentials or permissions; a 429 is rate limiting; a 5xx is ours. Those lead to genuinely different places.
>
> For a 400 specifically, I'd validate their payload against our published schema. That usually gives me a field-level answer in a minute — *your `priority` field is `critical`, we accept these four values*. That is something I can send them immediately with a link to the schema.
>
> Then I'd check whether we changed anything. If we tightened validation in a recent release and they were relying on the old leniency, then technically their payload is wrong but practically we broke them, and the answer might be to roll back and give them notice rather than telling them to fix it.
>
> I'd close by asking what would have caught this earlier. In my own project I added a schema-compatibility check in CI for exactly this reason — you cannot tighten a contract without the pipeline telling you."

That answer demonstrates method, escalation instinct, customer empathy, and a concrete thing you built. It is roughly 90 seconds spoken.

### Worked example — "How would you triage an on-call outage?"

> **You:** "First, establish whether it is real and how big. Check the dashboard: is the error rate genuinely elevated, and how many customers are affected? A single failing request from a monitoring probe is different from 40% of traffic failing.
>
> If it is real and widespread, I declare an incident before I start debugging — post in the incident channel with what is broken, since when, how many affected, and what I am doing. That takes thirty seconds and means nobody else duplicates my work or finds out from a customer.
>
> Then correlate with change. What deployed recently? The overwhelming majority of incidents are caused by a change, and 'error rate rose at 14:20, deploy went out at 14:18' is usually the whole diagnosis.
>
> Then mitigate. If a deploy correlates, roll back — before understanding why. I'd capture one correlation ID first so the trail survives, but I would not spend twenty minutes understanding a bug while customers are failing. Rollback is two minutes and the logs will still be there tomorrow.
>
> If there is no correlating change, I'd work through the dependencies: is the database reachable, is the downstream provider degraded, is there a cloud provider event? The readiness endpoint on my own service reports which dependency is failing, specifically so this step is one request rather than a hunt.
>
> Once service is restored, post-mortem within 24 hours. Blameless — I care what the system should have shown the person, not who typed the change."

:::hint{type=tip}
Notice the answer keeps returning to **things you actually built**: the readiness endpoint, the correlation ID, the rollback path. That converts a hypothetical answer into evidence. Do this deliberately — every scenario answer should touch your project at least once.
:::

### Other scenarios to prepare

Spend five minutes on each, out loud:

:::checklist{title="Scenario drills"}
- [ ] "A query that ran in two seconds now takes four minutes. Nothing changed." *(Statistics, parameter sniffing, data volume growth, a dropped index, blocking)*
- [ ] "A user says they cannot sign in." *(Day 24's seven-step sequence)*
- [ ] "The deploy pipeline is green but production is broken." *(What is the pipeline not testing? Config differences, migration ordering, smoke-test coverage)*
- [ ] "Customers report the site is slow, but our dashboard is green." *(Averages hiding p99; client-side; a region you are not monitoring; the monitoring is inside the failure domain)*
- [ ] "One customer's data is missing." *(Did it arrive? Check ingest logs, DLQ, rejected payloads. Never assume deletion first)*
- [ ] "You are paged at 3am for a service you have never seen." *(Runbook, blast radius, recent change)*
- [ ] "A colleague pushed a change that broke production and is very upset." *(Fix first, blameless after; explicitly not a blame conversation)*
:::

## Behavioural questions

STAR: Situation, Task, Action, Result — with **most of the time on Action.** The commonest failure is spending forty seconds on context and eight on what you actually did.

### Stories to prepare

You have real material from the last five weeks. Use it.

| Question | Your material |
|---|---|
| "Tell me about a technical problem you solved" | The `git bisect` regression hunt; the SARGability fix with logical reads before and after |
| "A time you worked with a JSON schema mismatch" | Day 9's ticket scenario — the `priority` enum breaking three customers |
| "A time you improved a process" | Adding schema validation as a CI gate; the runbook you tested by breaking your own service |
| "A time you made a mistake" | The self-inflicted incident on Day 21 and the post-mortem |
| "A time you had to learn something quickly" | Six weeks from "I can write a SELECT" to a deployed, monitored service across two clouds |
| "A time you explained something technical to a non-technical person" | The customer-facing 400 response wording; the README |
| "A time you disagreed with a technical decision" | Any real one — or the `MERGE` versus insert-and-catch reasoning |

### Worked example — schema mismatch

> **Situation:** "I built a ticket ingestion service that validates incoming JSON against a published schema. In testing I tightened the `priority` field from a free string to an enum of four values."
>
> **Task:** "I needed to understand what tightening a contract does to existing callers, because it looked like a pure improvement."
>
> **Action:** "I wrote a query against the payloads I had stored to see what values were actually being sent — I keep the original payload verbatim for exactly this kind of question. Three of the synthetic callers were sending `critical`, which had been silently accepted and mapped to `high`. So the change would have rejected them entirely.
>
> Rather than just shipping it, I did three things. I made the error response name the exact field and list the accepted values, so a caller can self-serve. I added a check in CI that compares the schema against the previous version and fails on a narrowing change unless it is explicitly acknowledged. And I wrote down that widening an enum is safe but narrowing one is breaking, in the ADR, so the reasoning survives me."
>
> **Result:** "The schema change shipped without breaking a caller, and the CI check has caught one other narrowing change since. More usefully, I now think about API changes in terms of who is depending on the current behaviour rather than whether the new behaviour is more correct."

:::hint{type=warning}
Do not inflate. If it was a personal project, say so — "I built this to learn, so the callers were synthetic" is completely fine and far better than being caught embellishing. Interviewers are generally very positive about self-directed project work; what they react badly to is a story that does not survive a follow-up question.
:::

### The mistake story

Everyone gets asked. Prepare one where:

- The mistake is **real** and **yours**
- The impact was **contained** (or you contained it)
- You describe **what you changed**, not just what you learned

> "I deployed a schema change that rejected valid payloads from three integrations. I caught it from the error-rate alarm five minutes in, identified the cause by correlating with the deploy timestamp, and rolled back within twenty-three minutes total. No data was lost because rejected payloads go to a dead-letter store, and I replayed them afterwards.
>
> The post-mortem action item that mattered was not 'be more careful' — it was a CI check that fails a schema narrowing. I had no way to know which values callers actually depended on, so I built the dashboard that shows enum values received per field over 30 days. Now that question is answerable before the change, not after."

:::hint{type=success}
"The action item was not 'be more careful'" is the line that lands. It signals you understand that systems, not individual vigilance, prevent recurrence — which is the core of a blameless engineering culture and something interviewers specifically listen for.
:::

## The project walkthroughs

Rehearse both. Two minutes each, then be ready to go deep on any part.

:::checklist{title="Project walkthrough drills"}
- [ ] Project 1 in 60 seconds
- [ ] Project 2 in 60 seconds
- [ ] Project 2 in five minutes, with the demo script from Day 33
- [ ] "Why did you choose X?" for six different decisions
- [ ] "What would you do differently?" — have three real answers
- [ ] "What would you build next?" — one answer, with a reason it is first
- [ ] "How would you scale this to 100× the traffic?" — connection pooling, queue-based ingestion, read replicas, partitioning
- [ ] "How would you secure this for production?" — auth at the gateway, network isolation, secret rotation, audit logging
:::

:::hint{type=tip}
Prepare a **genuine** answer to "what would you do differently?". "Nothing, it went well" reads as either dishonest or uncritical. Something like *"I would have written the runbook before the alarms rather than after — writing it revealed three things I had not instrumented"* is specific, true, and demonstrates reflection.
:::

## The background-check question

For roles touching CJIS data, a criminal-justice sector, or any regulated environment, this will come up. Prepare a short, calm, complete answer so it takes fifteen seconds and moves on.

> "Yes — I understand the role requires a background check and fingerprinting under CJIS, and I'm happy to complete that. I have no concerns about clearing it, and I'm available for the process whenever it fits your timeline."

:::hint{type=warning}
Three rules:

1. **Be brief.** Over-explaining creates the impression there is something to explain.
2. **Be accurate.** Never state you will clear a check if you are unsure — it will be verified, and a discrepancy is far worse than the original issue.
3. **If there is something in your history**, get advice on disclosure specific to your jurisdiction and the standard in question. Do not improvise it in an interview, and do not conceal it — most standards care considerably more about candour than about an old, disclosed matter.
:::

## Questions to ask them

Asking good questions is assessed. Prepare six; you will use three.

:::cards

:::card{title="About the work"}
"What does a typical week look like — what proportion is reactive tickets versus project work?"

"What are the three most common categories of ticket you get?"
:::

:::card{title="About on-call"}
"How is the on-call rotation structured, and how often does someone actually get paged out of hours?"

"How do you handle the day after a bad night?"
:::

:::card{title="About the system"}
"What is the oldest part of the stack, and what is it like to support?"

"Where does most of your observability data live — is it one place or several?"
:::

:::card{title="About improvement"}
"When something breaks, what happens afterwards? Is there a post-mortem process, and do the action items get done?"

"What is one thing the team has fixed in the last year that made on-call meaningfully better?"
:::

:::

:::hint{type=success}
The post-mortem question is the best one on that list. The answer tells you whether the organisation learns from failure or merely survives it — and asking it signals you have operated somewhere that does.
:::

```quiz
question: In a scenario question about diagnosing an outage, what most distinguishes a strong answer?
options:
  - Naming the correct root cause quickly
  - Establishing blast radius early and mitigating before fully diagnosing
  - Listing every possible cause exhaustively
  - Describing the specific tooling you would use
answer: 1
explanation: The interviewer is assessing method, not whether you guess their intended answer. Checking how many customers are affected determines urgency and escalation, and restoring service before completing the diagnosis is the judgement call that separates people who have handled real incidents from people who have not.
```

## Exercise

:::checklist{title="Day 35 checklist"}
- [ ] Universal diagnostic framework written out and rehearsed aloud
- [ ] All seven scenario drills attempted, out loud, five minutes each
- [ ] Six STAR stories written out, with Action the longest section of each
- [ ] The mistake story prepared, ending in a systemic fix rather than "be more careful"
- [ ] Both project walkthroughs rehearsed at 60 seconds and 5 minutes
- [ ] "Why did you choose X?" prepared for six decisions
- [ ] Three genuine "what would you do differently?" answers
- [ ] Background-check answer written and said aloud until it is calm and brief
- [ ] Six questions to ask them, written down
- [ ] **Record yourself** answering three scenario questions; listen back
- [ ] If possible, run a real mock with someone else — even a non-technical friend
:::

:::details{summary="Common interview mistakes for this kind of role"}
1. **Jumping to a solution before clarifying.** The interviewer often withholds detail deliberately, to see whether you ask.
2. **Debugging before establishing blast radius.** Signals you have not been on call.
3. **Explaining what a tool does rather than how you used it.** They know what CloudWatch is.
4. **Not mentioning the customer.** In support, there is always a person waiting. Say what you would tell them and when.
5. **Answering "what would you do differently?" with "nothing".**
6. **Too much Situation, not enough Action.** Aim for 15% / 10% / 60% / 15%.
7. **Not asking any questions.** Reads as low interest, every time.
8. **Over-claiming.** One follow-up question exposes it, and it colours everything else you said.
:::

## Where this is going

Week 5 is done. You have two projects, a certification or two, and prepared answers. Week 6 is presentation: making the work legible to someone who will spend ninety seconds deciding whether to read further.
