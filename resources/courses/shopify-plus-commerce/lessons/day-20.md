---
title: Launchpad & Campaign Engineering
summary: Scheduling theme publishes, price changes, product releases and script activation for a timed campaign — plus the load, caching and release discipline that keeps a high-traffic drop from becoming an incident.
minutes: 100
objectives:
  - Configure a Launchpad event to publish a theme, change prices and release products on a schedule
  - Prepare a theme for a campaign so nothing needs a manual change at launch time
  - Build a launch runbook covering pre-flight, launch, monitoring and rollback
  - Reason about caching, load and the failure modes specific to a timed release
  - Choose between Launchpad, Flow, scheduled publishing and a manual release
keyTerms:
  - term: Launchpad
    definition: A Shopify Plus tool for scheduling commerce events — publishing a theme, changing prices, publishing products to channels, enabling scripts, and reverting afterwards, all at defined times.
  - term: Event revert
    definition: Launchpad's scheduled undo — restoring the previous theme, prices and product availability at the end of an event window, without a person being awake.
  - term: Drop
    definition: A timed product release with concentrated demand at a known moment. The load pattern is a spike, not a curve, which changes what fails.
  - term: Cache warming
    definition: Requesting key pages before traffic arrives so caches hold rendered output, reducing the cost of the first wave.
  - term: Pre-flight
    definition: The checks completed before a launch window opens, on the actual theme and data that will go live.
  - term: Runbook
    definition: A written, step-by-step procedure for an operation, executable by someone other than its author under pressure.
resources:
  - label: Shopify Launchpad
    url: https://help.shopify.com/en/manual/shopify-plus/launchpad
  - label: Scheduling theme publishing
    url: https://help.shopify.com/en/manual/online-store/themes/managing-themes/schedule-theme-publishing
  - label: Shopify Flow
    url: https://help.shopify.com/en/manual/shopify-flow
---

A campaign launch is the moment when everything you have built gets tested at once, by real customers, at a time announced in advance, with people watching.

Launchpad exists so that the launch itself is not a person clicking Publish at 09:00. That matters more than it sounds: manual launches fail in boring, human ways — someone is in a meeting, the wrong theme is selected, prices are changed in the wrong order, nobody remembers to revert at midnight.

## What Launchpad does

A Launchpad **event** has a start time, an optional end time, and a set of scheduled changes:

:::cards

:::card{title="Publish a theme"}
Swap to a campaign theme at the start, and back at the end. Because it is a theme publish, it is atomic and it is instantly reversible.
:::

:::card{title="Change prices"}
Apply campaign pricing to selected products or collections, and restore original prices at the end. This is a bulk price change with a scheduled undo.
:::

:::card{title="Publish products and collections"}
Make products visible on chosen sales channels at the start time. This is how a genuine drop works — the product exists, is fully configured, and simply is not visible yet.
:::

:::card{title="Enable scripts and manage inventory"}
Activate a Script (legacy) for the event window, and set inventory quantities for the release.
:::

:::

Every part of that has a **scheduled revert**, which is the feature that matters most. The end of a campaign is where manual processes fail, because it is usually at midnight and nobody wants to be awake for it.

:::hint{type=warning}
Launchpad's script activation refers to legacy **Shopify Scripts**, which are being replaced by Functions (Day 17). Function-based discounts are scheduled through the **discount's own active dates** instead, which is a better mechanism anyway — it lives with the discount rather than in a separate tool. Verify the current capabilities in the documentation when planning a campaign; the theme, price and product publishing parts of Launchpad are the durable core.
:::

## Preparing the theme

The rule for campaign work: **at launch time, nothing should need changing.** Everything is pre-configured and gated on time or on the publish itself.

Three approaches, in increasing order of robustness:

### 1. A separate campaign theme

Duplicate the live theme, make the campaign changes, and let Launchpad publish it at the start and republish the original at the end.

Best for: substantial visual changes — a takeover homepage, new navigation, a different colour scheme.

The hazard: **the campaign theme is a fork.** Any fix made to the live theme during the campaign window has to be made twice. Keep the window short, freeze non-critical changes, and merge back deliberately afterwards.

### 2. Time-gated sections

```liquid title="sections/campaign-banner.liquid"
{%- liquid
  assign now = 'now' | date: '%s' | times: 1
  assign starts = section.settings.starts_at | date: '%s' | times: 1
  assign ends = section.settings.ends_at | date: '%s' | times: 1
  assign live = false
  if now >= starts and now < ends
    assign live = true
  endif
-%}

{%- if live or request.design_mode -%}
  <div class="campaign-banner color-{{ section.settings.color_scheme }}">
    {{ section.settings.message }}
  </div>
{%- endif -%}
```

