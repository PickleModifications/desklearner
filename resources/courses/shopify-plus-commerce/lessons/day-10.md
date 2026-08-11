---
title: Collections, Search, Filtering & Brand Storytelling
summary: The merchandising surfaces — collection templates and pagination, Search & Discovery filtering wired through the Section Rendering API, predictive search, and the flexible content sections a brand team actually asks for.
minutes: 120
objectives:
  - Build a collection template with correct pagination, sorting and SEO behaviour
  - Implement storefront filtering with the filter object, URL state and section re-rendering
  - Build predictive search that is fast, accessible and keyboard-navigable
  - Design flexible storytelling sections that give merchandisers real range without breaking the design
  - Explain the trade-offs of infinite scroll, load-more and pagination for commerce
keyTerms:
  - term: Storefront filtering
    definition: Shopify's native faceted filtering, configured in the Search & Discovery app and exposed to Liquid as `collection.filters` / `search.filters`. Filters can be based on availability, price, options, tags and metafields.
  - term: Filter object
    definition: A Liquid object representing one filter — its label, type, active values and, crucially, the URLs to apply or remove each value. Never build filter URLs by hand.
  - term: Paginate
    definition: The Liquid tag that splits a large collection into pages and exposes a `paginate` object with page links. Required beyond the loop's default limit.
  - term: Predictive search
    definition: A storefront endpoint returning type-ahead results as JSON or rendered section HTML, covering products, collections, pages, articles and queries.
  - term: Canonical URL
    definition: The `<link rel="canonical">` telling search engines which URL is authoritative. Filtered and sorted collection URLs must not all claim to be canonical versions of themselves.
  - term: Storytelling section
    definition: A flexible, merchandiser-configurable content section — image with text, editorial banner, lookbook, testimonial row — that carries brand narrative between product surfaces.
resources:
  - label: Storefront filtering
    url: https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering
  - label: Filter object reference
    url: https://shopify.dev/docs/api/liquid/objects/filter
  - label: Predictive search
    url: https://shopify.dev/docs/api/ajax/reference/predictive-search
  - label: Paginate tag
    url: https://shopify.dev/docs/api/liquid/tags/paginate
  - label: Search & Discovery app
    url: https://help.shopify.com/en/manual/online-store/search-and-discovery
---

Collection pages are where most storefront sessions actually happen. They are also, in most themes, the slowest page, the worst-filtered page and the one nobody has looked at since launch.

That is an opportunity. A collection page that filters instantly, keeps URL state, and does not shift layout is a measurable conversion difference, and it is entirely within your control.

## The collection template

```liquid title="sections/main-collection-product-grid.liquid (abridged)"
{%- paginate collection.products by section.settings.products_per_page -%}
  <div class="collection" id="ProductGrid-{{ section.id }}">
    {%- if collection.products.size == 0 -%}
      {% render 'empty-collection-state', collection: collection %}
    {%- else -%}
      <ul class="card-grid" style="--cards-per-row: {{ section.settings.columns_desktop }};">
        {%- for product in collection.products -%}
          <li>
            {% render 'card-product',
                 product: product,
                 lazy_load: forloop.index > 4,
                 show_vendor: section.settings.show_vendor %}
          </li>
        {%- endfor -%}
      </ul>

      {%- if paginate.pages > 1 -%}
        {% render 'pagination', paginate: paginate %}
      {%- endif -%}
    {%- endif -%}
  </div>
{%- endpaginate -%}
```

Details that matter:

- **`{% paginate %}` is mandatory beyond the default limit.** Without it the loop stops at 50 regardless of how many products the collection contains, and the merchandiser reports "products are missing."
- **`lazy_load: forloop.index > 4`** — the first row is above the fold on most viewports and must load eagerly, or your LCP is a lazily-loaded image.
- **The empty state is a real design surface.** A collection can be empty because of over-filtering, because everything sold out, or because it was just created. Each deserves different copy and a different route out.
- **The grid lives in its own section with a stable `id`**, so the Section Rendering API can replace exactly that region during filtering.

### Sorting

