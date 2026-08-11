---
title: Shopify Functions (and the Scripts Migration)
summary: Writing, testing and deploying custom back-end logic that Shopify runs — discount functions, delivery and payment customization, cart transforms and validation — plus how to migrate a store off legacy Scripts without breaking pricing.
minutes: 140
objectives:
  - Explain what a Function is, where it runs, and the constraints that follow from WebAssembly execution
  - Scaffold, run, test and deploy a discount Function with the Shopify CLI
  - Use Function configuration via metafields so merchants can change behaviour without a deployment
  - Choose the correct Function API for a given requirement
  - Plan and execute a migration from Shopify Scripts to Functions
keyTerms:
  - term: Shopify Function
    definition: Custom logic compiled to WebAssembly and executed by Shopify on its own infrastructure at a defined extension point. Deployed as an extension inside an app.
  - term: Function extension target
    definition: The specific point at which a Function runs — product discounts, order discounts, shipping discounts, delivery customization, payment customization, cart transform, cart and checkout validation.
  - term: Function input query
    definition: A GraphQL query declaring exactly what data the Function receives. It defines the input shape and is the only data available at run time.
  - term: Function configuration metafield
    definition: A metafield on the discount, shop or other owner that supplies runtime parameters — thresholds, percentages, excluded collections — so merchants can adjust behaviour without a redeploy.
  - term: Discount class
    definition: Whether a discount applies to products, orders or shipping. A single Function can target one or more classes depending on its API.
  - term: Function runtime limits
    definition: Functions run with a strict instruction budget and no network or filesystem access. They must be deterministic and fast.
resources:
  - label: Shopify Functions overview
    url: https://shopify.dev/docs/apps/build/functions
  - label: Product discount Function API
    url: https://shopify.dev/docs/api/functions/latest/product-discount
  - label: Delivery customization API
    url: https://shopify.dev/docs/api/functions/latest/delivery-customization
  - label: Cart transform API
    url: https://shopify.dev/docs/api/functions/latest/cart-transform
  - label: Migrating from Scripts to Functions
    url: https://shopify.dev/docs/apps/build/functions/migrate-from-scripts
---

Everything before this point has been front end. Functions are where you write code that Shopify itself executes, inside its own transaction path, on every cart and checkout.

That is a meaningful step up in responsibility. A bug in a section makes a page look wrong. A bug in a discount Function charges every customer the wrong price until someone notices. The engineering practices in this lesson — tests, staged rollout, configuration over hard-coding — are proportionate to that.

## What a Function is

