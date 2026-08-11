---
title: "Wholesale Ordering UX: Quick Order & Quantity Rules"
summary: The features that decide whether wholesale buyers use your storefront or keep emailing spreadsheets — quick order grids, SKU bulk entry, saved lists, one-click reorder, CSV upload and multi-line cart handling that survives a 200-line order.
minutes: 120
objectives:
  - Build a quick order grid that adds many variants in one operation
  - Implement SKU-based bulk entry and CSV upload with clear error reporting
  - Build saved lists and one-click reorder using metafields or a lightweight app
  - Make the cart usable at 200 lines — performance, editing, and validation
  - Design for the wholesale buyer's actual workflow rather than the consumer one
keyTerms:
  - term: Quick order grid
    definition: A size-run matrix on a product page letting a buyer enter quantities against every variant at once and add them all in a single operation.
  - term: Bulk add
    definition: A single `/cart/add.js` request containing many items. Far faster and more reliable than looping requests, and atomic from the buyer's perspective.
  - term: Saved list
    definition: A named, reusable set of variants and quantities — a standing order, a site kit — that a buyer can load into the cart.
  - term: Reorder
    definition: Rebuilding a previous order into the cart in one action, handling discontinued items and changed prices gracefully.
  - term: Line item limit
    definition: Shopify's cap on distinct line items in a cart. High, but reachable on a large wholesale order, and worth knowing before a buyer finds it.
  - term: Optimistic concurrency
    definition: Handling the case where cart state changed between the buyer's view and their submission — common when an order is built over an hour.
resources:
  - label: Ajax Cart API — add
    url: https://shopify.dev/docs/api/ajax/reference/cart#post-locale-cart-add-js
  - label: Customer account UI extensions
    url: https://shopify.dev/docs/api/customer-account-ui-extensions
  - label: Order object in Liquid
    url: https://shopify.dev/docs/api/liquid/objects/order
  - label: B2B quantity rules
    url: https://help.shopify.com/en/manual/b2b/catalogs/quantity-rules
---

A consumer buys one or two things after browsing. A trade buyer arrives knowing exactly what they want — often from a paper list, a previous invoice or an ERP report — and wants to enter forty lines and be done.

Everything about a consumer storefront is wrong for that. Product cards, one-at-a-time add-to-cart, a drawer that opens after every item, browsing-oriented navigation. A wholesale buyer will spend ten minutes fighting it, then email their order to their rep instead — and once they do that, your storefront is a catalogue, not a sales channel.

This lesson is about the features that prevent that.

## The quick order grid

For apparel and footwear this is the single highest-value B2B feature: one product, all its size and width variants, one input each, one add.

```liquid title="sections/quick-order-grid.liquid (abridged)"
{%- liquid
  assign option_rows = product.options_by_name[section.settings.row_option]
  assign form_id = 'quick-order-' | append: section.id
-%}

<quick-order-grid data-cart-add-url="{{ routes.cart_add_url }}">
  <table class="quick-order">
    <thead>
      <tr>
        <th scope="col">{{ 'products.b2b.sku' | t }}</th>
        <th scope="col">{{ 'products.b2b.size' | t }}</th>
        <th scope="col">{{ 'products.b2b.available' | t }}</th>
        <th scope="col">{{ 'products.b2b.price_each' | t }}</th>
        <th scope="col">{{ 'products.b2b.quantity' | t }}</th>
        <th scope="col">{{ 'products.b2b.line_total' | t }}</th>
      </tr>
    </thead>
    <tbody>
      {%- for variant in product.variants -%}
        {%- liquid
          assign rule = variant.quantity_rule
          assign step = rule.increment | default: 1
        -%}
        <tr data-variant-id="{{ variant.id }}" data-price="{{ variant.price }}">
          <td class="mono">{{ variant.sku }}</td>
          <th scope="row">{{ variant.title }}</th>
          <td>
            {%- if variant.available -%}
              {%- if variant.inventory_management and variant.inventory_policy != 'continue' -%}
                {{ variant.inventory_quantity }}
              {%- else -%}
                {{ 'products.b2b.in_stock' | t }}
              {%- endif -%}
            {%- else -%}
              <span class="out">{{ 'products.b2b.unavailable' | t }}</span>
            {%- endif -%}
          </td>
          <td>{{ variant.price | money }}</td>
          <td>
            <input
              type="number"
              inputmode="numeric"
              name="quantity-{{ variant.id }}"
              value=""
              min="0"
              step="{{ step }}"
              {% if rule.max %}max="{{ rule.max }}"{% endif %}
              {% unless variant.available %}disabled{% endunless %}
              aria-label="{{ 'products.b2b.quantity_for' | t: variant: variant.title }}"
            >
          </td>
          <td class="line-total" data-line-total>—</td>
        </tr>
      {%- endfor -%}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" colspan="4">{{ 'products.b2b.total' | t }}</th>
        <td data-total-units>0</td>
        <td data-total-value>{{ 0 | money }}</td>
      </tr>
    </tfoot>
  </table>

  <button type="button" data-add-all class="button button--primary" disabled>
    {{ 'products.b2b.add_all' | t }}
  </button>
  <p role="status" aria-live="polite" data-grid-status></p>
</quick-order-grid>
```

