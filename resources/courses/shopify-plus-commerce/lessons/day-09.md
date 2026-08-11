---
title: Cart, the Ajax API & the Section Rendering API
summary: Every Ajax Cart endpoint, the Section Rendering API used properly, a cart drawer that keeps four independent components consistent, and the cart-level concerns — attributes, notes, discounts, thresholds — that merchandising teams ask for constantly.
minutes: 130
objectives:
  - Use every Ajax Cart endpoint correctly, including the difference between change, update and add
  - Combine cart mutations with the Section Rendering API to update several components in one round trip
  - Build a cart drawer that stays consistent with the header count, the free-shipping bar and the cart page
  - Handle cart errors properly — inventory limits, sold-out lines, and stale line keys
  - Use cart attributes, notes and line item properties for the business requirements they are meant for
keyTerms:
  - term: Ajax Cart API
    definition: A set of JSON endpoints under /cart for reading and mutating the cart from the browser — add.js, cart.js, change.js, update.js, clear.js.
  - term: Line item key
    definition: The identifier for a cart line, formatted variant-id plus a hash of its properties. Two lines with the same variant but different properties have different keys, which is why change.js must target the key, not the variant ID.
  - term: Section Rendering API
    definition: Passing a `sections` parameter to a cart endpoint (or a `section_id` to a page URL) so the response includes freshly rendered section HTML alongside the JSON.
  - term: Cart attribute
    definition: A key/value pair on the whole cart — delivery date, gift message, a B2B purchase order number. Flows through to the order and is visible in the admin.
  - term: Cart note
    definition: A single free-text field on the cart, shown to the merchant on the order. Distinct from attributes, which are structured.
  - term: Optimistic UI
    definition: Updating the interface immediately on interaction and reconciling with the server response, rather than waiting for the round trip. Improves perceived speed but needs a rollback path.
resources:
  - label: Ajax Cart API reference
    url: https://shopify.dev/docs/api/ajax/reference/cart
  - label: Section Rendering API
    url: https://shopify.dev/docs/api/section-rendering
  - label: Cart object reference
    url: https://shopify.dev/docs/api/liquid/objects/cart
  - label: Dawn's cart implementation
    url: https://github.com/Shopify/dawn/blob/main/assets/cart.js
---

The cart is where a storefront's architecture is tested. The same state appears in four places — a drawer, a header count, a free-shipping progress bar and the cart page — and all four must agree after every mutation, on a flaky connection, while a customer is mashing a quantity stepper.

Most themes get this approximately right and then accumulate bugs: a count that lags by one, a shipping bar that only updates on reload, a quantity change that silently exceeds available stock. All of those come from the same root cause — client-side reimplementation of state the server already computed.

The Section Rendering API is the fix, and this lesson is largely about using it well.

## The Ajax Cart API

Five endpoints. Learn what each one is actually for.

```js title="cart-api.js"
const root = window.Shopify.routes.root   // '/' or '/en-gb/' on a localised store

// ── READ ────────────────────────────────────────────────
const cart = await fetch(`${root}cart.js`).then((r) => r.json())
// { token, item_count, items: [...], total_price, currency, attributes, note, ... }

// ── ADD ─────────────────────────────────────────────────
await fetch(`${root}cart/add.js`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    items: [
      { id: 43829102, quantity: 2, properties: { Engraving: 'A.M.' } },
      { id: 43829103, quantity: 1 }
    ]
  })
})

// ── CHANGE one line ─────────────────────────────────────
// Targets a single line by key (preferred) or 1-based line index.
await fetch(`${root}cart/change.js`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ id: '43829102:0f3a…', quantity: 3 })
})

// ── UPDATE many things at once ──────────────────────────
// Keyed by VARIANT id, and also the only way to set note and attributes.
await fetch(`${root}cart/update.js`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    updates: { 43829102: 3, 43829103: 0 },
    note: 'Leave with the site office',
    attributes: { delivery_date: '2026-03-14', po_number: 'PO-88213' }
  })
})

// ── CLEAR ───────────────────────────────────────────────
await fetch(`${root}cart/clear.js`, { method: 'POST' })
```

