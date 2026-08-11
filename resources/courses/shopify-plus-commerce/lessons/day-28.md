---
title: Scaling POS to a Multi-Location Retail Network
summary: Making store number eight cost a day instead of a project — configuration as code, location metafields, inventory and fulfilment routing, staff onboarding, and the operational practices that hold across a growing network.
minutes: 110
objectives:
  - Design a location configuration model that scales without code changes per store
  - Script store provisioning against the Admin API
  - Reason about inventory allocation, fulfilment routing and transfers across locations
  - Build POS extensions and Flow automations that are location-agnostic by construction
  - Produce a store opening runbook and support model a retail team can actually use
keyTerms:
  - term: Configuration as code
    definition: Expressing store setup — locations, metafields, publications, roles, workflows — as scripts and data files under version control rather than as a sequence of admin clicks.
  - term: Fulfilment priority
    definition: The order in which Shopify considers locations when routing an online order for fulfilment.
  - term: Ship from store
    definition: Using retail locations as fulfilment nodes for online orders, trading shipping speed and cost against store inventory and staff time.
  - term: Transfer
    definition: A recorded movement of inventory between locations, with an in-transit state.
  - term: Location metafield
    definition: Custom data attached to a location — hours, manager, phone, features, service capabilities. The mechanism that keeps store-specific detail out of code.
  - term: Golden configuration
    definition: The documented, agreed standard setup a new store starts from, deviated from only with a recorded reason.
resources:
  - label: Locations and inventory
    url: https://help.shopify.com/en/manual/fulfillment/setup/locations
  - label: Order routing
    url: https://help.shopify.com/en/manual/fulfillment/managing-orders/order-routing
  - label: Inventory transfers
    url: https://help.shopify.com/en/manual/products/inventory/transfers
  - label: Location object — Admin API
    url: https://shopify.dev/docs/api/admin-graphql/latest/objects/Location
---

A business planning to go from one store to eight has a specific engineering requirement, and it is not "build POS features". It is: **make opening a store boring.**

The difference between a retail network that scales and one that does not is almost entirely front-loaded. The decisions you make at store one determine whether store six takes a day or three weeks — and by store six, nobody remembers who made those decisions or why.

## The anti-pattern

You will recognise it because it is what happens by default:

```js title="how not to do it"
// In a POS extension
const STORE_CONFIG = {
  'gid://shopify/Location/12345': { name: 'North Reading', hasFittingBay: true,  manager: 'sam@…' },
  'gid://shopify/Location/12346': { name: 'Worcester',     hasFittingBay: false, manager: 'priya@…' }
}
```

```liquid title="and in the theme"
{%- if location.id == 12345 -%}
  <p>Open until 8pm on Thursdays</p>
{%- endif -%}
```

Every one of these is a deployment when a store opens, changes its hours, or gets a new manager. Multiply by the theme, the POS extension, three Flow workflows and a Function, and store six is a sprint.

## Configuration as data

**Everything store-specific lives in location metafields or a metaobject.**

```markdown title="docs/custom-data.md — locations"
## Location metafields (namespace: retail)

| Key | Type | Purpose | Consumed by |
|---|---|---|---|
| opening_hours | json | Structured weekly hours + exceptions | Store locator, POS tile, receipts |
| manager_email | single_line_text | Escalation contact | Flow notifications |
| phone | single_line_text | Public number | Store locator, order emails |
| features | list.single_line_text | fitting_bay, embroidery, trade_counter | Store locator filters, POS extension |
| pickup_instructions | multi_line_text | Where to collect | Local pickup messaging, POS |
| opened_on | date | Store opening date | Reporting cohorts |
| region | single_line_text | Regional grouping | Reporting, routing rules |
```

Then every surface reads the data:

```liquid title="store locator — works for any number of stores"
{%- for loc in shop.metaobjects.retail_location.values -%}
  <article class="store-card">
    <h3>{{ loc.name }}</h3>
    <address>{{ loc.address }}</address>
    <p>{{ loc.phone }}</p>
    {%- if loc.features.value contains 'fitting_bay' -%}
      <span class="chip">Boot fitting available</span>
    {%- endif -%}
  </article>
{%- endfor -%}
```

```jsx title="POS extension — works at any location"
const { locationId } = api.session.currentSession
const config = await fetchLocationConfig(locationId)   // your backend reads the metafields

if (config.features.includes('fitting_bay')) {
  // show the fitting workflow tile
}
```

Neither of those changes when store nine opens. That is the whole objective.

