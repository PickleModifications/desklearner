---
title: Extending B2B with Functions & Custom Data
summary: Bringing Chapter 4 to bear on wholesale — Functions that read the purchasing company, metafield-driven account behaviour, catalog and price list automation, delivery and payment rules per account, and a roadmap for a channel that is about to grow.
minutes: 110
objectives:
  - Write Functions that branch on purchasing company and company location metafields
  - Automate catalog assignment, price updates and account provisioning through the API and Flow
  - Model account-level configuration as metafields rather than as code branches
  - Apply delivery and payment customization rules per wholesale account
  - Produce a prioritised roadmap for a growing wholesale channel
keyTerms:
  - term: purchasingCompany
    definition: The Function input field carrying B2B context — the company, its location and their metafields. Its presence is how a Function knows an order is wholesale.
  - term: Account tier
    definition: A business classification of a wholesale account, modelled as a company metafield, driving pricing, terms, delivery options and messaging.
  - term: Catalog automation
    definition: Assigning catalogs and updating price lists programmatically rather than in the admin, driven by the business's source of truth.
  - term: Freight rule
    definition: A delivery constraint specific to wholesale — pallet shipping over a weight, no express for hazardous goods, free carriage over an order value.
  - term: Order minimum
    definition: A minimum order value or quantity for an account, enforced by a validation Function so it applies to every surface.
  - term: Provisioning
    definition: The end-to-end creation of a wholesale account — company, locations, contacts, catalog, terms, tags — ideally as one automated operation.
resources:
  - label: Function input — purchasing company
    url: https://shopify.dev/docs/api/functions
  - label: Cart and checkout validation API
    url: https://shopify.dev/docs/api/functions/latest/cart-checkout-validation
  - label: Price list API
    url: https://shopify.dev/docs/api/admin-graphql/latest/mutations/priceListFixedPricesAdd
  - label: Company API
    url: https://shopify.dev/docs/api/admin-graphql/latest/objects/Company
---

Chapters 4 and 5 have been running in parallel. This lesson joins them.

The pattern underneath everything here is one you have now seen at four different layers: **put the variation in data, not in code.** Section settings for merchandisers, configuration metafields for Functions, catalogs for pricing, company metafields for accounts. Each time, the effect is the same — the business changes its own behaviour, and you are not in the loop.

For a solo developer owning a channel that is about to grow substantially, that is not an elegance argument. It is the only way the job scales.

## Functions that know about companies

```graphql title="a B2B-aware input query"
query RunInput {
  cart {
    cost { subtotalAmount { amount } }
    buyerIdentity {
      purchasingCompany {
        company {
          id
          tier: metafield(namespace: "b2b", key: "tier") { value }
          freeCarriageThreshold: metafield(namespace: "b2b", key: "free_carriage_over") { value }
        }
        location {
          id
          orderMinimum: metafield(namespace: "b2b", key: "order_minimum") { value }
          freightOnly: metafield(namespace: "b2b", key: "freight_only") { value }
        }
      }
    }
    lines {
      quantity
      merchandise {
        __typename
        ... on ProductVariant {
          id
          product {
            hazardous: metafield(namespace: "ops", key: "hazardous") { value }
          }
        }
      }
    }
  }
}
```

The shape to internalise: **the Function reads configuration from metafields on the company and the location, and behaviour data from metafields on the product.** No hard-coded company IDs, no hard-coded thresholds. Sales ops changes a metafield; the rule changes.

### Order minimums that actually hold

```js title="a validation function"
export function run(input) {
  const purchasing = input.cart.buyerIdentity?.purchasingCompany
  if (!purchasing) return { errors: [] }          // DTC — no minimum

  const raw = purchasing.location?.orderMinimum?.value
  const minimum = raw ? Number(raw) : 0
  if (!minimum) return { errors: [] }

  const subtotal = Number(input.cart.cost.subtotalAmount.amount)
  if (subtotal >= minimum) return { errors: [] }

  const shortfall = (minimum - subtotal).toFixed(2)

  return {
    errors: [
      {
        localizedMessage: `Trade orders require a minimum of ${minimum}. Add ${shortfall} more to continue.`,
        target: '$.cart'
      }
    ]
  }
}
```

Because it is a validation Function rather than theme code, it applies at checkout, through the API, and on draft orders — the exact gap Day 24 identified. Pair it with a visible cart message in Liquid so the buyer sees the shortfall long before checkout; the Function is the guarantee, the Liquid is the courtesy.

