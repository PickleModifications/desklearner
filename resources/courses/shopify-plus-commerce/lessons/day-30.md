---
title: "Owning the Platform: Standards, Partners & Go-Lives"
summary: The practices that make one person a credible owner of three commerce channels — coding standards enforced by tooling, coordinating an external development agency, documentation that survives you, go-live discipline, and the capstone that ties the whole course together.
minutes: 120
objectives:
  - Define and enforce coding standards across an internal and an external team
  - Coordinate parallel workstreams with an outsourced development partner
  - Produce documentation that makes you replaceable, and understand why that is the goal
  - Run a go-live across DTC, B2B or retail with a repeatable process
  - Assemble the course's work into a coherent portfolio and a first-90-days plan
keyTerms:
  - term: Coding standard
    definition: The agreed conventions for a codebase. Only real when enforced by tooling and review rather than described in a document nobody reads.
  - term: Technical point of reference
    definition: The role of being the internal authority on platform decisions — including reviewing an external partner's output for architectural and brand consistency.
  - term: Bus factor
    definition: The number of people who could leave before the platform becomes unmaintainable. On a solo-owned platform it is one, and documentation is the only lever.
  - term: Go-live
    definition: A significant launch — a new channel, a new store, a replatform — with a coordinated plan across engineering, operations and support.
  - term: Architecture decision record
    definition: A short document capturing a decision, its date, its alternatives and its consequences. The substitute for institutional memory.
  - term: Definition of done
    definition: The team-wide standard every change meets regardless of content. The mechanism that makes quality consistent across two teams.
resources:
  - label: Shopify theme best practices
    url: https://shopify.dev/docs/storefronts/themes/best-practices
  - label: Theme Check
    url: https://shopify.dev/docs/storefronts/themes/tools/theme-check
  - label: Architecture decision records
    url: https://adr.github.io/
  - label: Shopify changelog
    url: https://shopify.dev/changelog
---

Twenty-nine lessons of capability. This one is about the thing that determines whether that capability compounds or dissipates: **being a good owner of a platform you are the only internal expert on.**

That situation has a specific failure mode. Everything works, nobody else understands it, you become the constraint on every decision, and eventually you are the person who cannot take a holiday. The practices below are all, in one way or another, about preventing that.

## Standards that are actually enforced

A standards document nobody reads is worse than none, because it creates the belief that the problem is solved.

The version that works has three properties: **it is short, it is enforced by tooling, and the tooling runs before review.**