:::hint{type=tip}
A **metaobject** is often better than location metafields for public-facing store data, because it can have the web page capability (Day 5) — each store gets its own URL, SEO record and page for free, and the store locator becomes a loop over entries.

The pragmatic split most teams land on: a `retail_location` metaobject for customer-facing content, location metafields for operational data that POS and internal systems read, and a reference between them. Write down which is which, because the boundary is not self-evident to the next person.
:::

## Scripting a store opening

```js title="scripts/provision-store.mjs (abridged)"
import { readFileSync } from 'node:fs'
import { adminRequest } from './admin-client.mjs'

const store = JSON.parse(readFileSync(process.argv[2], 'utf8'))

// 1. Create the location
const { locationAdd } = await adminRequest(LOCATION_ADD, {
  input: {
    name: store.name,
    address: store.address,
    fulfillsOnlineOrders: store.fulfilsOnline
  }
})
const locationId = locationAdd.location.id

// 2. Set operational metafields
await adminRequest(METAFIELDS_SET, {
  metafields: Object.entries(store.metafields).map(([key, value]) => ({
    ownerId: locationId,
    namespace: 'retail',
    key,
    type: value.type,
    value: value.value
  }))
})

// 3. Create the customer-facing metaobject entry and link it
const { metaobjectCreate } = await adminRequest(METAOBJECT_CREATE, {
  metaobject: {
    type: 'retail_location',
    fields: [
      { key: 'name', value: store.name },
      { key: 'address', value: store.formattedAddress },
      { key: 'phone', value: store.phone },
      { key: 'location_reference', value: locationId }
    ]
  }
})

// 4. Publish the standard product set to POS for this location
// 5. Apply the standard smart grid template
// 6. Assign staff and roles from the staffing file
// 7. Register the location in the fulfilment routing configuration

console.log(`Provisioned ${store.name}: ${locationId}`)
```

```json title="stores/worcester.json"
{
  "name": "Worcester",
  "fulfilsOnline": true,
  "address": { "address1": "12 Trade Park", "city": "Worcester", "countryCode": "GB", "zip": "WR1 1AA" },
  "phone": "+44 1905 000000",
  "metafields": {
    "opening_hours": { "type": "json", "value": "{\"mon\":\"07:00-18:00\"}" },
    "features": { "type": "list.single_line_text_field", "value": "[\"fitting_bay\",\"trade_counter\"]" },
    "region": { "type": "single_line_text_field", "value": "midlands" }
  }
}
```

A new store is a JSON file and a script run. The file goes in the repository, so the configuration of every store is in version control and diffable — which answers "what changed at Worcester?" in one command.

:::hint{type=warning}
Some of a store opening genuinely cannot be scripted: physical hardware, staff PINs, the opening stocktake, card reader pairing, and any local tax registration. Those stay in the runbook.

The goal is not full automation. It is that **everything repeatable is repeated identically**, and the manual remainder is a short, well-documented list rather than an undocumented sprawl — because the manual remainder is where the variation, and therefore the support burden, comes from.
:::

## Inventory and fulfilment across locations

Adding retail locations changes online fulfilment, and this is where a retail rollout most often surprises the ecommerce team.

**Fulfilment priority** determines which location Shopify considers first for an online order. The trade-offs are real:

| Strategy | Pro | Con |
|---|---|---|
| Warehouse first, always | Predictable, protects store stock for walk-ins | Slower delivery, warehouse stockouts while stores hold units |
| Nearest location | Faster, cheaper shipping | Store staff picking orders during trading hours |
| Highest stock first | Balances inventory naturally | Ignores distance |
| Store-first for specific products | Clears slow-moving store stock | Needs per-product rules and maintenance |

There is no correct answer — it is a business decision between shipping cost, delivery speed, store labour and stock availability. Your job is to make the trade-off legible and then implement it, and to revisit it when the network grows.

:::hint{type=danger}
**Ship-from-store consumes store staff time during trading hours**, and that cost is invisible in ecommerce metrics while being very visible on the shop floor. Introduce it with retail operations, with agreed limits — a daily cap, a cut-off time, a minimum stock buffer that is never picked for online orders.

A rollout that quietly turns stores into warehouses without that conversation damages the relationship with retail permanently, and you will need that relationship for everything else in this chapter.
:::

**Safety stock buffers** matter more with each location. If a store's last unit is sold online while a customer is holding it, that is a bad moment for an associate and a lost customer. Reserve a buffer per location, per product category, and treat the number as a business setting rather than a constant in code.

