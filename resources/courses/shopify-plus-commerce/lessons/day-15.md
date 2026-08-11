---
title: Sprint Delivery, Jira & the QA Handoff
summary: The human process around the code — sprint ceremonies that are worth attending, tickets that survive contact with a designer and a product manager, a QA handoff that finds real bugs, and how a solo developer holds three commerce channels without becoming the bottleneck.
minutes: 90
objectives:
  - Turn a design and a business requirement into a ticket with testable acceptance criteria
  - Estimate Shopify work realistically, including the platform-specific unknowns
  - Run the sprint ceremonies in a way that protects focus rather than consuming it
  - Give a QA engineer the context they need to test a Shopify change properly
  - Manage competing priorities across DTC, B2B and POS with a defensible prioritisation model
keyTerms:
  - term: Acceptance criteria
    definition: The testable conditions that define "done" for a ticket. Written before development, agreed with the requester, and used verbatim by QA.
  - term: Definition of done
    definition: The team-wide standard every ticket must meet regardless of its content — linted, reviewed, tested on devices, documented, no new third-party origins.
  - term: Spike
    definition: A time-boxed investigation ticket producing an answer rather than a feature. The correct response to "we do not know whether the platform can do this."
  - term: Sprint goal
    definition: A single sentence describing what the sprint is trying to achieve. Its purpose is to make mid-sprint trade-offs decidable without escalation.
  - term: Regression suite
    definition: The set of paths retested on every release regardless of what changed — critical purchase paths, B2B ordering, POS checkout.
  - term: Refinement
    definition: The session where upcoming tickets are clarified, estimated and made ready. The single highest-leverage ceremony for a solo specialist developer.
resources:
  - label: Atlassian — Scrum ceremonies
    url: https://www.atlassian.com/agile/scrum/ceremonies
  - label: Atlassian — writing user stories
    url: https://www.atlassian.com/agile/project-management/user-stories
  - label: Shopify — theme QA considerations
    url: https://shopify.dev/docs/storefronts/themes/best-practices
---

This lesson has no code in it, and it is the one most likely to determine whether the job goes well.

The technical risk in a role like this is low — you will be able to build what is asked. The actual risks are: building the wrong thing because the ticket was ambiguous, being the single point of failure across three channels, and having no defensible answer when four stakeholders each believe their request is the priority.

## Turning a request into a ticket

Requests arrive in the shape of "can we add a size guide to product pages?" That is not a ticket. It is the start of a conversation, and the conversation has a standard set of questions.

```markdown title="a ticket worth working from"
## PDP: size guide drawer

**As a** customer choosing a boot size
**I want** to see the brand's sizing guidance without leaving the product page
**So that** I order the right size the first time

### Context
Returns data shows 18% of boot returns are cited as sizing. Merchandising has
authored fit guides as `fit_guide` metaobject entries (see docs/custom-data.md).

### Acceptance criteria
- [ ] A "Size guide" link appears next to the size option label on PDPs where the
      product has a `custom.fit_guide` metafield set
- [ ] The link is not rendered when the metafield is empty
- [ ] Clicking opens a drawer containing the metaobject's title, intro, diagram and
      measurement rows
- [ ] The drawer is keyboard accessible: focus moves in, Escape closes, focus returns
      to the trigger
- [ ] The drawer content is not fetched or rendered until first open
- [ ] Works on mobile (375px), tablet and desktop
- [ ] With JavaScript disabled, the link navigates to the metaobject's own page
- [ ] Merchandisers can change guide content with no deployment

### Out of scope
- Per-variant size guides
- Automatic size recommendation
- B2B-specific sizing tables (separate ticket, CHAN-412)

### Design
Figma frame: [link]. Note: the drawer uses the existing drawer component; no new
drawer styling.

### QA notes
Test products: `steel-toe-work-boot` (has a guide), `work-glove-insulated` (no guide).
Confirm the collection page is unaffected.

### Risks / unknowns
Metaobject rendering inside a drawer fetched via section rendering — 2h spike done,
confirmed working.
```

Three properties make that ticket good, and they are worth naming because they are what you should be pushing every requester towards:

1. **The acceptance criteria are testable by someone who did not write them.** "The drawer is accessible" is not; "Escape closes and focus returns to the trigger" is.
2. **Out of scope is explicit.** This is where scope creep goes to die. Every item there is a conversation you do not have to have again mid-sprint.
3. **The no-JavaScript and merchandiser-autonomy criteria are in the ticket**, not in your head. If they are only in your head, they get cut under pressure and nobody knows they were ever requirements.

:::hint{type=tip}
**Write the acceptance criteria before you estimate, and write them with the requester in the room.** Half the ambiguity in Shopify work is not technical — it is "does this apply to wholesale customers too?" and "what happens on a product with no variants?". Those questions cost thirty seconds in refinement and two days in a sprint.
:::