:::hint{type=danger}
**`change.js` and `update.js` are not interchangeable, and the difference causes a real bug.**

`update.js` is keyed by **variant ID**. If a customer has the same boot in the cart twice with different engraving properties, those are two lines with the same variant ID — and `update.js` cannot tell them apart. Setting a quantity there applies to the total for that variant, collapsing or mangling the customer's lines.

`change.js` is keyed by **line item key** (`variantId:propertiesHash`) or line index, and can therefore target exactly one line. **Use `change.js` for anything driven by a per-line control**, and `update.js` only for bulk operations, notes and attributes.
:::

:::hint{type=warning}
Line **indexes** shift when a line is removed. If your quantity stepper sends `line: 3` and another tab removed line 1 a moment earlier, you just changed the wrong product. Always use the line **key** from `cart.js`, never the index — the key is stable for the life of that line.
:::

### Always use `Shopify.routes.root`

On a store using Shopify Markets, the storefront may be served under `/en-gb/` or `/fr/`. Hard-coding `/cart/add.js` works in development and breaks for international customers. `window.Shopify.routes.root` is populated by `content_for_header` and is always correct. In Liquid, use `{{ routes.cart_add_url }}` for the same reason.

## The Section Rendering API

Rather than parsing a JSON response and rebuilding markup in JavaScript, ask the server for the rendered HTML of the sections that changed.

```js title="one round trip, four components updated"
const response = await fetch(`${root}cart/change.js`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    id: lineKey,
    quantity: newQuantity,
    sections: ['cart-drawer', 'cart-icon-bubble', 'cart-live-region-text'],
    sections_url: window.location.pathname
  })
})

const data = await response.json()
// data.sections = { 'cart-drawer': '<div …>', 'cart-icon-bubble': '<span …>', … }

for (const [id, html] of Object.entries(data.sections)) {
  const target = document.getElementById(`shopify-section-${id}`)
  if (!target) continue
  target.innerHTML = new DOMParser()
    .parseFromString(html, 'text/html')
    .getElementById(`shopify-section-${id}`).innerHTML
}
```

Three things this buys you, and they compound:

1. **One implementation of the logic.** The free-shipping threshold, the discount display, the "you saved" line and the B2B volume-price tier all exist once, in Liquid. JavaScript never recomputes a price.
2. **Merchant settings apply automatically.** If a merchandiser changes the free-shipping threshold in the theme editor, the drawer reflects it with no code change.
3. **Correctness on the hard cases.** Automatic discounts, Shopify Functions discounts (Chapter 4) and B2B catalog pricing (Chapter 5) are all computed server-side. There is no realistic way to reimplement them in the browser, and any theme that tries will be wrong for exactly the customers who matter most.

`sections_url` tells the server which page context to render in — a cart drawer on a product page may render differently from one on the cart page. Pass the current path.

:::hint{type=tip}
There is also a GET form for any page: `/collections/boots?section_id=main-collection-product-grid`. That is how filtering and infinite scroll are implemented without duplicating the product grid in JavaScript, and Day 10 uses it directly.
:::

### Custom elements make the swap safe

When you replace a section's `innerHTML`, every custom element inside is destroyed and recreated. Because you wrote them as custom elements yesterday, `disconnectedCallback` cleans up and `connectedCallback` re-initialises — automatically, with no wiring. This is the payoff for that discipline, and it is why the architecture in Day 7 was not a stylistic choice.

## A cart drawer that stays consistent

```js title="assets/cart-drawer.js"
class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = subscribe('cart:updated', this.onCartUpdated)
    this.addEventListener('change', this.onQuantityChange)
    this.addEventListener('click', this.onClick)
  }

  disconnectedCallback() {
    this.unsubscribe?.()
  }

  onQuantityChange = async (event) => {
    const input = event.target.closest('[data-line-key]')
    if (!input) return

    const lineKey = input.dataset.lineKey
    const quantity = Number(input.value)

    this.setLineLoading(lineKey, true)

    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          id: lineKey,
          quantity,
          sections: this.sectionsToRender(),
          sections_url: window.location.pathname
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // 422: usually an inventory limit. Shopify tells you the real number.
        this.showLineError(lineKey, data.description || data.message)
        await this.refreshFromServer()   // put the input back to the true value
        return
      }

      this.renderSections(data.sections)
      publish('cart:updated', { cart: data })
    } catch (error) {
      this.showLineError(lineKey, window.themeStrings.cartNetworkError)
      await this.refreshFromServer()
    } finally {
      this.setLineLoading(lineKey, false)
    }
  }
}

customElements.define('cart-drawer', CartDrawer)
```

