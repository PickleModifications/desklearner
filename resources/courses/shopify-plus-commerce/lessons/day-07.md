---
title: "Theme JavaScript: Web Components & Progressive Enhancement"
summary: Writing theme JavaScript with no bundler and no framework — custom elements as the unit of behaviour, event delegation, the theme editor lifecycle, and the discipline that keeps a storefront working when a script fails.
minutes: 110
objectives:
  - Structure theme behaviour as custom elements that initialise and tear down correctly
  - Handle the theme editor's section lifecycle events so merchandisers see live updates
  - Pass server data to the client safely with JSON script tags rather than inline interpolation
  - Apply progressive enhancement so core commerce paths work without JavaScript
  - Load scripts in a way that does not block rendering or inflate Interaction to Next Paint
keyTerms:
  - term: Custom element
    definition: A browser-native component defined with `customElements.define`. Gives you scoped behaviour, automatic initialisation on insertion, and teardown on removal — with no framework.
  - term: connectedCallback
    definition: The custom element lifecycle method fired when the element is inserted into the DOM. In a theme this fires again automatically when the theme editor re-renders a section.
  - term: Event delegation
    definition: Attaching one listener to a stable ancestor and inspecting `event.target`, so dynamically inserted content works without rebinding.
  - term: JSON script tag
    definition: A `script` element with `type="application/json"` containing Liquid-rendered data, read with `JSON.parse(el.textContent)`. The safe way to move server data to the client.
  - term: Progressive enhancement
    definition: Building so the core path works with plain HTML forms and links, and JavaScript improves it. On a storefront this means add-to-cart still works if a script fails to load.
  - term: Interaction to Next Paint
    definition: The Core Web Vital measuring responsiveness — the delay between a user interaction and the next visual update. Long-running main-thread JavaScript is the usual cause of a poor score.
resources:
  - label: MDN — Using custom elements
    url: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
  - label: Section schema — JavaScript and theme editor events
    url: https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema
  - label: Dawn's global.js
    url: https://github.com/Shopify/dawn/blob/main/assets/global.js
  - label: web.dev — optimize INP
    url: https://web.dev/articles/optimize-inp
---

A job description for this kind of role usually contains a phrase like *"without reliance on external frameworks."* That is not a stylistic preference. It is a consequence of the environment: there is no bundler, no tree-shaking, no code-splitting, and every kilobyte of JavaScript is parsed on a mid-range Android over 4G.

It is also, in current browsers, entirely comfortable. Custom elements give you components. `fetch` gives you data. CSS gives you the animation. The things a framework used to be necessary for are in the platform now.

## The unit of behaviour is a custom element

```js title="assets/quantity-input.js"
class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="number"]')
    this.changeEvent = new Event('change', { bubbles: true })

    // One listener on the host, not one per button.
    this.addEventListener('click', this.onClick)
    this.input.addEventListener('change', this.validate)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick)
    this.input?.removeEventListener('change', this.validate)
  }

  onClick = (event) => {
    const button = event.target.closest('button[data-step]')
    if (!button) return

    event.preventDefault()
    const next = Number(this.input.value) + Number(button.dataset.step)
    this.input.value = String(this.clamp(next))
    this.input.dispatchEvent(this.changeEvent)
  }

  validate = () => {
    this.input.value = String(this.clamp(Number(this.input.value)))
  }

  clamp(value) {
    const min = Number(this.input.min || 1)
    const max = this.input.max ? Number(this.input.max) : Infinity
    if (Number.isNaN(value)) return min
    return Math.min(Math.max(value, min), max)
  }
}

customElements.define('quantity-input', QuantityInput)
```

```liquid title="snippets/quantity-input.liquid"
<quantity-input class="quantity">
  <button type="button" data-step="-1" aria-label="{{ 'products.product.quantity.decrease' | t }}">&minus;</button>
  <input
    type="number"
    name="quantity"
    value="{{ quantity | default: 1 }}"
    min="{{ min | default: 1 }}"
    {% if max %}max="{{ max }}"{% endif %}
    step="{{ step | default: 1 }}"
    form="{{ form_id }}"
  >
  <button type="button" data-step="1" aria-label="{{ 'products.product.quantity.increase' | t }}">&plus;</button>
</quantity-input>
```

