---
title: Liquid as a Language
summary: Objects, tags and filters; the global object model; scope isolation in render versus include; and the handful of semantics that separate reading Liquid from writing it well.
minutes: 110
objectives:
  - Navigate the global Liquid object model and know which objects exist in which templates
  - Use control flow, iteration and assignment idiomatically, including the {% liquid %} tag
  - Explain why {% render %} replaced {% include %} and what scope isolation buys you
  - Apply string, money, array and URL filters correctly, including the translation filter
  - Recognise and avoid the Liquid patterns that cause slow server-side rendering
keyTerms:
  - term: Liquid
    definition: Shopify's open-source templating language. Logic-light by design — it can branch, loop and filter, but it cannot define functions, mutate the data model or make network calls.
  - term: Global object
    definition: An object available in every Liquid template without being passed in — `shop`, `cart`, `customer`, `request`, `settings`, `routes`, `localization`, `linklists`, `all_products`.
  - term: Drop
    definition: The Ruby object Shopify exposes to Liquid. Properties are lazily evaluated, which is why accessing an unused property costs nothing but accessing one inside a loop can cost a lot.
  - term: Scope isolation
    definition: "`{% render %}` runs a snippet in a fresh scope: it sees only globals and the arguments you pass. `{% include %}` shared the parent's scope in both directions, and is deprecated."
  - term: Filter
    definition: A function applied with `|` that transforms a value — `{{ product.price | money }}`. Filters chain left to right and never mutate the original.
  - term: t filter
    definition: The translation filter. `{{ 'products.product.add_to_cart' | t }}` looks the key up in `locales/*.json`. Hard-coded English strings in a theme are a defect, not a shortcut.
resources:
  - label: Liquid reference — objects
    url: https://shopify.dev/docs/api/liquid/objects
  - label: Liquid reference — tags
    url: https://shopify.dev/docs/api/liquid/tags
  - label: Liquid reference — filters
    url: https://shopify.dev/docs/api/liquid/filters
  - label: Liquid basics
    url: https://shopify.dev/docs/storefronts/themes/liquid
  - label: Theme translations and the t filter
    url: https://shopify.dev/docs/storefronts/themes/architecture/locales
---

Liquid looks like a toy on first contact. Curly braces, a few tags, no functions, no classes, no imports. Developers coming from React or Vue usually spend their first week trying to work around it and their second week realising the constraints were the point.

Liquid is **deliberately not Turing-complete-feeling**. It runs on Shopify's servers, on shared infrastructure, on every page view of every store. If it let you write arbitrary recursion or make HTTP calls, a badly written theme would take down more than its own storefront. Every "why can't I just—" you hit has that answer behind it.

So the skill is not learning the syntax, which takes an afternoon. It is learning the **object model** — what data is available where — and the small number of semantics with real consequences.

## The three constructs

```liquid title="the-whole-language.liquid"
{{ product.title }}                          {%- comment -%} output {%- endcomment -%}
{% if product.available %}…{% endif %}       {%- comment -%} tag / logic {%- endcomment -%}
{{ product.price | money }}                  {%- comment -%} filter {%- endcomment -%}
```

That is the entire language. `{{ }}` prints, `{% %}` does, `|` transforms. Everything else is vocabulary.

### Whitespace control

The hyphen strips whitespace on that side of the delimiter.

```liquid title="whitespace.liquid"
{%- if collection.products.size > 0 -%}
  <ul>
    {%- for product in collection.products -%}
      <li>{{ product.title }}</li>
    {%- endfor -%}
  </ul>
{%- endif -%}
```

Without the hyphens, every tag leaves a blank line in the output. On a collection page with 50 products and nested logic, that is real bytes over the wire and, worse, it breaks CSS that depends on `white-space` or inline-block spacing. Dawn uses whitespace control almost everywhere. Match it.

### The `{% liquid %}` tag

Consecutive logic tags get noisy. `{% liquid %}` lets you drop the delimiters:

```liquid title="liquid-tag.liquid"
{% liquid
  assign has_sale = false
  if product.compare_at_price > product.price
    assign has_sale = true
    assign discount = product.compare_at_price | minus: product.price
    assign discount_pct = discount | times: 100.0 | divided_by: product.compare_at_price | round
  endif

  assign badge_class = 'badge'
  if has_sale
    assign badge_class = 'badge badge--sale'
  endif
%}
```

Use it for any run of three or more logic-only tags. It is the single biggest readability win available in Liquid, and reviewers notice when you do not use it.

## The object model

This is what actually takes time to learn. Objects fall into three groups.

### Global objects — available everywhere