Best for: banners, countdowns, messaging that appears and disappears on a schedule without a theme change at all.

:::hint{type=danger}
**Time-gated Liquid interacts badly with caching.** Shopify caches rendered output; a section that becomes visible at 09:00:00 may not appear for every visitor at exactly that second. For a banner this is fine. For anything where the exact moment matters — a drop going live, a price changing — use a mechanism the platform itself schedules (Launchpad, product publishing, discount active dates) rather than a timestamp comparison in Liquid.

Also note `'now'` is evaluated at render time in the store's timezone context. Mixing that with an ISO timestamp a merchandiser typed in their own timezone is a reliable source of "the banner appeared an hour early" tickets. Store schedule values in UTC and label the field clearly.
:::

### 3. Metafield and settings-driven

The campaign's content lives in theme settings or metaobjects; the section is permanent, and the merchandiser configures it. Nothing is deployed at launch at all.

Best for: recurring campaign shapes — seasonal sales, promotional rows — where the structure is stable and only the content changes. This is the one to aim for, because after the third campaign the structure genuinely is stable and you should stop building new sections for it.

## Load and the things that actually break

A drop is a spike, not a curve. Shopify's checkout scales — that is what you pay Plus for — but the parts you own can still fall over.

**What Shopify handles:** checkout capacity, CDN delivery of assets, the platform's own throughput, and its queueing behaviour under extreme load.

**What you can break:**

| Risk | Why it happens | Mitigation |
|---|---|---|
| Slow Liquid on the campaign page | Nested loops, `all_products` lookups, unpaginated collections | Profile the campaign page before launch, on real data |
| App scripts under load | Third-party services have their own capacity, and yours is not their priority | Audit what runs on campaign pages; remove anything non-essential for the window |
| A cold cache at T+0 | First requests render everything from scratch | Warm the key pages a few minutes before |
| An integration falling behind | Order volume spikes and your ERP consumer is sized for normal days | Confirm queue depth handling; alert on lag, not just on errors |
| Inventory oversell | Concurrent checkouts on limited stock | Understand the platform's reservation behaviour and set expectations with the business in advance |
| A last-minute change | Someone edits the live theme at 08:55 | Freeze window, agreed in writing, with one named person able to break it |

:::hint{type=tip}
**The freeze window is a process control, not a technical one, and it is the highest-value item in the list.** Agree it explicitly: no theme editor changes, no app installs, no price edits, no product changes, from a defined time before launch until a defined time after. Put it in the calendar with names attached.

The alternative is a merchandiser making a well-intentioned change at 08:55 that nobody knows about, and a launch failure nobody can explain because the last deploy was three days ago.
:::

## The launch runbook

Write it, share it, and make it executable by someone who is not you.

```markdown title="docs/runbooks/campaign-launch.md"
# Campaign launch runbook

**Campaign:** Spring workwear drop
**Launch:** 2026-03-14 09:00 GMT · **Ends:** 2026-03-21 23:59 GMT
**Owner:** [name] · **Backup:** [name] · **Escalation:** [name, phone]

## T-7 days
- [ ] Campaign theme built, reviewed, merged to `develop`
- [ ] Full regression suite passed on the campaign theme (docs/regression-suite.md)
- [ ] Products created, images uploaded, metafields populated, SEO set — but UNPUBLISHED
- [ ] Discounts created with correct active dates; verified on a test cart
- [ ] Launchpad event configured: theme publish, product publish, price changes, all reverts
- [ ] Campaign page performance profiled; LCP within budget on a throttled profile
- [ ] Third-party scripts on campaign pages reviewed; non-essential ones removed for the window
- [ ] Integration owners notified of expected volume

## T-1 day
- [ ] Freeze begins 17:00. Announced in #commerce and by email.
- [ ] Launchpad event double-checked: correct theme, correct times, correct timezone
- [ ] Rollback theme confirmed present in the theme library and previewed
- [ ] On-call rota confirmed for launch +2 hours
- [ ] Support team briefed: what is launching, expected questions, known limitations

## T-30 minutes
- [ ] Everyone on the call / channel
- [ ] Cache warm: request homepage, campaign collection and top 5 PDPs
- [ ] Monitoring open: Shopify analytics live view, error tracking, integration queue depth
- [ ] Confirm the campaign theme preview still renders correctly

## T-0
- [ ] Launchpad fires. Do NOT click anything manually.
- [ ] Verify within 2 minutes: correct theme live, products visible, prices correct,
      discount applies, add to cart works, checkout reaches payment

## T+15 / T+60 minutes
- [ ] Order flow confirmed end to end, including one real test order
- [ ] Error rates normal; no spike in 4xx/5xx
- [ ] Integration keeping up; queue depth stable
- [ ] Core Web Vitals sampled on the campaign pages

## Rollback
1. Publish theme "Pre-campaign 2026-03-13" (theme library) — ~10 seconds
2. Deactivate campaign discounts (Discounts → set inactive)
3. Unpublish campaign products if the issue is product-level
4. Notify #commerce and support with what changed and what customers may have seen
**Decision owner for rollback:** [name]. **Trigger:** checkout failures, wrong pricing,
or error rate above [threshold] sustained for 5 minutes.

## Post-campaign
- [ ] Revert fired correctly at end time; verify prices and theme
- [ ] Campaign theme merged back or archived
- [ ] Retro: what broke, what was slow, what to change next time
```