### Delivery rules per account

```js title="delivery customization, abridged"
export function run(input) {
  const location = input.cart.buyerIdentity?.purchasingCompany?.location
  const operations = []

  const hasHazardous = input.cart.lines.some(
    (line) => line.merchandise.product?.hazardous?.value === 'true'
  )

  for (const group of input.cart.deliveryGroups) {
    for (const option of group.deliveryOptions) {
      // Hazardous goods cannot go by air/express, regardless of customer.
      if (hasHazardous && option.handle.includes('express')) {
        operations.push({ hide: { deliveryOptionHandle: option.handle } })
        continue
      }

      // Freight-only accounts do not see parcel rates.
      if (location?.freightOnly?.value === 'true' && !option.handle.includes('freight')) {
        operations.push({ hide: { deliveryOptionHandle: option.handle } })
        continue
      }

      // Rename for clarity on wholesale orders.
      if (option.handle.includes('freight')) {
        operations.push({
          rename: { deliveryOptionHandle: option.handle, title: 'Pallet delivery (2–5 working days)' }
        })
      }
    }
  }

  return { operations }
}
```

Note that the hazardous rule applies to everyone and the freight rule applies per account. Both live in the same Function, both driven by metafields, neither requiring a code change when a new account is onboarded or a new hazardous product is added.

## Account configuration as data

Every wholesale account differs in ways the business will keep discovering. Model them as company and location metafields from the start, and the discoveries stop being deployments.

```markdown title="docs/custom-data.md — B2B section"
## Company metafields (namespace: b2b)

| Key | Type | Purpose | Consumed by |
|---|---|---|---|
| tier | single_line_text (validated: bronze/silver/gold) | Account tier | Catalog assignment, Flow, PDP messaging |
| sales_rep | metaobject_reference (sales_rep) | Assigned rep | Account page, Flow notifications |
| credit_limit | money | Hard credit ceiling | Validation Function, finance reporting |
| outstanding_balance | money | Synced from finance nightly | Cart warning, Flow hold |
| free_carriage_over | money | Carriage-paid threshold | Shipping discount Function |
| external_id | single_line_text | ERP account number | Order export, provisioning |

## Company location metafields (namespace: b2b)

| Key | Type | Purpose | Consumed by |
|---|---|---|---|
| order_minimum | money | Minimum order value | Validation Function, cart message |
| freight_only | boolean | Parcel carriers not available | Delivery customization Function |
| delivery_notes | multi_line_text | Standing site access instructions | Checkout UI extension default |
| lead_time_days | number_integer | Quoted lead time | PDP and cart messaging |
```

:::hint{type=tip}
Note the **consumed by** column. On a platform where a single metafield can be read by Liquid, a Function, a Flow workflow, a POS extension and an integration, this column is what makes a field safe to change. Without it, every metafield is load-bearing in unknown ways and nobody dares touch anything.

Fill it in as you build, not as a documentation sprint afterwards. The sprint never happens.
:::

## Automating catalogs and pricing

Fifteen accounts is a form. Three hundred with quarterly price changes is an integration.

**Provisioning.** One script, driven from the CRM or ERP, that creates a company with its `externalId`, its locations, its contacts and roles, assigns the tier metafield, assigns the right catalog, sets payment terms and tags it. What was a twenty-minute manual checklist with three steps people forget becomes one call.

**Price updates.** A cost increase across the range is a price list update, not an afternoon of clicking:

```graphql title="bulk fixed price update"
mutation UpdateTradePrices($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
  priceListFixedPricesAdd(priceListId: $priceListId, prices: $prices) {
    prices { variant { id } price { amount currencyCode } }
    userErrors { field message }
  }
}
```

Percentage-adjustment price lists update themselves when base prices change, which is the strongest practical argument for using percentages wherever the commercial arrangement allows.

**Tier changes.** An account moves from Silver to Gold. That should be: change the tier metafield → Flow reassigns the catalog, updates terms, tags the company and notifies the rep. One field change, five consequences, no developer.

:::hint{type=warning}
**Price and catalog changes are commercially sensitive and hard to reverse.** Before running any bulk price mutation:

1. Dry run against a development store with the same catalog structure.
2. Export the current price list first. That export is your rollback.
3. Run it in a window where someone from the commercial side can verify a sample immediately.
4. Verify as a real buyer, not from the admin — the admin shows configuration, the storefront shows what the customer pays.