| Object | What it holds | Used constantly for |
|---|---|---|
| `shop` | Store name, domain, currency, permanent domain, address, metafields | Structured data, canonical URLs, store-wide config |
| `cart` | Items, totals, attributes, note, discounts | Cart drawer, free-shipping bar, upsell logic |
| `customer` | Logged-in customer, orders, addresses, tags, B2B context | Account pages, gated content, wholesale (Chapter 5) |
| `request` | `request.page_type`, `request.path`, `request.host`, `request.design_mode` | Conditional behaviour per page type |
| `settings` | Every value from `settings_schema.json` | Theme-wide colours, typography, feature flags |
| `routes` | Every storefront URL — `routes.cart_url`, `routes.search_url`, … | **Never hard-code URLs.** Routes localise correctly. |
| `localization` | Available countries, languages, current market | Currency and language pickers (Shopify Markets) |
| `linklists` | Navigation menus by handle | Header and footer navigation |
| `all_products` | Any product by handle — `all_products['steel-toe-boot']` | Cross-selling. **Capped at 20 lookups per page.** |

:::hint{type=danger}
`request.design_mode` is `true` only inside the theme editor. It is the correct guard for behaviour that should not run for real customers — auto-playing a video, firing analytics, or infinite-scrolling a collection. Using it as a general "am I in a preview" check is wrong: an unpublished theme previewed by a real URL is *not* design mode.
:::

### Template objects — available on their own page type

`product` exists on `templates/product.*`. `collection` exists on collection templates. `article` and `blog` on blog templates. `page` on pages. `order` on `templates/customers/order`.

The mistake everyone makes once: writing a snippet that assumes `product` exists, then rendering it from the cart drawer, where it does not. Theme Check's `UndefinedObject` catches this, which is why Chapter 1 made a point of it.

```liquid title="defensive-snippet.liquid"
{%- comment -%}
  Renders a product card.
  Accepts: product (required), show_vendor (optional, default false)
{%- endcomment -%}

{%- unless product -%}
  {%- comment -%} Fail loudly in dev, silently in production. {%- endcomment -%}
  {%- if request.design_mode -%}
    <div class="dev-error">card-product: no product supplied</div>
  {%- endif -%}
{%- else -%}
  …the real card markup…
{%- endunless -%}
```

Documenting a snippet's contract in a comment header is a convention Dawn follows and a convention you should enforce in code review. Liquid has no function signatures; the comment *is* the signature.

### Section and block objects

Inside a section, `section.settings.<id>` reads the schema settings and `section.blocks` iterates its blocks. Inside a block loop, `block.settings` and `block.shopify_attributes`. Day 4 is entirely about this.

## Control flow

```liquid title="control-flow.liquid"
{%- if product.available and product.price < 10000 -%}
  In stock, under £100
{%- elsif product.available -%}
  In stock
{%- else -%}
  Sold out
{%- endif -%}

{%- unless customer -%}
  <a href="{{ routes.account_login_url }}">Sign in</a>
{%- endunless -%}

{%- case product.type -%}
  {%- when 'Boots' -%}
    {%- render 'sizing-boots' -%}
  {%- when 'Outerwear', 'Shirts' -%}
    {%- render 'sizing-apparel' -%}
  {%- else -%}
    {%- render 'sizing-generic' -%}
{%- endcase -%}
```

Two gotchas that produce real bugs:

- **There is no `and`/`or` precedence you can rely on.** Liquid evaluates right to left with no parentheses support. `a and b or c` does not mean what you think. Break it into nested `if`s or precompute booleans with `assign`.
- **Truthiness:** only `false` and `nil` are falsy. **Empty string is truthy. Zero is truthy. An empty array is truthy.** Check `blank`, `empty` or `size` explicitly.

```liquid title="truthiness.liquid"
{%- comment -%} Wrong — an empty array is truthy {%- endcomment -%}
{%- if collection.products -%}…{%- endif -%}

{%- comment -%} Right {%- endcomment -%}
{%- if collection.products.size > 0 -%}…{%- endif -%}

{%- comment -%} Also right, and reads better for strings {%- endcomment -%}
{%- if product.description != blank -%}…{%- endif -%}
```

```quiz
question: A product has `metafields.custom.care_instructions` set to an empty string. What does `{% if product.metafields.custom.care_instructions %}` evaluate to?
options:
  - "false, because the string is empty"
  - "true, because only false and nil are falsy in Liquid"
  - "It raises an error"
  - "It depends on the metafield type"
answer: 1
explanation: "Liquid treats only `false` and `nil` as falsy. An empty string, zero and an empty array are all truthy. Use `!= blank` for strings and `.size > 0` for arrays. This is the single most common source of 'why is this empty box rendering' in theme code."
```

## Iteration