```markdown title="docs/engineering-standards.md"
# Shopify engineering standards

Applies to all contributors, internal and external.

## Enforced automatically (CI fails)
- `shopify theme check --fail-level error` — no new offences
- Theme JavaScript ≤ 100KB gzipped total
- No new remote asset origins
- No changes to `config/settings_data.json` or `templates/*.json` without `INTENTIONAL_JSON_CHANGE` in the PR description
- Prettier formatting on all `.js`, `.css`, `.json`

## Enforced in review (checklist in the PR template)
- Images via `image_url` + `image_tag`, with a `sizes` matching the real layout
- All customer-facing strings in `locales/`, never hard-coded
- Behaviour as custom elements with `connectedCallback` and `disconnectedCallback`
- Section settings have defaults; sections render correctly on first add
- `{{ block.shopify_attributes }}` on every block wrapper
- Tested in the theme editor without reloading
- No JavaScript required for the core purchase path
- B2B and POS impact assessed, or explicitly N/A
- Any new metafield or Flow workflow added to its `docs/` table in the same PR

## Architecture rules
- No hard-coded location IDs, company IDs or thresholds — configuration lives in metafields
- Commercially meaningful rules are Functions, not theme code
- Wholesale pricing is catalogs and price lists, never discounts
- Tracking is web pixels, never theme scripts
- Admin API tokens never reach a browser

## Naming
- Sections: `section-<purpose>.liquid` · component CSS: `component-<name>.css`
- Metafields: `<owner-namespace>.<snake_case_key>`
- Flow workflows: `[CATEGORY] Trigger → outcome`
- Branches: `feature/<ticket>-<slug>`, `partner/<ticket>-<slug>`, `fix/<ticket>-<slug>`
```

One page. Everything on it either fails a build or appears as a checkbox someone has to tick. That is the whole difference between standards and aspirations.

## Working with an external partner

An outsourced development agency working on parallel workstreams is common and it is a genuine skill to manage well. You are not their manager, and you are the internal technical point of reference — which means their output has to meet your standards without you having authority over how they work.

What makes it function:

:::cards

:::card{title="The same pipeline, no exceptions"}
Their branches run the same CI, use the same PR template, meet the same definition of done. Standards enforced by tooling apply to everyone identically, which removes the personal element from every disagreement.
:::

:::card{title="Clear ownership boundaries"}
Written down: which areas they own, which you own, which are shared and need coordination. Two people refactoring the cart in the same fortnight is a merge conflict nobody enjoys.
:::

:::card{title="Their own preview theme"}
Connected to their branch. They demo without touching staging; you can look at their work any time without asking. It also makes responsibility legible when something breaks.
:::

:::card{title="A weekly technical sync"}
Not a status meeting — a design and decision conversation. What is coming, what will collide, what needs a shared approach. Thirty minutes that prevents a fortnight of rework.
:::

:::card{title="Context, generously given"}
They cannot know that wholesale pricing is catalog-driven, or that store data lives in metafields, unless someone tells them. Your `docs/` folder is the onboarding, and keeping it current is what makes their output good.
:::

:::

:::hint{type=tip}
When an agency's pull request does not meet the standard, review it against **the written standard**, not against your preference. "This does not meet the standard on locales — strings need to be in `locales/en.default.json`" is a fact and takes thirty seconds to resolve. "I would have done this differently" is an opinion and takes a meeting.

That distinction is most of what makes cross-organisation code review work, and it is worth being deliberate about it even when the two overlap.
:::

## Documentation that makes you replaceable

The instinct is that documentation is for other people. On a solo-owned platform it is primarily for **you in eight months**, and secondarily for the person who covers your absence.

The set that actually earns its keep — all of it in `docs/` in the repository:

```text title="docs/"
architecture-decisions.md      # ADRs: what we decided, when, why, what we gave up
custom-data.md                 # every metafield and metaobject, owner, consumed by
third-party-inventory.md       # every app and script, owner, cost, review date
api-versions.md                # every integration, version, sunset, upgrade plan
flows.md                       # every workflow, trigger, owner, what it touches
functions.md                   # every Function, config shape, test coverage
b2b-theme.md                   # every B2B branch in the theme
integrations/source-of-truth.md
engineering-standards.md
performance-budget.md
regression-suite.md
runbooks/
  release.md
  campaign-launch.md
  new-store-setup.md
  integration-failure.md
  rollback.md
platform-status.md             # current state, one page, updated each sprint
```

:::hint{type=warning}
**A document that is not updated in the same pull request as the change is already wrong**, and a wrong document is worse than none because people act on it.

Two mechanisms make this stick: a line in the PR template ("relevant `docs/` table updated"), and a quarterly review where every table's review-date column is honoured. Neither is glamorous. Both are the difference between documentation that is load-bearing and documentation that is decorative.
:::

The point of all this is not tidiness. It is that a platform whose bus factor is one is fragile in a way that eventually damages the business — and the person best placed to fix that is the one who would be missed.

## Go-live discipline

A go-live is bigger than a release: a new channel, a new store, a replatform. The pattern generalises from Day 20's campaign runbook.

:::steps

1. **Define done, precisely.** Not "B2B is live" but "five named accounts can log in, see correct pricing, place an order on terms, and the order reaches the ERP." Testable, or it is not a definition.

2. **Full regression across all three channels**, not only the one changing. Cross-channel effects are where the expensive surprises live.

3. **Brief the people who will receive the questions.** Support, retail, sales ops. What is changing, what to expect, what to escalate and to whom. Brief them before launch, not on the day.

4. **Soft launch where possible.** Two friendly wholesale accounts before all three hundred. One store before eight. Almost everything can be staged, and the ones that cannot are worth identifying explicitly.

5. **Watch actively for a full business cycle.** For B2B that is a week — most trade accounts order weekly, so a Monday launch tells you nothing until the following Monday.

6. **Have the rollback written, with a named decision owner and an objective trigger.** As on Day 20: the hard part under pressure is deciding, not executing.

7. **Retro, honestly, and write it into a runbook.** The second go-live should be materially easier than the first, and only will be if the first one's lessons are written down.

:::

```quiz
question: You are the only internal Shopify developer. Which practice most reduces business risk?
options:
  - "Writing more tests for theme JavaScript"
  - "Maintaining documentation and runbooks that let someone else operate the platform in your absence"
  - "Building more features per sprint"
  - "Reviewing every one of the agency's pull requests personally"
answer: 1
explanation: "A single point of failure who cannot be covered is the largest risk on a solo-owned platform, and the only lever on it is documentation — inventories, runbooks and decision records. Tests and reviews are valuable, but they protect the code; documentation protects the business's ability to operate without you."
```

## The first ninety days, revisited

Day 15 asked you to draft this. Now you have the vocabulary to write it properly.

**Days 1–30 — understand, change nothing.**
Audit the theme and its Git history. Inventory apps, scripts, metafields, Flow workflows, Functions, integrations and API versions. Establish whether `checkout.liquid` or Scripts are in use and find the sunset dates. Read the last six months of tickets. Meet merchandising, retail, sales ops, finance and the agency. Place a test order in every channel. Write the platform status document.

**Days 31–60 — fix what is dangerous, establish the process.**
Anything with a deadline attached — checkout extensibility, Scripts, API versions — gets a plan and a date. Set up CI if there is none. Introduce the PR template and the standards page. Build the regression suite. Start the `docs/` folder. Ship a few visible, low-risk improvements, because credibility is earned with delivery rather than with audits.

**Days 61–90 — build the roadmap.**
With the platform understood and the process working, propose the plan: what to build, in what order, with what it unlocks. Agree the capacity split. Book the platform-health allocation before it is competed away. Then start delivering against it.

## Capstone

Assemble everything into one coherent build. This is what you would show someone assessing whether you can own a platform like this.

:::checklist{title="Capstone: the three-channel workwear store"}
**Storefront**
- [ ] Online Store 2.0 theme with a flexible section library and theme blocks
- [ ] Metafield and metaobject-driven product data: fit guides, certifications, safety ratings
- [ ] PDP with Section Rendering variant switching, deferred media, correct structured data
- [ ] Cart drawer with server-rendered updates and a free-shipping bar computed in Liquid
- [ ] Filtering, predictive search and progressive load-more
- [ ] Core Web Vitals within a written budget, measured with field data

**B2B**
- [ ] Companies with multiple locations, catalogs, price lists, quantity rules and terms
- [ ] Theme detects company context; volume pricing ladder on the PDP; location switcher
- [ ] Quick order grid, bulk SKU entry, saved lists and reorder
- [ ] Order minimum enforced by a validation Function; carriage threshold from a company metafield
- [ ] Rep assignment, notifications and a documented credit limit design

**POS**
- [ ] Two locations with metafield-driven configuration and metaobject store entries
- [ ] A POS UI extension with a tile, a modal and a post-purchase action
- [ ] Line item properties captured at the till and visible on the order
- [ ] Store provisioning script and new-store runbook
- [ ] Nothing anywhere hard-codes a location ID

**Platform**
- [ ] Git workflow with branch protection, CI, and a partner branch convention
- [ ] Deploy and rollback scripts, both rehearsed and timed
- [ ] Web pixel replacing theme-based tracking
- [ ] A webhook consumer with HMAC verification, idempotency and reconciliation
- [ ] The full `docs/` set, current
- [ ] Regression suite covering all three channels
- [ ] Launch runbook, rehearsed end to end including a rollback
:::

### Presenting it

If you are showing this to anyone, lead with the decisions rather than the features. A README that says "variant switching uses the Section Rendering API rather than client-side state, because the PDP has five variant-dependent elements and a second implementation in JavaScript would drift within a quarter — here is the measurement" tells a reader far more than a feature list.

Three things worth putting in writing somewhere visible:

1. **An architecture diagram** of the three channels on one store, showing what is shared and what differs.
2. **Three ADRs** on genuinely contestable decisions — one store versus expansion stores, catalogs versus discounts for wholesale pricing, server-rendered versus client-side variant switching.
3. **One measurement** you took and acted on. A TTFB improvement, a byte saving, a rollback time. Numbers are what distinguish someone who optimised from someone who says they care about performance.

## Where this leaves you

You can build an Online Store 2.0 theme properly, make it fast and prove it, program the Plus platform with Functions and checkout extensions, run a native B2B wholesale channel, build and scale a POS implementation, and hold all three inside a release process with an external partner.

Two habits worth keeping after the last lesson:

**Read the changelog weekly.** The platform ships constantly and deprecates on published dates. Half of what makes a Shopify specialist valuable is knowing what changed before it becomes an incident.

**Keep visiting the shop floor and the warehouse.** The best requirements you will ever get come from watching someone struggle with a workflow you did not know existed. Every genuinely good feature in this course started that way.

The final exam covers the whole course. It assumes you built the work rather than read about it.