```liquid title="snippets/collection-sort.liquid"
<select name="sort_by" form="FacetFilterForm">
  {%- for option in collection.sort_options -%}
    <option value="{{ option.value }}" {% if option.value == collection.sort_by %}selected{% endif %}>
      {{ option.name }}
    </option>
  {%- endfor -%}
</select>
```

`collection.sort_options` comes from the platform and already reflects what the merchant enabled. Hard-coding a sort list means it silently diverges from the admin. `collection.default_sort_by` is the collection's configured default, and is what you fall back to.

:::hint{type=warning}
**Sorting and filtering create URL permutations, and search engines will crawl every one of them.** A collection with six filters can generate thousands of URLs with near-identical content. Two mitigations, both cheap:

- Keep `<link rel="canonical">` pointing at the unfiltered collection URL (`{{ canonical_url }}` handles this correctly by default — do not "improve" it).
- Add `<meta name="robots" content="noindex">` on heavily filtered permutations if crawl budget becomes a real problem. Verify with your SEO stakeholder rather than deciding unilaterally; some filtered views are genuinely valuable landing pages.
:::

## Storefront filtering

Filters are configured by a merchandiser in the **Search & Discovery** app — availability, price, product options, tags, product metafields — and surfaced to Liquid as objects. Your job is presentation and state, never URL construction.

```liquid title="snippets/facets.liquid"
<form id="FacetFilterForm" class="facets">
  {%- comment -%} Preserve sort and query across filter changes {%- endcomment -%}
  {%- if collection.sort_by != blank -%}
    <input type="hidden" name="sort_by" value="{{ collection.sort_by }}">
  {%- endif -%}

  {%- for filter in collection.filters -%}
    <details class="facet" open>
      <summary>
        {{ filter.label | escape }}
        {%- if filter.active_values.size > 0 -%}
          <span class="facet__count">{{ filter.active_values.size }}</span>
        {%- endif -%}
      </summary>

      {%- case filter.type -%}
        {%- when 'boolean', 'list' -%}
          <ul class="facet__values">
            {%- for value in filter.values -%}
              <li>
                <input
                  type="checkbox"
                  id="filter-{{ filter.param_name | escape }}-{{ forloop.index }}"
                  name="{{ value.param_name }}"
                  value="{{ value.value }}"
                  {% if value.active %}checked{% endif %}
                  {% if value.count == 0 and value.active == false %}disabled{% endif %}
                >
                <label for="filter-{{ filter.param_name | escape }}-{{ forloop.index }}">
                  {{ value.label | escape }} <span class="count">({{ value.count }})</span>
                </label>
              </li>
            {%- endfor -%}
          </ul>

        {%- when 'price_range' -%}
          <price-range class="facet__price">
            <input type="number" name="{{ filter.min_value.param_name }}"
                   value="{{ filter.min_value.value | money_without_currency | replace: ',', '' }}"
                   min="0" max="{{ filter.range_max | divided_by: 100 }}">
            <input type="number" name="{{ filter.max_value.param_name }}"
                   value="{{ filter.max_value.value | money_without_currency | replace: ',', '' }}"
                   min="0" max="{{ filter.range_max | divided_by: 100 }}">
          </price-range>
      {%- endcase -%}
    </details>
  {%- endfor -%}

  <noscript><button type="submit">{{ 'products.facets.apply' | t }}</button></noscript>
</form>

{%- if collection.filters | map: 'active_values' | size > 0 -%}
  <div class="active-facets">
    {%- for filter in collection.filters -%}
      {%- for value in filter.active_values -%}
        <a class="active-facet" href="{{ value.url_to_remove }}">
          {{ filter.label }}: {{ value.label }} <span aria-hidden="true">&times;</span>
        </a>
      {%- endfor -%}
    {%- endfor -%}
    <a href="{{ collection.url }}">{{ 'products.facets.clear_all' | t }}</a>
  </div>
{%- endif -%}
```

:::hint{type=danger}
**Never construct filter URLs yourself.** `value.url_to_add`, `value.url_to_remove` and `value.param_name` are provided precisely because the encoding is non-obvious — filter params look like `filter.p.m.custom.safety_rating` and the escaping rules are easy to get subtly wrong. Hand-built URLs work for the simple cases in development and break on the metafield filter with a space in its value.
:::