```liquid title="loops.liquid"
{%- for product in collection.products limit: 12 -%}
  {{ forloop.index }} of {{ forloop.length }}
  {%- if forloop.first -%}<span class="first">{%- endif -%}
{%- endfor -%}

{%- for i in (1..5) -%}{{ i }}{%- endfor -%}

{%- for tag in product.tags -%}
  {%- if tag contains 'material:' -%}
    {%- assign material = tag | remove: 'material:' -%}
  {%- endif -%}
{%- endfor -%}
```

`forloop` gives you `index`, `index0`, `first`, `last`, `length`, `rindex`. `{% cycle %}` alternates values, `{% break %}` and `{% continue %}` work as expected.

:::hint{type=warning}
**Loops are capped at 50 iterations by default.** `{% for product in collection.products %}` returns 50 unless you pass `limit:` — and if you pass `limit: 200` it still tops out at the platform maximum. Pagination is not optional decoration on a collection page; it is how the platform expects you to handle volume. `{% paginate collection.products by 24 %}` and then loop inside it.
:::

### The loop performance trap

This is the pattern that makes storefronts slow, and it is worth internalising now because it recurs in Chapters 2, 3 and 5.

```liquid title="slow.liquid"
{%- comment -%} SLOW — hits the variants collection on every iteration {%- endcomment -%}
{%- for product in collection.products -%}
  {%- for variant in product.variants -%}
    {%- if variant.available -%}{%- assign has_stock = true -%}{%- endif -%}
  {%- endfor -%}
{%- endfor -%}
```

Liquid objects are **drops** — lazily-evaluated proxies. `product.variants` inside a loop over 24 products means 24 variant lookups the server has to resolve during render, and each one may be a separate data fetch. On a collection page with filters, that is the difference between a 200ms and a 2-second server response, which lands directly on your Time to First Byte.

Almost always there is a precomputed property that answers the question:

```liquid title="fast.liquid"
{%- for product in collection.products -%}
  {%- if product.available -%}…{%- endif -%}          {%- comment -%} already computed {%- endcomment -%}
  {{ product.price_min | money }}                       {%- comment -%} already computed {%- endcomment -%}
  {%- if product.price_varies -%}From {%- endif -%}     {%- comment -%} already computed {%- endcomment -%}
{%- endfor -%}
```

Learn the precomputed properties: `available`, `price_min`, `price_max`, `price_varies`, `compare_at_price_min`, `has_only_default_variant`, `selected_or_first_available_variant`. Reaching into `.variants` on a listing page is a code review comment every single time.

## `render` versus `include`

`{% include %}` is deprecated. It is still supported for legacy themes, and you will meet it in inherited code.

```liquid title="render-vs-include.liquid"
{%- comment -%} Deprecated: snippet shares the caller's scope, both directions {%- endcomment -%}
{% assign heading = 'Featured' %}
{% include 'section-header' %}
{%- comment -%} …and 'section-header' could have changed `heading` for the rest of the page {%- endcomment -%}

{%- comment -%} Modern: explicit arguments, isolated scope {%- endcomment -%}
{% render 'section-header', heading: 'Featured', level: 2 %}

{%- comment -%} Loop form — renders once per item, with `card` bound each time {%- endcomment -%}
{% render 'card-product' for collection.products as card %}

{%- comment -%} With form — binds a single object {%- endcomment -%}
{% render 'price' with product.selected_or_first_available_variant as variant %}
```

What isolation buys you:

- **Snippets become cacheable.** Shopify can cache a `{% render %}` output because its inputs are explicit. `{% include %}` output depends on ambient state, so it cannot be.
- **Snippets become reviewable.** You can read a snippet and know exactly what it needs.
- **Variable collisions stop happening.** A snippet that does `{% assign i = 0 %}` no longer breaks the loop that called it.

The cost is that snippets can no longer see the caller's local variables. They *can* still see globals — `settings`, `cart`, `shop`, `routes` — and inside a section, they can see `section` if you pass it. That trade is worth taking every time.

## Filters worth knowing cold

```liquid title="filters.liquid"
{%- comment -%} Money — respects the store's currency format setting {%- endcomment -%}
{{ 3499 | money }}                        {%- comment -%} £34.99 {%- endcomment -%}
{{ 3499 | money_without_trailing_zeros }}
{{ 3499 | money_with_currency }}          {%- comment -%} £34.99 GBP {%- endcomment -%}

{%- comment -%} URLs — always via routes or a url filter, never hard-coded {%- endcomment -%}
{{ 'theme.js' | asset_url }}
{{ 'component-card.css' | asset_url | stylesheet_tag }}
{{ product | url }}                        {%- comment -%} respects the collection context {%- endcomment -%}
{{ 'boots' | link_to_tag }}
{{ routes.cart_add_url }}

{%- comment -%} Images — image_url replaced the deprecated img_url {%- endcomment -%}
{{ product.featured_image | image_url: width: 800 }}
{{ product.featured_image | image_url: width: 800 | image_tag:
     loading: 'lazy', sizes: '(min-width: 750px) 50vw, 100vw', widths: '400, 800, 1200' }}

{%- comment -%} Strings {%- endcomment -%}
{{ product.description | strip_html | truncatewords: 30 }}
{{ product.title | handleize }}
{{ block.settings.text | newline_to_br }}
{{ 'Some rich text' | escape }}

{%- comment -%} Arrays {%- endcomment -%}
{{ collection.products | map: 'title' | join: ', ' }}
{{ product.tags | where: 'material' }}
{{ collection.products | sort: 'price' | reverse }}
{{ cart.items | sum: 'quantity' }}

{%- comment -%} Translation — the only correct way to output UI copy {%- endcomment -%}
{{ 'products.product.add_to_cart' | t }}
{{ 'cart.general.item_count' | t: count: cart.item_count }}
```