Everything good about this comes free from the platform:

- **It initialises itself** the moment it appears in the DOM — including when the theme editor injects a re-rendered section, and when a cart drawer swaps in new HTML.
- **It tears itself down** when removed. No leaked listeners across a hundred cart updates.
- **It is scoped.** `this.querySelector` cannot reach another instance.
- **It degrades.** With JavaScript disabled the `<input type="number">` still works with the browser's own stepper, and the form still submits.

That last point is worth holding on to. The `min`, `max` and `step` attributes are set in Liquid, so the quantity rules Chapter 5's B2B work depends on are enforced by the browser and re-validated by the server regardless of whether your script ran.

:::hint{type=tip}
Name custom elements after what they *are*, not what they do: `quantity-input`, `product-form`, `cart-drawer`, `variant-selects`, `predictive-search`. The tag name lives in the DOM for the life of the theme. Names must contain a hyphen — that is a spec requirement, not a convention.
:::

## The theme editor lifecycle

This is what separates theme JavaScript from ordinary web JavaScript, and it is where most inherited code is broken.

In the theme editor, changing a setting re-renders **just that section** and replaces its DOM. There is no page load. Any script that ran on `DOMContentLoaded` and bound listeners via `querySelectorAll` is now bound to elements that no longer exist.

Custom elements solve most of this automatically — `connectedCallback` fires on the new instances. For the rest, listen to Shopify's events:

```js title="assets/section-lifecycle.js"
document.addEventListener('shopify:section:load', (event) => {
  // Fires after a section is re-rendered. event.target is the section wrapper.
  // Custom elements inside it have already run connectedCallback, so use this
  // only for cross-section coordination — re-measuring a sticky header, say.
  window.dispatchEvent(new CustomEvent('theme:layout:changed'))
})

document.addEventListener('shopify:section:unload', (event) => {
  // Clean up anything you registered OUTSIDE the section on its behalf:
  // an IntersectionObserver, a window scroll listener, a timer.
})

document.addEventListener('shopify:block:select', (event) => {
  // The merchant clicked a block in the sidebar. Bring it into view.
  event.target.closest('slideshow-component')?.showSlideFor(event.target)
})

document.addEventListener('shopify:block:deselect', (event) => {
  event.target.closest('slideshow-component')?.resumeAutoplay()
})
```

:::hint{type=warning}
The failure mode here is subtle and reputationally expensive. Your section works perfectly on the storefront. A merchandiser opens the theme editor, changes a setting, and the carousel stops working — but only in the editor, only after an edit, and only until they reload. They report "the theme is buggy". You cannot reproduce it, because you always reload.

Test every interactive section **in the theme editor, by changing a setting, without reloading.** Put it in your definition of done.
:::

## Getting server data to the client

Never interpolate Liquid into a JavaScript string literal.

```liquid title="do-not-do-this.liquid"
<script>
  // Breaks the moment a product title contains an apostrophe.
  // Worse: an injection vector for any data a third party can write.
  var productTitle = '{{ product.title }}';
</script>
```

Do this instead:

```liquid title="product-data.liquid"
<script type="application/json" data-product-json>
  {{ product | json }}
</script>
```

```js title="reading it"
const el = this.querySelector('[data-product-json]')
const product = JSON.parse(el.textContent)
```

`| json` produces correctly escaped JSON, and a `<script type="application/json">` block is not executed, so a stray closing script tag inside a product description cannot break out of it. That is both a correctness fix and a security fix.

For small scalar values, data attributes are cheaper and clearer:

```liquid
<product-form
  data-section-id="{{ section.id }}"
  data-product-url="{{ product.url }}"
  data-cart-add-url="{{ routes.cart_add_url }}"
>
```

:::hint{type=danger}
`{{ product | json }}` on a product with 100 variants is a lot of bytes on every product page, parsed on the main thread before the customer can interact. If you only need availability and price, serialise only that:

```liquid
{%- capture variant_json -%}
[{%- for v in product.variants -%}
  {"id":{{ v.id }},"available":{{ v.available }},"price":{{ v.price }},"options":{{ v.options | json }}}{%- unless forloop.last -%},{%- endunless -%}
{%- endfor -%}]
{%- endcapture -%}
```

Tomorrow's lesson goes further and removes most client-side variant data entirely, using the Section Rendering API to let the server produce the updated markup.
:::

## Progressive enhancement, concretely

Shopify gives you working HTML forms for every core commerce action. Build on top of them rather than replacing them.

```liquid title="snippets/buy-buttons.liquid"
{%- form 'product', product, id: product_form_id, class: 'product-form', novalidate: 'novalidate' -%}
  <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">

  {% render 'quantity-input', form_id: product_form_id, max: variant_max %}

  <button
    type="submit"
    name="add"
    class="button button--primary"
    {% if product.selected_or_first_available_variant.available == false %}disabled{% endif %}
  >
    <span>{{ 'products.product.add_to_cart' | t }}</span>
    {% render 'loading-spinner' %}
  </button>
{%- endform -%}
```

With no JavaScript, that form POSTs to `/cart/add`, Shopify adds the item and redirects to `/cart`. The customer can buy. With JavaScript, a `product-form` element intercepts the submit, posts to `/cart/add.js`, and opens the drawer.

```js title="assets/product-form.js"
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form')
    this.submitButton = this.querySelector('[type="submit"]')
    this.form.addEventListener('submit', this.onSubmit)
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.onSubmit)
  }

  onSubmit = async (event) => {
    event.preventDefault()
    if (this.submitButton.getAttribute('aria-disabled') === 'true') return
    this.setLoading(true)

    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(this.buildPayload())
      })
      const data = await response.json()

      if (!response.ok) {
        // A 422 with a `description` is how Shopify reports "not enough stock".
        this.showError(data.description || data.message)
        return
      }

      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { item: data } }))
    } catch (error) {
      // Network failure: fall back to the real form submit so the customer can still buy.
      this.form.removeEventListener('submit', this.onSubmit)
      this.form.submit()
    } finally {
      this.setLoading(false)
    }
  }
}

customElements.define('product-form', ProductForm)
```

The `catch` branch is the important one and it is the one most themes omit. If the Ajax call fails — flaky mobile network, an aggressive content blocker, a transient platform blip — the customer gets the non-JavaScript path instead of a button that appears to do nothing. On a storefront, a silently failing add-to-cart is revenue you never find out you lost.

```quiz
question: Why build add-to-cart as a `{% form 'product' %}` with a JavaScript submit handler, rather than a plain button with a click handler that posts to /cart/add.js?
options:
  - "Because /cart/add.js requires a form element to supply a CSRF token"
  - "Because the form gives a working non-JavaScript fallback, so a script failure does not break the purchase path"
  - "Because Shopify rejects fetch requests that do not originate from a form"
  - "Because a button cannot submit a variant ID"
answer: 1
explanation: "The Ajax API works fine from a button. The reason to keep the form is resilience: if the script fails to load, is blocked, or throws, the browser's native form submit still adds the item and redirects to the cart. Purchase paths should be the last thing that depends on JavaScript succeeding."
```

## Loading scripts without hurting the vitals

```liquid title="layout/theme.liquid"
{%- comment -%} Global, tiny, needed everywhere. defer keeps it off the critical path. {%- endcomment -%}
<script src="{{ 'global.js' | asset_url }}" defer></script>
```

```liquid title="sections/main-product.liquid"
{%- comment -%} Only where the component exists. Deduplicated by Shopify. {%- endcomment -%}
<script src="{{ 'product-form.js' | asset_url }}" defer></script>
```

Rules that hold up:

1. **`defer` on everything.** `async` on a script that defines a custom element used above the fold causes a visible upgrade flash; `defer` preserves order and runs before `DOMContentLoaded`.
2. **Load per-section, not globally.** A cart drawer script has no business on a blog article.
3. **Import on interaction for heavy things.** A size-chart modal, a video player, a review widget — load them when the customer signals intent.