A wrong price list on a wholesale catalog can produce orders at the wrong price that you are commercially obliged to honour. This is one of the few places in Shopify work where a mistake is genuinely expensive rather than merely embarrassing.
:::

```quiz
question: The business wants trade accounts in the Gold tier to get free carriage over £750, with the threshold adjustable per account. Where does the threshold live?
options:
  - "Hard-coded in the shipping discount Function"
  - "In a company metafield, read by the Function's input query"
  - "In a theme setting"
  - "In a discount code given to Gold accounts"
answer: 1
explanation: "A company metafield makes the threshold data rather than code: sales ops changes it per account without a deployment, the Function reads it through its input query, and the same Function serves every account. Hard-coding means a redeploy every time commercial terms change — which on a growing wholesale channel is constantly."
```

## A roadmap for a growing channel

When a wholesale channel is expected to grow substantially, the work sequences roughly like this. It is worth having a view on this, because it is exactly the conversation a VP of digital product will want to have.

:::cards

:::card{title="Phase 1 — Foundations"}
Native B2B configured properly: companies, locations, contacts, catalogs, price lists, quantity rules, terms. Theme detects context and shows correct pricing. Test accounts in the regression suite. This is table stakes and everything else assumes it.
:::

:::card{title="Phase 2 — Ordering efficiency"}
Quick order grids, bulk SKU entry, saved lists, reorder, a cart that handles 200 lines. This is where buyer adoption is won or lost — and adoption is what makes the rest worth building.
:::

:::card{title="Phase 3 — Commercial rules"}
Order minimums, credit limits, freight rules, per-account delivery and payment customization — all Functions reading metafields. Enforcement moves from theme to platform, so it holds on every surface.
:::

:::card{title="Phase 4 — Automation"}
Provisioning from the CRM, tier changes driving catalog assignment, price updates by API, rep notifications, order routing. The manual checklists disappear.
:::

:::card{title="Phase 5 — Insight and self-service"}
Reporting, rep tooling, buyer self-service — invoices, statements, returns, account management. This is what makes the channel feel like a system rather than a shop with trade prices.
:::

:::

The sequencing argument, which is worth being able to make: **do not build phase 3 before phase 2.** Commercial rules on a storefront buyers do not use are enforcement against nobody. Adoption first, control second.

## Exercise

:::checklist{title="Day 25 checklist"}
- [ ] Wrote a validation Function enforcing a per-location order minimum from a metafield
- [ ] Confirmed it applies to a draft order as well as a storefront checkout
- [ ] Added a matching Liquid cart message showing the shortfall before checkout
- [ ] Wrote a delivery customization Function with one universal rule and one per-account rule
- [ ] Wrote a shipping discount Function applying free carriage over a company-metafield threshold
- [ ] Every threshold in every Function comes from a metafield — no hard-coded values, verified by reading the code
- [ ] Defined the full B2B metafield set with a "consumed by" column in `docs/custom-data.md`
- [ ] Built a provisioning script creating a company, locations, contacts, catalog assignment and terms in one run
- [ ] Built a Flow workflow reacting to a tier metafield change
- [ ] Performed a bulk price list update with an export taken first as a rollback
- [ ] Verified the price change as a logged-in buyer, not from the admin
- [ ] Wrote the five-phase roadmap for the workwear business, with your own sequencing argument
:::

### Stretch problems

1. Build the tier-change automation end to end: metafield changes → catalog reassigned, terms updated, company tagged, rep notified, buyer emailed. Then test moving an account both up and down a tier, and note what the downgrade case needs that the upgrade does not.
2. Write the account provisioning integration properly, with idempotency: running it twice for the same `externalId` must not create two companies. Then run it twice.
3. Design and implement a "request a quote" flow: buyer builds a cart, submits a quote request, a draft order is created and assigned to the rep, the rep adjusts and sends the invoice. Identify which parts are Flow, which are an app proxy, and which are manual.
4. Write the one-page brief you would give a VP of digital product on the wholesale roadmap: what exists, what is next, what it unlocks commercially, and what it costs. This is the artefact that gets the work funded, and writing it is a different skill from building it.

## Where this is going

That closes Chapter 5. You can now build and extend a native wholesale channel — the model, the storefront, the ordering experience, the commercial rules and the automation.

Chapter 6 is the third channel: Shopify POS. Configuration, custom POS UI extensions, and — most importantly for a business opening stores over the next two years — architecting it so a new location is a deployment rather than a project. It closes with the ownership practices that hold all three channels together.

Sit the Chapter 5 test first.