**Transfers** move stock between locations with an in-transit state. As a network grows, inter-store transfers become routine, and the reporting on them is a leading indicator of allocation quality: lots of transfers means the initial allocation is wrong.

## Location-agnostic automation

The same principle as the extension code, applied to Flow.

```text
❌ [INVENTORY] Notify Sam when North Reading is low
✅ [INVENTORY] Low stock at any retail location → notify that location's manager_email metafield
```

```liquid title="in the Flow action"
To: {{ location.metafields.retail.manager_email }}
Subject: Low stock at {{ location.name }}

{{ product.title }} ({{ variant.sku }}) is down to {{ inventoryLevel.available }} units
at {{ location.name }}.

Region: {{ location.metafields.retail.region }}
```

One workflow serves every store, forever. The alternative — one workflow per store — is eight workflows to update when the alert threshold changes, and eight opportunities to miss one.

The same for reporting: tag orders with the location's region metafield at creation, and regional reporting works the day a new region exists.

```quiz
question: A POS extension shows a fitting-bay workflow. Store six opens without a fitting bay. What should have been done at store one to make this a non-event?
options:
  - "A build-time constant listing which stores have fitting bays"
  - "A `features` list metafield on each location, read at run time from the session's location ID"
  - "A separate extension version per store"
  - "A theme setting toggled per store"
answer: 1
explanation: "The extension reads the current location from the session and looks up its features. Store six opens with a JSON file and a script run, and the extension behaves correctly with no deployment. Every alternative listed requires a code change per store, which is exactly the compounding cost this lesson exists to avoid."
```

## The support model

Eight stores means eight sets of people who will contact someone when something is wrong at the till. Without a defined path, that someone is you, at all hours.

**Tiering, agreed in advance:**

1. **Store manager** — handles the known cases from a troubleshooting card: device restart, reader re-pair, product not published, wrong location selected.
2. **Retail operations** — configuration, permissions, inventory discrepancies, staff accounts.
3. **You** — genuine platform issues, extension defects, integration failures.
4. **Shopify support** — platform outages, hardware faults, account-level problems.

**A one-page troubleshooting card** in every store, covering the ten most common issues with their fixes. It removes most tier-one contacts and it takes an afternoon to write.

**A known-issues list** the retail team can read, so nobody reports the same thing twelve times.

**A release calendar** so stores know when something will change. POS extension deploys hit every device at once (Day 27) — stores should never be surprised by a changed workflow mid-shift.

:::hint{type=tip}
Visit a store. Stand behind the till for an hour during a busy period.

You will learn more about what to build than in a month of tickets, and you will earn credibility with retail staff that makes every subsequent conversation easier. It is the highest-return day in the whole role for someone owning a POS implementation, and almost nobody does it.
:::

## Exercise

:::checklist{title="Day 28 checklist"}
- [ ] Defined the full location metafield set with a "consumed by" column
- [ ] Created `retail_location` metaobject entries linked to real locations
- [ ] Store locator renders from metaobject entries with no hard-coded stores
- [ ] Wrote `scripts/provision-store.mjs` creating a location, metafields and a metaobject entry from a JSON file
- [ ] Provisioned a second store entirely from a JSON file and a script run
- [ ] Audited every POS extension, Function, Flow workflow and Liquid file for hard-coded location IDs — and removed any found
- [ ] Rewrote a location-specific Flow workflow to be location-agnostic via `manager_email`
- [ ] Documented the fulfilment priority strategy with its trade-offs
- [ ] Implemented and documented a safety stock buffer policy
- [ ] Performed an inventory transfer between locations
- [ ] Wrote `docs/runbooks/new-store-setup.md` covering the scripted and manual steps
- [ ] Wrote the one-page store troubleshooting card
- [ ] Defined the four-tier support model and who owns each tier
:::

### Stretch problems

1. Provision three stores from JSON files, then change a shared setting — the low-stock threshold, say — and confirm it takes one edit rather than three. If it takes three, the model is wrong; fix it.
2. Model the fulfilment routing decision quantitatively for the workwear business: shipping cost, delivery time, store labour cost per pick, and stockout risk. Produce a recommendation with numbers rather than instincts.
3. Design the store opening timeline as a project plan: T-8 weeks to opening day, with owners. Identify which items you own, which retail owns, and which are shared.
4. Write the "what to do if the till stops working" card as a retail manager would want it — no jargon, decision-tree format, one page, laminatable.

## Where this is going

Tomorrow: apps, integrations and platform configuration — evaluating and integrating third-party tools across all three channels, and connecting Shopify to the back-office systems the business already runs on.