The `value.count == 0` case deserves a decision, not an accident. Disabling a zero-result value prevents dead ends; hiding it entirely makes the filter list jump around as the customer selects. Disabling is usually the better call, and it is worth showing the count either way — it tells the customer what a click will get them.

### Wiring filters to the Section Rendering API

```js title="assets/facets.js"
class FacetFilters extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form')
    this.form.addEventListener('change', this.debounced(this.onChange, 300))
    window.addEventListener('popstate', this.onPopState)
  }

  onChange = async () => {
    const params = new URLSearchParams(new FormData(this.form)).toString()
    const url = `${window.location.pathname}?${params}`

    this.setLoading(true)
    this.controller?.abort()
    this.controller = new AbortController()

    try {
      const html = await fetch(`${url}&section_id=${this.dataset.sectionId}`, {
        signal: this.controller.signal
      }).then((r) => r.text())

      this.renderGrid(html)
      // Push, not replace — back should undo a filter change.
      history.pushState({ params }, '', url)
      this.announce()
    } finally {
      this.setLoading(false)
    }
  }

  onPopState = () => {
    // Re-fetch for the URL the browser navigated to.
    this.renderFromUrl(window.location.href)
  }
}
customElements.define('facet-filters', FacetFilters)
```

Three things that make this feel professional rather than merely functional:

1. **`pushState`, not `replaceState`.** A filter change is a navigation the customer expects to be able to undo. Handle `popstate` and re-render, or the back button leaves the URL and the grid disagreeing.
2. **Debounce**, especially on the price range, or you fire a request per keystroke.
3. **Announce the result count in an ARIA live region.** A screen reader user who checks "Waterproof" and hears nothing has no idea whether anything happened.

```liquid
<div role="status" aria-live="polite" class="visually-hidden">
  {{ 'products.facets.results_count' | t: count: collection.products_count }}
</div>
```

## Predictive search

```js title="assets/predictive-search.js"
const params = new URLSearchParams({
  q: query,
  'resources[type]': 'product,collection,article,query',
  'resources[limit]': 6,
  'resources[options][unavailable_products]': 'last',
  'resources[options][fields]': 'title,product_type,variants.title,vendor',
  section_id: 'predictive-search'
})

const html = await fetch(
  `${window.Shopify.routes.root}search/suggest?${params}`,
  { signal: this.controller.signal }
).then((r) => r.text())
```

Requesting `section_id` returns **rendered section HTML** rather than JSON, so your result markup — product cards, price formatting, badges — is the same Liquid used everywhere else. There is a `.json` variant if you genuinely need the data, but the section form is almost always the right choice.

Accessibility requirements for a type-ahead, which are non-negotiable and frequently missing:

- The input has `role="combobox"`, `aria-expanded`, `aria-controls` and `aria-owns`.
- Results have `role="listbox"`, each option `role="option"`.
- Arrow keys move through results, Enter selects, Escape closes and returns focus to the input.
- A live region announces the number of results.
- The whole thing works from the keyboard alone, with a visible focus indicator on each result.

:::hint{type=tip}
Debounce at 200–300ms and abort in-flight requests. Beyond politeness to the platform, an un-aborted type-ahead produces flicker as older responses land after newer ones — the same out-of-order bug as the variant switcher on Day 8, in a place customers notice more.
:::

## Pagination versus load-more versus infinite scroll

```quiz
question: A merchandising team asks for infinite scroll on collection pages. What is the strongest technical objection to raise?
options:
  - "Infinite scroll is impossible with the Section Rendering API"
  - "It makes the footer unreachable, breaks the back button unless carefully handled, and degrades crawlability — a load-more button with real pagination links underneath avoids all three"
  - "Shopify rate-limits the requests it would require"
  - "Infinite scroll always fails Core Web Vitals"
answer: 1
explanation: "Infinite scroll is buildable and can perform well, but it has three well-documented costs: an unreachable footer (which holds your navigation, support links and trust signals), broken back-button behaviour unless you manage history and scroll restoration, and reduced crawlability. A load-more button layered over genuine paginated links keeps SEO and accessibility intact while giving the same feel."
```

The pattern that satisfies everyone:

```liquid title="progressive load-more"
{%- if paginate.next -%}
  <a
    class="load-more button"
    href="{{ paginate.next.url }}"
    data-load-more
  >
    {{ 'products.facets.load_more' | t }}
  </a>
{%- endif -%}
```

Without JavaScript it is a link to page 2 — crawlable, accessible, functional. With JavaScript, a custom element intercepts the click, fetches `?page=2&section_id=…`, appends the new cards, and updates the button's `href` to page 3. The footer is always reachable, and the URL stays honest.

## Storytelling sections

The brand team will ask for "a section like this" with a Figma frame attached, roughly every sprint. There are two ways to respond, and one of them scales.

:::cards

:::card{title="One section per design"}
Fast to build, exactly matches the mock, and you now own it forever. Twelve campaigns later the theme has forty near-identical sections, and nobody can tell which are in use.
:::

:::card{title="A small set of flexible sections"}
Image-with-text, editorial banner, multi-column, rich text, media grid, testimonial row. Each with layout, alignment, colour scheme, image position and text-size options. The brand team composes rather than commissions.
:::

:::card{title="The pragmatic middle"}
Flexible sections as the default, plus a deliberately bespoke section for the two or three moments a year that genuinely justify one — the campaign hero, the annual lookbook. Bespoke sections get an expiry review.
:::

:::card{title="The tell that you chose wrong"}
Section names like `image-with-text-2`, `hero-new`, `hero-final`. When you see these in a theme, the team has been building per-design for a while and nobody has stopped to consolidate.
:::

:::

A flexible section that actually gets used has:

- **Layout options that change structure**, not just spacing — image left/right/full-bleed, text over/beside/below.
- **A colour scheme setting**, so it fits anywhere in the page flow.
- **Height and focal point control** for images, because a hero cropped through someone's face is the most common merchandising complaint there is. Shopify's image editor supports focal points and `image_url` respects them via `crop: 'center'` and related parameters — expose it rather than fighting it.
- **A block model for the content**, so one section can be a two-item or a five-item row.
- **Sensible constraints**, so no combination of settings produces something the design team would reject.

That last point is what makes the difference. A flexible section is only a win if *every* configuration of it looks intentional. Achieving that is a design collaboration, not a solo coding exercise — and pairing with the designer on the schema before you build is the highest-value hour in the sprint.

## Exercise

:::checklist{title="Day 10 checklist"}
- [ ] Collection template paginates correctly and the first row of images loads eagerly
- [ ] Sort options come from `collection.sort_options`, not a hard-coded list
- [ ] Empty state handles the over-filtered, sold-out and new-collection cases distinctly
- [ ] Filters render from `collection.filters` with counts, using only platform-provided URLs
- [ ] Filtering re-renders the grid via `section_id` with `pushState`, and the back button works
- [ ] Zero-count filter values are disabled rather than silently broken
- [ ] Result count announced in an ARIA live region
- [ ] Predictive search returns rendered section HTML, is debounced, aborts in-flight requests, and is fully keyboard-navigable
- [ ] Load-more implemented as a progressively-enhanced link to the next page
- [ ] Built one flexible storytelling section with at least three genuinely structural layout options
- [ ] Confirmed no combination of that section's settings produces a broken layout
:::

### Stretch problems

1. Add a metafield-based filter (safety rating, from Day 5) in Search & Discovery and confirm it appears in `collection.filters` with no theme change. That "no theme change" is the whole argument for metafields over tags.
2. Measure a filter interaction end to end: click to rendered grid. Then try it with the grid section deliberately made heavy (add a nested variants loop) and measure again. You now know what server-side render cost feels like to a customer.
3. Build the load-more so that scroll position and appended results survive a back-navigation. This is harder than it looks and is the real reason infinite scroll gets a bad reputation.
4. Take a campaign design from any brand you like and decide whether it should be a new section or a configuration of an existing one. Write the two-sentence justification you would give a product manager.

## Where this is going

That completes Chapter 2 — you can now build the storefront. Chapter 3 makes it fast, connects it to Shopify's APIs, and puts it inside a release process: Core Web Vitals, third-party script governance, Admin and Storefront GraphQL, Git-based theme deployment, and the sprint mechanics of working with designers, product managers and QA.

Sit the Chapter 2 test first. It assumes you built the cart and PDP rather than reading about them.