```js title="assets/quick-order-grid.js"
class QuickOrderGrid extends HTMLElement {
  connectedCallback() {
    this.addEventListener('input', this.onInput)
    this.querySelector('[data-add-all]').addEventListener('click', this.addAll)
  }

  onInput = (event) => {
    if (event.target.type !== 'number') return
    this.recalculate()
  }

  recalculate() {
    let units = 0
    let value = 0

    for (const row of this.querySelectorAll('tr[data-variant-id]')) {
      const input = row.querySelector('input[type="number"]')
      const qty = Number(input.value) || 0
      const price = Number(row.dataset.price)

      row.querySelector('[data-line-total]').textContent =
        qty > 0 ? this.formatMoney(qty * price) : '—'

      units += qty
      value += qty * price
    }

    this.querySelector('[data-total-units]').textContent = String(units)
    this.querySelector('[data-total-value]').textContent = this.formatMoney(value)
    this.querySelector('[data-add-all]').disabled = units === 0
  }

  addAll = async () => {
    const items = [...this.querySelectorAll('tr[data-variant-id]')]
      .map((row) => ({
        id: Number(row.dataset.variantId),
        quantity: Number(row.querySelector('input').value) || 0
      }))
      .filter((item) => item.quantity > 0)

    if (items.length === 0) return

    this.setStatus(window.themeStrings.adding)

    // ONE request for all of them. Never loop add.js.
    const response = await fetch(this.dataset.cartAddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items,
        sections: ['cart-icon-bubble'],
        sections_url: window.location.pathname
      })
    })

    const data = await response.json()

    if (!response.ok) {
      this.setStatus(data.description || window.themeStrings.cartError, 'error')
      return
    }

    this.setStatus(window.themeStrings.addedLines.replace('{count}', items.length))
    this.reset()
    publish('cart:updated', { cart: data })
  }
}

customElements.define('quick-order-grid', QuickOrderGrid)
```

:::hint{type=danger}
**Never loop `/cart/add.js` per line.** Forty sequential requests is forty round trips, it will hit rate limiting, and a failure halfway leaves a partial cart the buyer has to reconcile by hand.

The `items` array adds everything in one atomic-feeling request. If any line fails validation, Shopify tells you which — and you show that against the row rather than as a generic banner.
:::

Note what the grid deliberately does **not** do: it does not open a cart drawer after adding. A wholesale buyer adding six products in sequence does not want six drawer interruptions. Update the header count, show a confirmation in the status region, and leave them where they are.

## Bulk entry by SKU

The buyer has a list. Let them paste it.