That document is a deliverable in its own right, and producing one is a strong signal of seniority. The rollback section specifically — a named decision owner and an objective trigger — is what separates a plan from a hope.

```quiz
question: A campaign requires the homepage to change, ten new products to become visible, and prices on an existing collection to drop, all at 09:00 exactly, with everything reverting a week later. What is the right mechanism?
options:
  - "A Flow workflow scheduled by a time-based trigger"
  - "A Launchpad event scheduling the theme publish, product publishing and price changes, with reverts configured"
  - "Time-gated Liquid conditionals reading the current timestamp"
  - "A calendar reminder and a person clicking Publish"
answer: 1
explanation: "Launchpad exists for exactly this: multiple coordinated changes at a defined time with scheduled reverts. Flow is event-triggered rather than a scheduler for coordinated commerce changes; time-gated Liquid interacts badly with caching and cannot change prices or publish products; a person at 09:00 is the failure mode Launchpad was built to remove."
```

## Choosing the mechanism

| Need | Mechanism |
|---|---|
| Coordinated theme + price + product change at a time, with revert | **Launchpad** |
| Theme change only, at a time | Scheduled theme publishing (available beyond Plus) |
| Discount active for a window | The discount's own active dates |
| A banner appearing and disappearing | Time-gated section, or a merchandiser toggling a setting |
| React to something happening | **Flow** |
| Products appearing at a moment | Launchpad product publishing, or scheduled publishing |
| Anything genuinely one-off and low-risk | A person, with a runbook |

## Exercise

:::checklist{title="Day 20 checklist"}
- [ ] Located Launchpad in your Plus development store and explored the event types
- [ ] Created a campaign theme as a duplicate of the live theme
- [ ] Created five unpublished campaign products with full data and metafields
- [ ] Configured a Launchpad event: publish the theme, publish the products, change prices — with reverts
- [ ] Scheduled the event a few minutes out and watched it fire
- [ ] Verified the revert fired correctly at the end time
- [ ] Built a time-gated campaign banner section with UTC-stored schedule settings
- [ ] Profiled the campaign landing page for LCP on a throttled profile and recorded the number
- [ ] Audited third-party scripts on the campaign pages and removed at least one for the window
- [ ] Wrote the full launch runbook, including a named rollback owner and an objective rollback trigger
- [ ] Ran a rollback rehearsal and timed it
:::

### Stretch problems

1. Run a full launch rehearsal on a development store: build the campaign, configure the event, execute the runbook end to end, then deliberately introduce a failure at T+5 and execute the rollback. Time both.
2. Write the cache-warming script — a small program requesting the campaign pages and the top PDPs a few minutes before launch — and consider what it can and cannot achieve given Shopify's caching.
3. Compare the campaign-theme approach against the settings-driven approach for a recurring seasonal sale that runs four times a year. Produce a recommendation with a cost estimate for each.
4. Write the post-campaign retro template you would use, with the specific questions that surface useful answers rather than "it went fine".

## Where this is going

That closes Chapter 4. You now know what Plus provides and how to program it — Functions, checkout extensions, Flow and scheduled campaigns.

Chapter 5 is B2B: the company and catalog model, the theme work that makes wholesale ordering fast, payment terms and the sales rep workflow, and extending it with everything from this chapter. It is the area where a workwear brand's growth usually lives, and the area most developers have never touched.

Sit the Chapter 4 test first.