You write code (Rust, or JavaScript compiled with Shopify's toolchain), it compiles to **WebAssembly**, and it is deployed as an extension inside an app. Shopify runs it at a defined point in its own flow and uses the output.

The constraints follow directly from that:

- **No network access.** A Function cannot call your API, look something up, or check an external stock system. Everything it needs must come through its input query or its configuration metafield.
- **No filesystem, no persistent state.** Each invocation is independent.
- **A strict instruction budget.** Functions must be fast and are terminated if they exceed it. Loops over thousands of items need care.
- **Deterministic.** The same input must produce the same output. No randomness, no clock-dependent branching that you have not fed in deliberately.

Those constraints are what make Functions safe to run in the checkout path, and they are the first thing to explain when someone asks for a discount that depends on a live external lookup. The answer is not "no" — it is "the data has to be on the store first," usually as a metafield synced by an integration.

## Scaffolding one

```bash title="create the app and the function"
npm init @shopify/app@latest -- --name workwear-commerce
cd workwear-commerce

shopify app generate extension --template discount --name volume-discount
# Choose a language when prompted; JavaScript is the gentler entry point,
# Rust is the better choice for anything performance-sensitive.
```

```text title="extension structure"
extensions/volume-discount/
├── shopify.extension.toml     # target, api version, build config
├── src/
│   ├── run.graphql            # the INPUT query — what data you receive
│   ├── run.js                 # the logic
│   └── run.test.js            # tests
└── package.json
```

```toml title="shopify.extension.toml"
api_version = "2025-10"

[[extensions]]
name = "Volume discount"
handle = "volume-discount"
type = "function"

  [[extensions.targeting]]
  target = "cart.lines.discounts.generate.run"
  input_query = "src/run.graphql"
  export = "run"

  [extensions.build]
  command = ""
  path = "dist/function.wasm"
```

:::hint{type=warning}
Function API targets and their names have changed across API versions as Shopify consolidated the discount APIs. **Scaffold from the CLI and read the generated files** rather than copying a target string from a blog post — the CLI always generates against a current version. Treat the target names in this lesson as illustrative of the shape, not as a value to paste.
:::

## The input query

This is the most important file in the extension. It declares exactly what data the Function receives — nothing else is available.

```graphql title="src/run.graphql"
query RunInput {
  cart {
    buyerIdentity {
      customer {
        id
        # A tag or metafield is how you distinguish customer segments,
        # because the Function cannot look anything up at run time.
        hasAnyTag(tags: ["trade-account"])
      }
      purchasingCompany {
        company {
          id
          name
          tierMetafield: metafield(namespace: "b2b", key: "pricing_tier") { value }
        }
      }
    }
    lines {
      id
      quantity
      cost { amountPerQuantity { amount } }
      merchandise {
        __typename
        ... on ProductVariant {
          id
          product {
            id
            handle
            inCollections(ids: ["gid://shopify/Collection/123456789"]) {
              collectionId
              isMember
            }
            excludedFromDiscounts: metafield(namespace: "custom", key: "no_volume_discount") { value }
          }
        }
      }
    }
  }
  discount {
    # Runtime configuration, so a merchant can change the thresholds
    # without a code deployment.
    configuration: metafield(namespace: "volume-discount", key: "config") { value }
  }
}
```

Two techniques in there worth learning properly:

- **`hasAnyTag` and `inCollections`** ask the platform a boolean question rather than fetching a list. That keeps the input small, which keeps the Function within its instruction budget. Do not fetch all of a product's collections and filter in code.
- **`purchasingCompany`** is the B2B context. Its presence is how a Function knows this is a wholesale order, and its metafields carry the account's pricing tier. Chapter 5 builds on this.

## The logic

```js title="src/run.js"
// @ts-check

const EMPTY = { operations: [] }

export function run(input) {
  const config = parseConfig(input.discount?.configuration?.value)
  if (!config) return EMPTY

  const isTrade =
    Boolean(input.cart.buyerIdentity?.purchasingCompany) ||
    input.cart.buyerIdentity?.customer?.hasAnyTag === true

  if (config.tradeOnly && !isTrade) return EMPTY

  const candidates = []

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== 'ProductVariant') continue
    if (line.merchandise.product.excludedFromDiscounts?.value === 'true') continue

    const tier = config.tiers
      .filter((t) => line.quantity >= t.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0]

    if (!tier) continue

    candidates.push({
      message: `${tier.percentage}% volume discount (${tier.minQuantity}+)`,
      targets: [{ cartLine: { id: line.id } }],
      value: { percentage: { value: tier.percentage } }
    })
  }

  if (candidates.length === 0) return EMPTY

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: 'ALL'
        }
      }
    ]
  }
}

function parseConfig(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.tiers) || parsed.tiers.length === 0) return null
    return parsed
  } catch {
    // A malformed configuration must mean "no discount", never "crash"
    // and never "apply an unintended discount".
    return null
  }
}
```

:::hint{type=danger}
**Fail closed.** Every early return in that function returns *no discount*. A Function that throws, times out or returns malformed output does not stop the checkout — but a Function that returns the wrong output charges real customers the wrong price.

Write the failure path first and make it the safe one. If the configuration is missing, malformed or nonsensical, apply nothing and let someone notice a missing discount, which is a support ticket. The alternative is discovering at month end that every order for three weeks had 40% off.
:::

### Configuration over hard-coding

```json title="the config metafield value"
{
  "tradeOnly": true,
  "tiers": [
    { "minQuantity": 6,  "percentage": 5 },
    { "minQuantity": 12, "percentage": 10 },
    { "minQuantity": 24, "percentage": 15 }
  ]
}
```

Stored as a metafield on the discount, set when the discount is created through the Admin API or through an admin UI extension.

This is the difference between a Function you deploy once and a Function you redeploy every time marketing changes a threshold. Every parameter that a non-developer might reasonably want to change belongs in configuration — the same instinct as schema settings in Chapter 1, applied one layer down.

## Testing

```js title="src/run.test.js"
import { describe, it, expect } from 'vitest'
import { run } from './run'

const config = JSON.stringify({
  tradeOnly: true,
  tiers: [{ minQuantity: 6, percentage: 5 }, { minQuantity: 12, percentage: 10 }]
})

function cart({ quantity, company = null, tags = false }) {
  return {
    cart: {
      buyerIdentity: {
        customer: { id: 'gid://shopify/Customer/1', hasAnyTag: tags },
        purchasingCompany: company
      },
      lines: [
        {
          id: 'gid://shopify/CartLine/1',
          quantity,
          cost: { amountPerQuantity: { amount: '100.00' } },
          merchandise: {
            __typename: 'ProductVariant',
            id: 'gid://shopify/ProductVariant/1',
            product: { id: 'gid://shopify/Product/1', handle: 'boot', excludedFromDiscounts: null }
          }
        }
      ]
    },
    discount: { configuration: { value: config } }
  }
}

describe('volume discount', () => {
  it('applies nothing below the first threshold', () => {
    expect(run(cart({ quantity: 5, company: { company: { id: 'c1' } } })).operations).toHaveLength(0)
  })

  it('applies the highest matching tier', () => {
    const result = run(cart({ quantity: 20, company: { company: { id: 'c1' } } }))
    expect(result.operations[0].productDiscountsAdd.candidates[0].value.percentage.value).toBe(10)
  })

  it('applies nothing for a DTC customer when tradeOnly is set', () => {
    expect(run(cart({ quantity: 20 })).operations).toHaveLength(0)
  })

  it('applies nothing when configuration is malformed', () => {
    const input = cart({ quantity: 20, company: { company: { id: 'c1' } } })
    input.discount.configuration.value = '{ not json'
    expect(run(input).operations).toHaveLength(0)
  })

  it('skips products flagged as excluded', () => {
    const input = cart({ quantity: 20, company: { company: { id: 'c1' } } })
    input.cart.lines[0].merchandise.product.excludedFromDiscounts = { value: 'true' }
    expect(run(input).operations).toHaveLength(0)
  })
})
```

Functions are pure input-to-output transformations, which makes them the most testable code in the whole Shopify stack. There is no excuse for shipping one untested, and the boundary cases — exactly at the threshold, one below, malformed config, missing customer, mixed cart — are where the money is.

```bash title="run and deploy"
npm test

# Execute the compiled function against a captured input, locally
shopify app function run --input test-fixtures/trade-cart.json

# Replay a real invocation from the store's function run log — invaluable for debugging
shopify app function replay

shopify app deploy
```

`shopify app function replay` deserves a mention on its own: it pulls a real execution from the store's Function run log and re-runs it locally. When a merchant reports "this customer did not get the discount", that is how you find out why, with the actual input.

## Choosing the right Function API

| Requirement | API |
|---|---|
| "10% off orders over £200" | Order discount |
| "Buy 3 gloves, get 20% off gloves" | Product discount |
| "Free shipping for trade accounts over £500" | Shipping discount |
| "Hide express delivery for hazardous items" | Delivery customization |
| "Rename or reorder delivery options" | Delivery customization |
| "Only show Net 30 terms to approved companies" | Payment customization |
| "Bundle three items into one line at a fixed price" | Cart transform |
| "Block checkout if the cart breaks a case-quantity rule" | Cart and checkout validation |
| "Charge different prices per customer group" | **Not a Function** — that is B2B catalogs and price lists (Chapter 5) |

That last row matters. Functions are for *rules*; catalogs and price lists are for *prices*. Implementing wholesale pricing as a discount Function is a common and expensive mistake — it shows the DTC price struck through, computes on every request, and does not appear in the places catalog pricing does.

```quiz
question: >-
  A requirement states that wholesale customers must not see express shipping for
  products flagged as hazardous, and that the flag lives in the ERP. What is the
  right approach?
options:
  - "A delivery customization Function that calls the ERP API to check the flag"
  - "Sync the flag from the ERP into a product metafield, then read that metafield in a delivery customization Function"
  - "A Shopify Script, since only Scripts can access shipping rates"
  - "Hide the option in theme JavaScript at checkout"
answer: 1
explanation: "Functions cannot make network calls — they are deterministic and sandboxed. The data must be on the store before the Function runs, which means an integration writes it to a metafield and the input query reads it. Checkout is also not your theme, so client-side hiding is not an option."
```

## Migrating from Scripts

If you inherit a Plus store with Scripts, treat it as a project with a deadline.

:::steps

1. **Inventory.** Every Script, what it does *in business terms*, when it was last changed, and who asked for it. Some will be for campaigns that ended years ago.

2. **Map each to a Function API.** Most map cleanly. Line item pricing becomes a product or order discount; shipping rate manipulation becomes delivery customization or a shipping discount; payment gateway hiding becomes payment customization.

3. **Identify what does not map.** Scripts could do things Functions deliberately cannot. Each of these is a **product decision**, not an engineering one, and needs the requester in the room.

4. **Rebuild with tests.** Reimplement each as a Function, with unit tests covering every case the Script handled and the boundaries it did not.

5. **Run in parallel and reconcile.** Where possible, deploy the Function without publishing the discount, and compare its computed output against the Script's on real carts. Reconcile discrepancies before switching.

6. **Cut over one at a time**, with the Script kept ready to re-enable, and watch order-level discount totals for a full business cycle.

7. **Remove the Script** only after a clean cycle, and document the change.

:::

:::hint{type=tip}
Do not migrate a Script that nobody can explain. A Script whose business purpose no-one recognises is a candidate for **deletion**, not translation — but confirm it by measuring how often it actually fires before removing it. "It runs on 0.02% of orders and no-one knows why" is a very different finding from "it runs on 40% of orders."
:::

## Exercise

:::checklist{title="Day 17 checklist"}
- [ ] Created an app and generated a discount Function extension with the CLI
- [ ] Read the generated `shopify.extension.toml` and can explain every field
- [ ] Wrote an input query that uses `hasAnyTag` and `inCollections` rather than fetching lists
- [ ] Implemented tiered volume discounting driven entirely by a configuration metafield
- [ ] Every failure path returns no discount — verified with a malformed-config test
- [ ] Wrote unit tests covering: below threshold, at threshold, above, DTC versus trade, excluded product, malformed config
- [ ] Ran `shopify app function run` against a captured input
- [ ] Deployed the app and created a discount that uses the Function
- [ ] Placed a test order and confirmed the discount appears correctly in the cart and at checkout
- [ ] Used `shopify app function replay` on a real invocation
- [ ] Built a second Function — a delivery customization hiding an option based on a product metafield
- [ ] Documented both Functions in `docs/functions.md`: purpose, configuration shape, owner, test coverage
:::

### Stretch problems

1. Extend the volume discount to read a `pricing_tier` metafield from the purchasing company and apply different tier tables per tier. This is the exact shape of Chapter 5's requirements, so keep it.
2. Write a cart validation Function that blocks checkout when a trade order breaks case-quantity rules, with a clear customer-facing message. Then consider whether validation or quantity rules (Chapter 5) is the better mechanism, and write down why.
3. Measure the instruction budget: build a Function that loops over a 200-line cart doing nontrivial work and see where it degrades. Knowing the ceiling before you meet it in production is worth an hour.
4. Take a real Shopify Script example from Shopify's migration documentation and rewrite it as a Function, including tests. Then write the cutover plan you would actually follow.

## Where this is going

Tomorrow: checkout extensibility. UI extensions, the branding API, checkout profiles, and what to do about the customisations that used to live in `checkout.liquid` and Additional Scripts.