```liquid title="snippets/bulk-sku-entry.liquid"
<bulk-sku-entry data-lookup-url="{{ routes.search_url }}">
  <label for="sku-paste">{{ 'products.b2b.paste_skus' | t }}</label>
  <p class="form-hint">{{ 'products.b2b.paste_format' | t }}</p>
  <textarea id="sku-paste" rows="8" placeholder="BOOT-ST-10-D, 12&#10;GLV-INS-L 6"></textarea>
  <button type="button" data-parse>{{ 'products.b2b.check_lines' | t }}</button>

  <table data-results hidden>
    <thead>
      <tr><th>SKU</th><th>Product</th><th>Qty</th><th>Status</th></tr>
    </thead>
    <tbody></tbody>
  </table>

  <button type="button" data-add-valid hidden>{{ 'products.b2b.add_valid_lines' | t }}</button>
</bulk-sku-entry>
```

The parsing rules that make this feel forgiving rather than fussy:

- Accept comma, tab, space or multiple spaces as the separator. Buyers paste from Excel, from email, from a text file.
- Accept a quantity of 1 when omitted.
- **Match SKUs case-insensitively** and trim whitespace. A buyer typing `boot-st-10-d` means the same thing.
- Report per line: found and added, found but unavailable, quantity adjusted to meet an increment rule, or not found.
- Let them fix the failures and resubmit only those — never make them start over.

:::hint{type=warning}
SKU lookup needs a data source. Options, in rough order of preference:

1. **A JSON file in `assets/`**, regenerated by a scheduled job from the Admin API. Fast, cached on the CDN, no runtime cost. Correct for catalogues up to a few thousand variants and refreshed nightly.
2. **The predictive search endpoint** filtered to SKU-ish fields. No build step, but fuzzier and slower per lookup.
3. **An app proxy** hitting the Admin API server-side. Always current, more moving parts, and the right answer above a certain catalogue size or when availability must be live.

Note that option 1 must be **catalog-aware**: SKUs a given company location cannot buy should not resolve. Either generate per catalog or validate the add server-side and handle the rejection — which the platform does for you, so the JSON file can be a convenience layer over an authoritative check.
:::

## Saved lists and reorder

**Reorder** is the most-used wholesale feature there is, and it is straightforward:

```liquid title="reorder from order history"
<form action="{{ routes.cart_add_url }}" method="post" data-reorder>
  {%- for line in order.line_items -%}
    {%- if line.variant and line.variant.available -%}
      <input type="hidden" name="items[][id]" value="{{ line.variant.id }}">
      <input type="hidden" name="items[][quantity]" value="{{ line.quantity }}">
    {%- endif -%}
  {%- endfor -%}
  <button type="submit">{{ 'customer.order.reorder' | t }}</button>
</form>
```

Handle the awkward cases explicitly, because on a wholesale order there will be some:

- **Discontinued variants** — skip them and say so by name. Silently dropping a line is how a buyer discovers at delivery that their gloves are missing.
- **Changed prices** — the new price applies. Show a note where a line's price differs from the original order.
- **Quantity rules changed** — a case size may have changed since the last order; adjust and report.
- **Location context** — reordering into a different company location than the original order may resolve different products and prices entirely.

**Saved lists** are reorder's sibling. Three implementation routes:

| Approach | Storage | Best for |
|---|---|---|
| Customer metafield holding JSON | Shopify | Simple lists, small teams, no extra infrastructure |
| Company metafield | Shopify | Lists shared across everyone at a company — usually what buyers actually want |
| A small app with its own datastore | Yours | Many lists, sharing, permissions, analytics |

The company metafield route is underrated and worth defaulting to. A site kit or a standing order belongs to the account, not to whichever person created it — and staff turnover at trade accounts is high.

```json title="a company metafield holding saved lists"
{
  "lists": [
    {
      "id": "site-kit-standard",
      "name": "Standard site kit",
      "created_by": "sam@tradeco.example",
      "items": [
        { "variant_id": 43829102, "quantity": 12 },
        { "variant_id": 43829150, "quantity": 24 }
      ]
    }
  ]
}
```

Writing to it needs the Admin API, so this is an app proxy endpoint (Day 13) rather than something the theme can do alone.

