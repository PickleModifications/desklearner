---
title: Cloud Practitioner Practice Exam
summary: Sit a full practice exam under real conditions, then review every miss properly — which is where the actual learning happens.
minutes: 90
objectives:
  - Complete a full-length Cloud Practitioner practice exam under timed conditions
  - Review every incorrect answer and classify why it was wrong
  - Identify which of the four exam domains needs more work
  - Decide honestly whether to book the real exam
keyTerms:
  - term: CLF-C02
    definition: The current AWS Certified Cloud Practitioner exam code. 65 questions, 90 minutes, scaled score out of 1000, pass mark 700.
  - term: Scaled score
    definition: A normalised score that accounts for question difficulty, so it does not map to a simple percentage correct.
  - term: Distractor
    definition: An incorrect option written to be plausible. Exam questions are engineered so that partial knowledge picks the distractor.
  - term: Error classification
    definition: Sorting mistakes by cause — knowledge gap, misread, careless — because each needs a different remedy.
resources:
  - label: AWS Certified Cloud Practitioner exam page
    url: https://aws.amazon.com/certification/certified-cloud-practitioner/
  - label: AWS Skill Builder — official practice question set (free)
    url: https://explore.skillbuilder.aws/learn/course/external/view/elearning/12483/aws-certified-cloud-practitioner-official-practice-question-set
  - label: CLF-C02 exam guide (PDF)
    url: https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf
---

Today is not a study day. It is a **measurement** day, and then a review day. The measurement is only useful if you take it seriously enough to be uncomfortable.

## The exam

| | |
|---|---|
| Code | CLF-C02 |
| Questions | 65 (50 scored, 15 unscored trial questions) |
| Time | 90 minutes |
| Format | Multiple choice (one answer) and multiple response (two or more) |
| Pass | 700 / 1000, scaled |
| Cost | US$100 |
| Delivery | Pearson VUE test centre or online proctored |

Domain weighting:

| Domain | Weight |
|---|---|
| Cloud Concepts | 24% |
| **Security and Compliance** | **30%** |
| Technology and Services | 34% |
| Billing, Pricing and Support | 12% |

Security and compliance is 30% — nearly a third — and it is also the domain most directly relevant to a support role. If you are short on time, that is where to spend it.

## Part 1 — Sit the exam properly

:::hint{type=warning}
Simulate the real conditions. 90 minutes on a timer, phone in another room, no notes, no second browser tab, no pausing. A practice exam taken with documentation open measures nothing except your ability to search, and it will give you a falsely reassuring number.
:::

:::steps

1. **Set a 90-minute timer** and do not stop it.

2. **Answer every question.** There is no penalty for a wrong answer, so an unanswered question is a guaranteed zero.

3. **Flag anything you are unsure of** and move on. Do not let one question eat six minutes.

4. **Write down your reasoning** for flagged questions — one line each, on paper. This is the most valuable artefact of the whole day, because during review you can see *what you were thinking* rather than reconstructing it.

5. **Review flagged questions** if time remains, then submit.

:::

Where to get a full-length exam:

- **AWS Skill Builder** — free official practice question set (20 questions), plus a full-length official practice exam. Start here; the question style is authentic.
- **Third-party** — Tutorials Dojo and Whizlabs are the most commonly recommended. Their explanations are often more detailed than AWS's.

## Part 2 — Review every miss

This is where the day earns its place. Budget more time for review than for the exam itself.

For each incorrect answer, write four things:

```markdown title="docs/exam-review-2026-08-06.md"
### Q17 — Which service provides a managed NoSQL database?
- **I answered:** RDS
- **Correct:** DynamoDB
- **Why I got it wrong:** Knowledge gap — I was matching on "managed database"
  and did not register that RDS is specifically *relational*.
- **The distinction:** RDS = managed relational (SQL Server, Postgres, MySQL…).
  DynamoDB = managed NoSQL key-value/document. The question's discriminating
  word was "NoSQL".
```

### Classify every mistake

The classification matters more than the count, because each type has a different fix:

| Type | Looks like | Fix |
|---|---|---|
| **Knowledge gap** | You genuinely did not know | Study that topic. This is the good kind |
| **Misread the question** | You knew it, but missed "NOT", "MOST cost-effective", "LEAST operational overhead" | Slow down; underline qualifiers |
| **Distractor trap** | Two options looked right; you picked the plausible one | Learn to spot the *discriminating word* |
| **Careless** | You knew it and clicked the wrong box | Fatigue or rushing. Pace yourself |

:::hint{type=tip}
If more than about a quarter of your errors are "misread", your problem is not knowledge — it is exam technique, and that is much faster to fix. Read the **last sentence of the question first**; it usually contains the actual ask and the qualifier that narrows the answer.
:::

### Qualifiers that decide AWS questions

AWS exam questions are consistent about which qualifier points to which answer:

| Qualifier | Usually points to |
|---|---|
| "MOST cost-effective" | Serverless, spot instances, S3 lifecycle, reserved capacity |
| "LEAST operational overhead" | Managed/serverless over self-managed |
| "MOST highly available" | Multi-AZ; multi-region if the question says regional failure |
| "MOST secure" | IAM roles over keys; least privilege; encryption at rest and in transit |
| "MOST scalable" | Auto Scaling, decoupling with SQS/SNS, DynamoDB over a single RDS |
| "Real-time" | Kinesis; "near real-time" often means Kinesis Firehose |
| "Petabyte-scale data transfer" | Snowball / Snowmobile, not Direct Connect |

## Part 3 — Score your domains

Tally your errors by domain:

:::checklist{title="Domain self-assessment"}
- [ ] Cloud Concepts — errors: ___ / questions: ___
- [ ] Security and Compliance — errors: ___ / questions: ___
- [ ] Technology and Services — errors: ___ / questions: ___
- [ ] Billing, Pricing and Support — errors: ___ / questions: ___
:::

Common weak spots for people at this stage of the course, and their remedies:

:::cards

:::card{title="Support plans"}
Basic / Developer / Business / Enterprise On-Ramp / Enterprise. Know which tier gets a **Technical Account Manager** (Enterprise), which gets 24/7 phone support (Business and up), and which gets the full Trusted Advisor check set (Business and up). Pure memorisation; worth ten minutes.
:::

:::card{title="Pricing models"}
On-Demand, Reserved Instances, Savings Plans, Spot, Dedicated Hosts. Spot = interruptible, up to 90% off, for fault-tolerant workloads. Savings Plans = commit to spend, more flexible than RIs.
:::

:::card{title="The Well-Architected Framework"}
Six pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimisation, Sustainability. Questions like "which pillar does this address?" are free marks once you can list them.
:::

:::card{title="Service name recall"}
Trusted Advisor vs Inspector vs GuardDuty vs Macie vs Detective vs Security Hub. These blur together. Make flashcards — this app will generate them from the key terms in these lessons.
:::

:::

```quiz
question: On a practice exam you score 68%, and most of your errors were on questions containing the phrase "LEAST operational overhead". What is the most useful conclusion?
options:
  - You need to study every domain again from the beginning
  - You are ready to book the real exam
  - You are under-weighting managed and serverless options when comparing designs
  - The practice exam was badly written
answer: 2
explanation: A cluster of errors around one qualifier is a pattern, not random noise. "LEAST operational overhead" almost always favours the managed or serverless option, and recognising that habit is a targeted fix rather than a general re-study.
```

## Part 4 — Decide

Be honest with yourself:

| Practice score | What it means | Do this |
|---|---|---|
| **85%+** | Comfortably ready | Book the exam for Day 29 |
| **75–84%** | Nearly there | Two more practice exams, targeted review; book for Day 29 |
| **65–74%** | Real gaps | Rework weak domains during Weeks 3–4; retest on Day 28 |
| **< 65%** | Not yet | Redo Cloud Practitioner Essentials properly. The certificate is optional; the knowledge is not |

:::hint{type=success}
The certificate itself is a modest signal. What it *does* do is force breadth — you cannot pass without knowing roughly what forty AWS services are for, and that vocabulary is genuinely useful when a customer says a word you have never heard during a call.

If you are choosing between one certification and one strong portfolio project, choose the project. If you can do both, the pairing reads well.
:::

## Exercise

:::checklist{title="Day 14 checklist"}
- [ ] Full-length practice exam completed under timed, closed-book conditions
- [ ] Score recorded
- [ ] Every incorrect answer written up with the four-part template
- [ ] Each error classified: knowledge gap / misread / distractor / careless
- [ ] Errors tallied by domain
- [ ] Two weakest domains identified and written down
- [ ] Flashcards created for the service names that blur together
- [ ] `docs/exam-review-*.md` committed to the repo via a PR
- [ ] Decision recorded: booking the exam, or not, and why
:::

:::details{summary="A review template you can reuse"}
```markdown
# Practice Exam Review — {date}

**Score:** __ / 65  ·  **Scaled estimate:** ___  ·  **Time used:** __ min

## Errors by domain
| Domain | Wrong | Total | % |
|---|---|---|---|
| Cloud Concepts | | | |
| Security & Compliance | | | |
| Technology & Services | | | |
| Billing & Support | | | |

## Errors by cause
| Cause | Count |
|---|---|
| Knowledge gap | |
| Misread question | |
| Distractor trap | |
| Careless | |

## Individual questions
### Q__ — {question summary}
- I answered:
- Correct answer:
- Why I got it wrong:
- The distinction to remember:

## Actions before next attempt
1.
2.
3.
```
:::

## Where this is going

Week 2 is done. You have written support-grade Python, enforced a contract with JSON Schema, and stood up compute, storage, networking, identity, a serverless function and a managed database.

Week 3 answers the next question: how does code get from your laptop to that infrastructure safely, and how do you find out when it breaks?