Two habits in there worth naming:

- **On any error, re-read the server state.** Never leave the UI showing a value the server rejected. A quantity input stuck at 5 when the server holds 3 will produce a support ticket that reads like a pricing bug.
- **Publish an event rather than reaching into other components.** The header count, the sticky add-to-cart and the shipping bar subscribe. The drawer does not know they exist.

## Cart errors, honestly

```js title="error shapes worth handling"
// 422 from add.js when stock is insufficient:
{
  "status": 422,
  "message": "Cart Error",
  "description": "You can only add 3 Steel Toe Work Boot / 10 / D to the cart.",
  "errors": { "quantity": ["…"] }
}
```

Shopify's `description` is customer-readable and includes the actual available quantity. Show it. Replacing it with a generic "Something went wrong" throws away the only useful information in the response — and a customer who is told "only 3 available" buys 3, while a customer told "something went wrong" leaves.

Cases to design for:

| Case | What the server does | What the UI should do |
|---|---|---|
| Requested quantity exceeds stock | 422 with a description naming the maximum | Show the message, set the input to the maximum |
| Variant became sold out while in the cart | Line remains but is unavailable at checkout | Flag the line clearly before the customer reaches checkout |
| Cart token expired or cleared in another tab | Endpoints act on a new empty cart | Re-read `cart.js` on drawer open and on `visibilitychange` |
| A discount code became invalid | Totals change silently on re-render | Because you re-render server-side, this is handled for free |

:::hint{type=tip}
Re-reading the cart when the tab regains focus is a cheap fix for the most annoying class of cart bug — two tabs, two states:

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') this.refreshFromServer()
})
```
:::

## Cart attributes, notes and properties

Three similar-looking mechanisms with distinct correct uses. Merchandising teams ask for all of them, usually without knowing which they want.

:::cards

:::card{title="Line item property"}
Attached to **one line**. Engraving text, a monogram, a personalisation, a gift-wrap flag for that item. Set at add-to-cart via `properties[Name]`. Makes otherwise identical lines distinct.
:::

:::card{title="Cart attribute"}
Attached to the **whole cart**, structured as key/value. Delivery date, purchase order number, job site reference, a chosen store for pickup. Set via `update.js` or a `{% form 'cart' %}` field named `attributes[Key]`.
:::

:::card{title="Cart note"}
One free-text field on the whole cart. "Leave with the site office." Use it for exactly that — unstructured customer instructions. Do not encode structured data into it, however tempting.
:::

:::card{title="Underscore-prefixed"}
A property or attribute whose key starts with `_` is hidden from the customer, the order status page and the confirmation email — but visible in the admin and to APIs. The right home for internal metadata like an attribution source or a quote reference.
:::

:::

```liquid title="cart attributes in a form"
{%- form 'cart', cart -%}
  <label for="delivery-date">{{ 'cart.attributes.delivery_date' | t }}</label>
  <input
    type="date"
    id="delivery-date"
    name="attributes[delivery_date]"
    value="{{ cart.attributes.delivery_date }}"
  >

  <label for="cart-note">{{ 'cart.general.note' | t }}</label>
  <textarea id="cart-note" name="note">{{ cart.note }}</textarea>

  <button type="submit" name="checkout">{{ 'cart.general.checkout' | t }}</button>
{%- endform -%}
```

Attributes flow through to the order and are readable by Flow (Day 19), by Functions (Day 17) and by your ERP integration (Day 29). That makes them the standard mechanism for carrying business context from the storefront into fulfilment — and it is exactly how a B2B purchase order number gets from a wholesale buyer's cart onto the order your finance team sees.

```quiz
question: A cart contains the same boot twice — once with an engraving property and once without. The customer changes the quantity on the engraved line. Which endpoint should the request use?
options:
  - "update.js, keyed by the variant ID"
  - "change.js, keyed by the line item key"
  - "add.js with a negative quantity"
  - "clear.js followed by re-adding every line"