```js title="assets/lazy-modal.js"
class LazyModal extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.open, { once: true })
  }

  open = async () => {
    // Dynamic import: the heavy module is not in the initial payload at all.
    const { openModal } = await import(this.dataset.moduleUrl)
    openModal(this)
  }
}
customElements.define('lazy-modal', LazyModal)
```

4. **Nothing long-running on the main thread during interaction.** INP is measured from the interaction to the next paint. If a click handler does 200ms of layout-thrashing work before the UI updates, the score is 200ms. Update the UI first (set a loading state), then do the work.

```js title="the INP-friendly order"
onClick = async () => {
  this.setLoading(true)             // paint immediately
  await new Promise(requestAnimationFrame) // let the browser paint
  const result = await this.doExpensiveThing()
  this.render(result)
}
```

:::hint{type=warning}
**Third-party scripts are usually the real INP problem, not your code.** A theme with 3KB of hand-written JavaScript can still score badly because six apps injected 900KB through `content_for_header` and app embed blocks. You cannot fix that in your own JavaScript, which is why Day 12 is a whole lesson on auditing and governing what apps put on the page. Measure before you optimise your own code — you may be tuning the wrong thing.
:::

## A pattern worth stealing: the pub/sub bus

Sections cannot see each other. A cart drawer, a header cart count, a free-shipping progress bar and a sticky add-to-cart all need to know when the cart changes, and none of them should import the others.

```js title="assets/pubsub.js"
const subscribers = {}

export function subscribe(eventName, callback) {
  subscribers[eventName] = subscribers[eventName] || []
  subscribers[eventName].push(callback)
  return () => {
    subscribers[eventName] = subscribers[eventName].filter((cb) => cb !== callback)
  }
}

export function publish(eventName, data) {
  ;(subscribers[eventName] || []).forEach((cb) => cb(data))
}
```

Dawn ships a version of this and it is the right shape: components subscribe in `connectedCallback`, keep the returned unsubscribe function, and call it in `disconnectedCallback`. Using `document.addEventListener` with `CustomEvent` achieves the same thing with no module at all, and is a perfectly defensible choice — the important part is that components are decoupled, not which mechanism you pick.

## Exercise

:::checklist{title="Day 7 checklist"}
- [ ] Rewrote one piece of theme behaviour as a custom element with both `connectedCallback` and `disconnectedCallback`
- [ ] Used event delegation on the host element rather than binding one listener per child
- [ ] Verified in the theme editor that changing a setting re-renders the section and the behaviour still works, with no reload
- [ ] Replaced any Liquid-in-JavaScript-string interpolation with a `type="application/json"` script tag
- [ ] Confirmed add-to-cart still works with JavaScript disabled in DevTools
- [ ] Added a `catch` fallback to your Ajax add-to-cart that submits the real form on network failure
- [ ] Moved a heavy component behind a dynamic `import()` triggered on first interaction
- [ ] Implemented a pub/sub (or `CustomEvent`) bus and used it so the header cart count updates when the drawer changes
- [ ] Audited your scripts: every one is `defer`, and none loads on a page where its element does not exist
- [ ] Ran a Lighthouse trace and recorded your INP and total blocking time as a baseline for Day 11
:::

### Stretch problems

1. Break it deliberately: block your own theme's JavaScript in DevTools' network panel and walk the entire purchase path — PDP, add to cart, cart, checkout. Write down everything that stops working. Anything on that list that is not decorative is a defect.
2. Add a leaked listener on purpose (bind on `document` in `connectedCallback` and never remove it), open a cart drawer fifty times, and watch the listener count grow in DevTools. Then fix it. Seeing the leak makes the discipline stick.
3. Take a section with a slideshow and wire up `shopify:block:select` so clicking a slide in the theme editor sidebar moves the carousel to it. Merchandisers notice this immediately, and it costs ten lines.
4. Measure the parse cost of `{{ product | json }}` on your largest product by comparing the main-thread scripting time with and without it in a Performance trace.

## Where this is going

Tomorrow: the product page. Variants, options, media, and the two competing approaches to variant switching — client-side state versus the Section Rendering API — with a clear recommendation and the reasoning behind it.