## Estimating Shopify work

Shopify estimates go wrong in characteristic ways, and knowing them makes you unusually reliable.

| Looks like | Actually is | Why |
|---|---|---|
| "Just add a field to the PDP" | Half a day | Metafield definition, theme editor exposure, dynamic source, blank state, mobile, B2B check |
| "Change the discount logic" | A week or more | Scripts are legacy; this is a Function, which is a deployed app extension with its own release cycle |
| "Add this app" | Two hours plus permanent cost | Install, configure, measure, integrate with the theme, document, own forever |
| "Make the checkout do X" | Possible or impossible, rarely in between | Checkout is only extensible along defined seams; find out first |
| "Copy this from the other store" | Depends entirely | Expansion stores share nothing automatically — no theme sync, no settings sync |
| "Fix this bug on mobile" | Unknown until reproduced | Could be your CSS, could be an app, could be a device-specific browser bug |

The estimating habits that hold up:

- **Spike anything platform-shaped you have not personally done.** A four-hour time-boxed spike that returns "yes, via X" or "no, but Y" is worth far more than an eight-point guess. Nobody has ever been criticised for a spike that prevented a wrong commitment.
- **Estimate the QA and release cost, not just the build.** A change touching checkout or B2B needs a wider regression pass, and that time is real.
- **Name the unknown in the ticket.** "Unknown: whether POS UI extensions can read a company metafield" is a legitimate thing to write down, and it directs the conversation to the right person.

## Ceremonies, minimally

The version of Scrum worth practising here is small.

:::cards

:::card{title="Refinement"}
The highest-value session for you. Upcoming work gets clarified, questioned and estimated *before* it is committed. This is where you say "that is three tickets" and "that is not possible on the checkout, but this is." Protect it.
:::

:::card{title="Planning"}
Commit to a sprint goal and a set of tickets. Bring your capacity honestly, including the standing overhead — support requests, agency reviews, app updates. A sprint plan with no slack is a plan to miss.
:::

:::card{title="Stand-up"}
Fifteen minutes, three things: what moved, what is blocked, what needs a decision. Not a status report to a manager. If you are the only developer, the value is in surfacing blockers early to the people who can clear them.
:::

:::card{title="Review and retro"}
Demo on the staging theme, not a screen recording — stakeholders find things when they click. The retro is where you fix process problems while they are small; "the agency's PR sat for four days" is a retro item, not a personal grievance.
:::

:::

:::hint{type=warning}
As the only internal Shopify developer you will be pulled into every conversation that touches commerce. Two defences, both of which need saying out loud rather than being silently practised:

1. **A single intake path.** Everything becomes a ticket. "Quick favour in Slack" is how a sprint quietly becomes untracked work, and untracked work is invisible when someone asks why the roadmap slipped.
2. **A published standing capacity split.** For example: 60% roadmap, 20% support and unplanned, 20% platform health (upgrades, audits, API versions). Agreed with your manager, visible to stakeholders. Without it, platform health is always the thing that gets deferred — and it is the thing whose deferral causes the incident.
:::

## The QA handoff

QA cannot test a Shopify change well without context that only you have. What they need, every time:

```markdown title="the handoff block on every ticket"
### How to test
- **Where:** Staging theme preview link
- **Test data:** product `steel-toe-work-boot` (has fit guide),
  `work-glove-insulated` (none), B2B account `test@tradeco.example` (Company: TradeCo)
- **Channels affected:** DTC ✅ · B2B ✅ (pricing must be unchanged) · POS ❌
- **What changed:** `sections/main-product.liquid`, `snippets/fit-guide.liquid`,
  new `assets/size-guide-drawer.js`
- **What should NOT have changed:** collection pages, cart, any pricing
- **Known platform quirks:** the drawer re-renders in the theme editor on setting
  change — test it there too
- **Regression risk:** the PDP section was refactored; retest variant switching
```

The two lines that most improve bug reports are **"what should NOT have changed"** and **"channels affected"**. Without the first, QA tests only your change and misses the regression. Without the second, nobody checks whether a PDP change broke wholesale pricing — and on a store with a shared catalogue across three channels, that is precisely where the expensive bugs live.

### A regression suite worth maintaining

Run on every release regardless of what changed:

```markdown title="docs/regression-suite.md"
## DTC
1. Home loads; hero renders; navigation works
2. Collection: filter, sort, paginate, load more
3. PDP: variant switch updates price/media/availability; unavailable combination handled
4. Add to cart from PDP, quick add from collection
5. Cart: quantity change, remove, discount code, note and attributes persist
6. Checkout initiates and reaches payment
7. Account: login, order history, addresses
8. No-JavaScript: browse → PDP → add to cart → cart → checkout

## B2B
9. Log in as a company contact; catalog pricing correct
10. Quantity rules enforced; volume pricing displayed
11. Purchase order number captured and visible on the order
12. Location switcher works for a multi-location company

## POS
13. Sale completes on the POS device
14. Custom tile and extension load
15. Receipt renders correctly

## Cross-cutting
16. Core Web Vitals within budget on home, collection, PDP
17. No new console errors
18. Theme editor: every section on the homepage still edits live
```

Eighteen items, twenty-five minutes. Automate what you can — and be realistic that on a small team much of this stays manual, which is an argument for keeping the list short and genuinely critical rather than aspirational and ignored.

```quiz
question: A product manager asks you to estimate "add a 10% discount for orders over £200" during sprint planning, and wants a number now. What is the best response?
options:
  - "Give a two-point estimate; it is a small pricing rule"
  - "Ask whether it applies to DTC, B2B and POS, whether it stacks with other discounts, and propose a spike if the implementation route is not already known"
  - "Refuse to estimate without a Figma design"
  - "Estimate it as a theme change since the cart is theme code"
answer: 1
explanation: "Discount logic is not theme code — it is an automatic discount or a Shopify Function, with its own deployment path — and the channel scope changes the answer completely. The professional move is to surface the questions that change the estimate by an order of magnitude, and to time-box the unknown rather than guessing at it."
```

## Prioritising across three channels

DTC, B2B and POS all have stakeholders, and each of them experiences their request as urgent. You need a model you can say out loud.

A workable one, applied in order:

1. **Broken beats new.** Anything preventing a customer, wholesale buyer or store associate from completing a transaction goes first, always, on any channel.
2. **Revenue at risk beats revenue upside.** A B2B ordering bug blocking a distributor's weekly order outranks a homepage redesign, even though the redesign has a bigger number attached.
3. **Deadline-bound beats flexible.** A retail store opening in three weeks and a campaign launch on the 14th are immovable; a "would be nice" is not.
4. **Compounding beats one-off.** A schema setting that removes a recurring ticket beats the one-off it replaces, and you should say so explicitly, because that trade is invisible to stakeholders.
5. **Platform health has a standing allocation** rather than competing each sprint — API version upgrades, app audits, dependency updates. It loses every individual argument against a feature and cannot be allowed to.

Say the model out loud in planning. Most priority conflicts are not genuine disagreements about importance; they are two people applying different unstated rules. Making the rules explicit resolves the majority of them without escalation.

:::hint{type=tip}
Keep a one-page **platform status document** — current theme version, live integrations and their API versions, apps and owners, known issues, upcoming deadlines. Update it every sprint.

It takes ten minutes and does three jobs: it answers most stakeholder questions without a meeting, it makes your work visible to people who cannot read a commit log, and it is the handover document if you are ever hit by a bus or, more likely, a holiday.
:::

## Exercise

:::checklist{title="Day 15 checklist"}
- [ ] Wrote a full ticket for a real feature, with testable acceptance criteria, out-of-scope, QA notes and risks
- [ ] Had someone else read the acceptance criteria and confirm they could test from them alone
- [ ] Wrote a spike ticket for something you genuinely do not know how to do yet
- [ ] Committed a definition of done to the repository
- [ ] Wrote `docs/regression-suite.md` covering all three channels
- [ ] Ran the regression suite once end to end and timed it
- [ ] Wrote a QA handoff block including "what should NOT have changed"
- [ ] Drafted a capacity split proposal (roadmap / support / platform health) with a rationale
- [ ] Wrote the one-page platform status document
- [ ] Estimated five tickets, then wrote down for each what would make the estimate wrong
:::

### Stretch problems

1. Take the discount request from the quiz and write out the full clarifying question list before estimating. Then answer them for our workwear store and produce a real estimate with its assumptions attached.
2. Write the intake process you would propose in week one of the job — how requests arrive, who triages, what gets a ticket, what gets said no to. One page.
3. Review your regression suite honestly: which items would you actually skip on a Friday afternoon under pressure? Those are either not critical (cut them) or they need automating.
4. Write the "first 30 days" plan you would bring to a role like this: what you would audit, what you would document, what you would deliberately not change yet. Chapter 6 revisits this, so keep it.

## Where this is going

That closes Chapter 3. You can now build a storefront, make it fast, connect it to the APIs, and ship it inside a process.

Chapter 4 moves to the Plus tier specifically: organization admin and expansion stores, Shopify Functions replacing Scripts, checkout extensibility, Flow and Launchpad. This is where the platform stops being "a very good ecommerce site" and starts being a commerce platform you program.

Sit the Chapter 3 test first.