answer: 1
explanation: "Both lines share a variant ID, so update.js cannot distinguish them and will apply the quantity across the variant. change.js targets a specific line by its key (variant ID plus a hash of its properties), which is the only way to modify one of two lines that share a variant."
```

## Free shipping progress: server-side, please

The requirement that always arrives: "show how much more they need to spend for free shipping."

The tempting implementation is a JavaScript constant and some arithmetic on `cart.total_price`. It will be wrong, because it does not know about: automatic discounts, Function-based discounts, B2B catalog pricing, market-specific thresholds, or whether the merchandiser changed the threshold this morning.

Do it in Liquid, inside a section, and let the Section Rendering API keep it fresh:

```liquid title="sections/free-shipping-bar.liquid"
{%- liquid
  assign threshold = settings.free_shipping_threshold | times: 100
  assign remaining = threshold | minus: cart.total_price
  assign progress = cart.total_price | times: 100 | divided_by: threshold
  if progress > 100
    assign progress = 100
  endif
-%}

<div class="shipping-bar" style="--progress: {{ progress }}%;">
  {%- if remaining > 0 -%}
    <p>{{ 'cart.shipping.remaining_html' | t: amount: remaining | money }}</p>
  {%- else -%}
    <p>{{ 'cart.shipping.qualified' | t }}</p>
  {%- endif -%}
  <div class="shipping-bar__track" role="progressbar" aria-valuenow="{{ progress }}" aria-valuemin="0" aria-valuemax="100"></div>
</div>

{% schema %}
{ "name": "Free shipping bar", "settings": [] }
{% endschema %}
```

Add `'free-shipping-bar'` to the `sections` array on every cart mutation and it updates itself. No JavaScript arithmetic, no drift, and a merchandiser can change the threshold in theme settings without a ticket.

## Exercise

:::checklist{title="Day 9 checklist"}
- [ ] Built a cart drawer as a custom element with pub/sub coordination
- [ ] Every mutation passes a `sections` array and updates the drawer, header count and shipping bar in one round trip
- [ ] Per-line quantity controls use `change.js` with the **line key**, not `update.js` and not an index
- [ ] Verified the two-identical-variants-different-properties case behaves correctly
- [ ] 422 errors display Shopify's own `description`, and the input is reset to the server's value
- [ ] Network failures show a message and re-read `cart.js` rather than leaving stale UI
- [ ] Cart refreshes on `visibilitychange`, and you confirmed the two-tab case is handled
- [ ] All cart URLs built from `window.Shopify.routes.root` / `{{ routes.* }}` — nothing hard-coded
- [ ] Free shipping bar computed entirely in Liquid and refreshed via the Section Rendering API
- [ ] A cart attribute (delivery date or PO number) persists through to a test order in the admin
- [ ] Cart page and cart drawer share the same section, not two implementations
:::

### Stretch problems

1. Implement optimistic UI on the quantity stepper — update the number immediately, then reconcile with the server response and roll back on error. Then decide, honestly, whether it was worth the complexity for the perceived-speed gain.
2. Add a "you might also need" upsell in the drawer, driven by a `product_reference` metafield list on the cart's items. Note how much of it is Liquid and how little is JavaScript.
3. Deliberately create a stale cart: open the store in two tabs, empty the cart in one, then change a quantity in the other. Record what happens, then fix it.
4. Instrument the drawer: log the time from interaction to rendered update. Compare a Section Rendering round trip against a purely client-side update. Whatever the numbers say, you now have a defensible position when someone asserts that server rendering "feels slow".

## Where this is going

Tomorrow: the merchandising surfaces. Collections and pagination, Search & Discovery filtering, predictive search, and the storytelling sections a brand team will ask you for — all built on the Section Rendering API you just learned.