```quiz
question: A buyer pastes 60 SKUs into a bulk entry field. Four are not recognised and two exceed available stock. What should happen?
options:
  - "Reject the whole submission with an error so nothing is partially added"
  - "Add the 54 valid lines, adjust or flag the 6 problem lines individually with a specific reason each, and let the buyer fix only those"
  - "Add all 60 and let the cart reject the invalid ones at checkout"
  - "Add the 54 valid lines and show a generic 'some items could not be added' message"
answer: 1
explanation: "Rejecting everything wastes the 54 correct lines. A generic message leaves the buyer to work out which six and why. Per-line status with a specific reason — not found, insufficient stock, quantity adjusted to the case size — plus the ability to resubmit only the failures, is what makes bulk entry usable rather than a novelty."
```

## Making a 200-line cart usable

A consumer cart holds three items. A wholesale cart can hold two hundred, and everything you built for the consumer case degrades.

**Performance.** Re-rendering the entire cart section on every quantity change is fine at 3 lines and painful at 200. Options, in order of preference:

1. Render only the changed line plus the totals, rather than the whole cart section. The Section Rendering API can return several small sections rather than one large one — split the cart into `cart-line`, `cart-totals` and `cart-summary` sections.
2. Debounce quantity changes at ~500ms so a buyer adjusting several lines produces one request.
3. Batch: collect changes and send one `update.js` when the buyer moves on or presses a save button. This is closer to how a spreadsheet behaves and trade buyers find it natural.

**Editing.** Provide a table view, not stacked cards. Keyboard navigation between quantity inputs — Tab moves down the column, Enter commits — is worth the effort. Add a per-line remove and a "clear all".

**Validation.** Surface problems inline before checkout: quantity rules violated, lines below a minimum, unavailable items. A buyer discovering at checkout that line 147 breaks a case rule, having spent twenty minutes building the order, is the experience that sends them back to email.

**Persistence.** Wholesale orders get built over hours, across sessions, sometimes by two people. The cart persists in the session, but consider whether "save this cart as a draft" is a requirement — for many trade accounts it is the difference between using the storefront and not.

:::hint{type=tip}
Shopify caps the number of distinct line items in a cart. It is high — a few hundred — but a large size run across several products can approach it. Find out the current limit, test at it, and make the failure message specific ("you have reached the maximum number of lines; please split this order or contact your rep") rather than an unexplained failure at the moment a buyer presses checkout.
:::

## Exercise

:::checklist{title="Day 23 checklist"}
- [ ] Built a quick order grid rendering every variant with SKU, availability, price and a quantity input
- [ ] Inputs honour min, max and increment from quantity rules
- [ ] Running totals for units and value update as the buyer types
- [ ] Add-all sends **one** request with an items array, and does not open the cart drawer
- [ ] Per-line errors are shown against the row that caused them
- [ ] Built SKU bulk entry accepting comma, tab and space separators, case-insensitively
- [ ] Bulk entry reports per-line status with a specific reason, and allows resubmitting only failures
- [ ] Implemented reorder from order history, handling discontinued variants explicitly by name
- [ ] Implemented saved lists on a company metafield via an app proxy endpoint
- [ ] Cart handles 200 lines without a visible lag on quantity change — measured
- [ ] Cart validates quantity rules inline, before checkout
- [ ] Tested the whole flow as a real B2B contact, with an actual 100-plus-line order
:::

### Stretch problems

1. Build CSV upload: a file input, client-side parse, a preview table with per-line validation, then a single bulk add. Then test it with a genuinely messy file — trailing spaces, blank rows, quantities as text, a BOM at the start.
2. Time a 200-line cart's quantity change with full-section rendering versus per-line rendering. Publish the numbers in your PR.
3. Implement "save cart as list" and "load list into cart", including a merge-versus-replace choice. Then watch someone use it without instructions.
4. Interview someone who buys wholesale for a living — any industry — about how they actually place orders today. Nearly everything in this lesson came from that conversation being had somewhere, and yours will produce two requirements you would not have guessed.

## Where this is going

Tomorrow: the commercial side. Payment terms in the order lifecycle, draft orders as the sales rep's quoting tool, and the internal workflows that make a wholesale channel work for the people selling as well as the people buying.