:::hint{type=tip}
`image_tag` is doing a lot of work in that example: it emits `srcset` from the `widths` list, sets `width`/`height` attributes from the image's real aspect ratio (which prevents layout shift and therefore protects your CLS score), and applies `loading="lazy"`. Hand-rolling `<img>` tags in a Shopify theme is almost always a mistake — you will forget one of those three and pay for it in Chapter 3.
:::

### Translations are not optional

```json title="locales/en.default.json"
{
  "products": {
    "product": {
      "add_to_cart": "Add to cart",
      "sold_out": "Sold out",
      "low_stock": {
        "one": "Only {{ count }} left",
        "other": "Only {{ count }} left"
      }
    }
  }
}
```

```liquid
{{ 'products.product.low_stock' | t: count: variant.inventory_quantity }}
```

Keys with `one`/`other` pluralise automatically based on the `count` argument. Even on a single-language store this matters: it means copy changes are a JSON edit a merchandiser can make, rather than a code change that needs you. That is a real capacity win for a solo developer.

Schema strings — the labels in the theme editor — go in `locales/en.default.schema.json` and are referenced as `"label": "t:sections.header.settings.logo.label"`.

## Things Liquid genuinely cannot do

Knowing the wall is where competence starts.

:::cards

:::card{title="No network calls"}
There is no `fetch` in Liquid. Data from a third party reaches the storefront either through metafields (written by an app or your integration), or through client-side JavaScript, or through an app's theme extension. Chapter 3 covers all three.
:::

:::card{title="No functions or recursion"}
Snippets are the closest thing, and they cannot call themselves. Nested navigation menus are therefore hand-unrolled to a fixed depth in every Shopify theme you will ever read. That is not laziness; it is the only option.
:::

:::card{title="No writes"}
Liquid reads the store. It cannot create an order, update a customer or change inventory. Anything that writes goes through a form (`{% form %}`), the Ajax API, or a server-side app.
:::

:::card{title="No arbitrary sorting or filtering at scale"}
`sort` and `where` operate on what has already been fetched, capped at the loop limit. Real filtering is the Search & Discovery / storefront filtering system, covered on Day 10.
:::

:::

## Exercise

Work in your Dawn-based theme, on a branch.

:::checklist{title="Day 2 checklist"}
- [ ] Built a snippet `snippets/product-badge.liquid` that takes `product` and outputs a Sale / New / Sold out badge, with a documented contract comment
- [ ] The badge snippet uses only precomputed product properties — no `.variants` loop
- [ ] Every string in it comes from `locales/en.default.json` via the `t` filter
- [ ] Rendered it with `{% render %}` from `snippets/card-product.liquid`, passing `product` explicitly
- [ ] Converted a run of five consecutive `{% assign %}`/`{% if %}` tags into one `{% liquid %}` block
- [ ] Replaced a hard-coded `/cart` link somewhere in the theme with `{{ routes.cart_url }}`
- [ ] Proved to yourself that an empty string is truthy, by rendering a conditional on an empty metafield
- [ ] `shopify theme check` is clean
:::

### Stretch problems

1. Write a snippet that renders a "You save £X (Y%)" line, correct for products where the variants have different compare-at prices. Decide deliberately whether you use the variant or the product-level minimum, and write a comment explaining why.
2. Take a nested navigation menu (`linklists.main-menu.links` → `link.links`) and render two levels. Then explain in one sentence why you cannot render *n* levels.
3. Find three places in Dawn where `{% render %}` is called with the `for` form. Explain what the alternative would look like and why the `for` form is better.
4. Time it: add `{% for variant in product.variants %}` inside a collection loop, load a collection page with 24 products, and compare the server response time in the network panel against the same page without it. Numbers make the argument better than principle does.

## Where this is going

Tomorrow: architecture. Where a section ends and a template begins, why JSON templates changed everything, what section groups gave back, and how theme blocks let you build a component library that merchandisers can compose without you.
