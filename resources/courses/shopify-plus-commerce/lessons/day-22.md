---
title: B2B Theme Development
summary: Making one theme serve both a consumer and a trade buyer — detecting company context in Liquid, a location switcher, catalog-aware pricing, B2B-only navigation and templates, and the customer account surfaces wholesale buyers actually use.
minutes: 120
objectives:
  - Detect B2B context in Liquid and branch behaviour safely
  - Build a company location switcher that updates prices, availability and addresses
  - Display catalog pricing, quantity breaks and rules correctly on product and collection pages
  - Serve B2B-specific navigation, templates and content without forking the theme
  - Handle the account surfaces that matter to a wholesale buyer
keyTerms:
  - term: customer.b2b?
    definition: The Liquid boolean indicating the logged-in customer is a company contact, and therefore shopping in a B2B context.
  - term: company_location
    definition: The Liquid object for the buying location currently selected — its name, addresses, tax settings and metafields. Determines pricing and availability.
  - term: current_location
    definition: "`customer.current_location` — the company location the buyer is currently ordering for, out of those available to them."
  - term: quantity_price_break
    definition: A volume pricing tier available in Liquid on the variant, giving the minimum quantity and the price at that tier so the PDP can display the whole ladder.
  - term: Alternate template
    definition: "A template variant such as `templates/collection.wholesale.json`, assignable per resource — the mechanism for a distinct B2B page layout without a second theme."
  - term: New customer accounts
    definition: Shopify's current account system, required for B2B. Login is code-based, and account pages are extensible rather than fully theme-templated.
resources:
  - label: B2B Liquid objects — company
    url: https://shopify.dev/docs/api/liquid/objects/company
  - label: company_location object
    url: https://shopify.dev/docs/api/liquid/objects/company_location
  - label: Building B2B themes
    url: https://shopify.dev/docs/storefronts/themes/markets/b2b
  - label: quantity_price_break object
    url: https://shopify.dev/docs/api/liquid/objects/quantity_price_break
  - label: Customer accounts
    url: https://shopify.dev/docs/api/customer-account
---

Yesterday you configured the data. Today the storefront has to reflect it, and the design question underneath is worth settling before you write any Liquid: **one theme or two?**

Two themes — a DTC theme and a wholesale theme on a separate store — is how this was done before native B2B, and it doubles everything: two deployments, two sets of sections, two places to fix a bug, two catalogues to keep in step.

One theme that adapts is better, and it is what the platform is designed for. The cost is discipline: B2B branches must be deliberate and enumerable, not sprinkled through the codebase.

## Detecting context

```liquid title="the context check"
{%- liquid
  assign is_b2b = false
  if customer and customer.b2b?
    assign is_b2b = true
  endif

  assign location = customer.current_location
  assign company  = customer.current_company
-%}

{%- if is_b2b -%}
  <div class="b2b-bar">
    {{ 'customer.b2b.ordering_for' | t }}
    <strong>{{ company.name }}</strong> — {{ location.name }}
    {%- if customer.company_available_locations.size > 1 -%}
      {% render 'location-switcher' %}
    {%- endif -%}
  </div>
{%- endif -%}
```

:::hint{type=warning}
`customer.b2b?` is only meaningful when a customer is logged in. A guest browsing the storefront is not B2B, sees DTC prices, and that is correct — trade pricing must never be visible to an anonymous visitor.

That has a consequence people miss: **a trade buyer who is not logged in sees consumer prices**, which is confusing and sometimes commercially embarrassing. Two mitigations, both cheap:

1. Make the login prompt for trade accounts prominent and specific ("Trade customer? Sign in to see your pricing"), not a generic account link.
2. Consider a `templates/*.wholesale.json` route or a dedicated trade landing page that explains the programme to logged-out visitors.
:::

The available objects, in practice:

| Object | Gives you |
|---|---|
| `customer.b2b?` | Boolean — is this a company contact |
| `customer.current_company` | The company: name, external ID, metafields |
| `customer.current_location` | The active buying location |
| `customer.company_available_locations` | Every location this contact can order for |
| `company_location.current_location.shipping_address` | Address used for tax and shipping |
| `variant.quantity_rule` | min, max, increment for the current catalog |
| `variant.quantity_price_breaks` | The volume ladder for the current catalog |

Verify exact property names against the current Liquid reference before building — the B2B object surface has been extended repeatedly since launch.

## The location switcher

A buyer ordering for three branches must be able to switch, and switching must change prices, availability, tax and the shipping address.

```liquid title="snippets/location-switcher.liquid"
{%- form 'company_location', class: 'location-switcher' -%}
  <label for="company-location">{{ 'customer.b2b.ordering_for' | t }}</label>
  <select id="company-location" name="company_location_id" onchange="this.form.submit()">
    {%- for loc in customer.company_available_locations -%}
      <option value="{{ loc.id }}" {% if loc.id == customer.current_location.id %}selected{% endif %}>
        {{ loc.name }} — {{ loc.shipping_address.city }}
      </option>
    {%- endfor -%}
  </select>
  <noscript><button type="submit">{{ 'customer.b2b.switch' | t }}</button></noscript>
{%- endform -%}
```

:::hint{type=danger}
**Switching location can invalidate the cart.** Different locations may have different catalogs, so a product in the cart may not exist in the new location's catalog, or its price and quantity rules may differ.

Warn before switching when the cart is not empty, and check the cart after the switch. Silently changing prices under a buyer who has already built a 40-line order is how you lose a wholesale account's trust — and rebuilding a 40-line order is not a small ask.

Handling this well is one of those details that separates a wholesale storefront buyers actually use from one they email their orders around instead.
:::

## Pricing display

The correct catalog price arrives automatically in `product.price`, `variant.price` and the rest. You do not compute anything — that is the whole point of catalogs. What you do have to handle is **presentation**.

```liquid title="snippets/price-b2b.liquid"
{%- liquid
  assign variant = variant | default: product.selected_or_first_available_variant
  assign breaks  = variant.quantity_price_breaks
-%}

<div class="price price--b2b">
  <span class="price__current">{{ variant.price | money }}</span>

  {%- if customer.b2b? -%}
    <span class="price__unit">{{ 'products.b2b.per_unit' | t }}</span>
  {%- endif -%}
</div>

{%- if breaks.size > 0 -%}
  <table class="volume-pricing">
    <caption>{{ 'products.b2b.volume_pricing' | t }}</caption>
    <thead>
      <tr>
        <th scope="col">{{ 'products.b2b.quantity' | t }}</th>
        <th scope="col">{{ 'products.b2b.price_each' | t }}</th>
        <th scope="col">{{ 'products.b2b.you_save' | t }}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{ variant.quantity_rule.min | default: 1 }}+</td>
        <td>{{ variant.price | money }}</td>
        <td>—</td>
      </tr>
      {%- for brk in breaks -%}
        {%- assign saving = variant.price | minus: brk.price | times: 100 | divided_by: variant.price -%}
        <tr>
          <td>{{ brk.minimum_quantity }}+</td>
          <td>{{ brk.price | money }}</td>
          <td>{{ saving }}%</td>
        </tr>
      {%- endfor -%}
    </tbody>
  </table>
{%- endif -%}
```

Two decisions in there worth making deliberately:

1. **Show the whole ladder, always.** A trade buyer deciding between 18 and 24 units needs to see that 24 crosses a break. Hiding it until they get there costs you order value — this table is one of the highest-return things you can build on a wholesale PDP.
2. **Never show a struck-through DTC price to a trade buyer.** Their price is their price. A compare-at price implies a sale that will end, which is the wrong frame for a contract relationship — and it also exposes your consumer margin to a buyer who will remember it.

:::hint{type=tip}
When quantity price breaks are in play, the **cart line price changes with quantity**. If your cart uses the Section Rendering API (Day 9), this works correctly with no extra effort, because the server computes it.

If you took the client-side shortcut, this is where it breaks — visibly, on your highest-value orders. Consider this the receipt for the argument on Day 9.
:::

## B2B-only navigation and content

```liquid title="context-aware menu"
{%- liquid
  assign menu_handle = 'main-menu'
  if customer.b2b?
    assign menu_handle = 'trade-menu'
  endif
  assign menu = linklists[menu_handle]
-%}
```

One line of branching, and the merchandising team maintains a separate trade navigation in the admin with no further code. That is the pattern to reach for: **branch on context, then let configuration do the rest.**

For content, three levels:

:::cards

:::card{title="Section-level visibility"}
Add a `visible_to` select setting — Everyone / DTC only / B2B only — to your flexible sections. Merchandisers then control audience per section instance, with no code for each case.
:::

:::card{title="Alternate templates"}
`templates/collection.wholesale.json`, `templates/page.trade-programme.json`. A distinct layout for trade collections — denser, list-based, quick-order oriented — without forking the theme.
:::

:::card{title="Metaobject-driven content"}
Trade terms, delivery lead times, certification documents modelled as metaobjects and rendered where relevant. Sales ops maintains them; you never touch it again.
:::

:::card{title="Company metafields"}
Account-specific content — an assigned rep's name and photo, a negotiated lead time, a credit limit. Read from `customer.current_company.metafields` and rendered in the account area.
:::

:::

```liquid title="a section with audience visibility"
{%- liquid
  assign audience = section.settings.visible_to
  assign show = true
  if audience == 'b2b' and customer.b2b? != true
    assign show = false
  endif
  if audience == 'dtc' and customer.b2b?
    assign show = false
  endif
  if request.design_mode
    assign show = true
  endif
-%}

{%- if show -%}
  …
{%- endif -%}
```

The `request.design_mode` override matters: without it, a merchandiser editing the theme cannot see or configure their own B2B-only sections. Add a visible indicator in the editor so they know why it is showing.

```quiz
question: A wholesale buyer with three company locations adds 40 line items to their cart, then switches location to order for a different branch. What must the theme do?
options:
  - "Nothing — Shopify migrates the cart automatically with correct prices"
  - "Warn before switching, then verify the cart afterwards, because catalogs, prices and quantity rules can differ per location"
  - "Clear the cart silently to avoid pricing errors"
  - "Block location switching whenever the cart is not empty"
answer: 1
explanation: "Prices, product availability and quantity rules are resolved per company location. Switching can change or invalidate cart lines. Silently changing a 40-line order's pricing destroys trust; clearing it destroys twenty minutes of the buyer's work. Warn, switch, verify, and report clearly what changed."
```

## Customer accounts

B2B requires the newer customer accounts, which changes theme work more than people expect. Login is code-based rather than password-based, and account pages are extensible through customer account UI extensions rather than being fully theme-templated.

What a wholesale buyer needs from their account area, roughly in priority order:

1. **Order history for their location** — including colleagues' orders where their role allows, because "did Dave already order the gloves?" is the most common question in a trade account.
2. **Payment status and due dates**, prominently. An overdue invoice is the most important thing on that page.
3. **Reorder** — one click to rebuild a previous order into the cart. This is the single most-used feature in wholesale, by a wide margin.
4. **Saved lists** — a standing order, a site kit, a seasonal list. Day 23 builds this.
5. **Company details** — locations, terms, assigned rep.
6. **Invoices and documents**, if the business issues them.

:::hint{type=warning}
Do not assume the classic `templates/customers/*.liquid` pages are what your buyers see. Establish which account system the store uses **before** estimating any account work — the answer changes the implementation entirely, and getting it wrong invalidates the estimate rather than adjusting it.
:::

## Keeping the branches enumerable

The discipline that makes one theme viable: **every B2B branch is registered.**

```markdown title="docs/b2b-theme.md"
| Location | Branch | Behaviour |
|---|---|---|
| `snippets/header.liquid` | `customer.b2b?` | Trade menu instead of main menu; company bar shown |
| `snippets/price.liquid` | `variant.quantity_price_breaks.size > 0` | Volume ladder table rendered |
| `snippets/price.liquid` | `customer.b2b?` | Compare-at price suppressed |
| `sections/main-product.liquid` | `customer.b2b?` | Quick-order block replaces cross-sell |
| `sections/main-cart.liquid` | `customer.b2b?` | PO number field shown |
| Flexible sections | `section.settings.visible_to` | Audience visibility |
| `layout/theme.liquid` | `customer.b2b?` | Body class `is-b2b` for CSS hooks |
```

Two things this table gives you. First, a QA engineer can construct a complete test matrix from it. Second, when someone asks "does this change affect wholesale?", the answer takes thirty seconds rather than a codebase search.

Keep it current in the same pull request as the change, and make it a line in the PR template.

## Exercise

:::checklist{title="Day 22 checklist"}
- [ ] Company context bar renders for B2B customers and not for DTC or guests
- [ ] Location switcher works, including with JavaScript disabled
- [ ] Switching location with a populated cart warns first and reports what changed afterwards
- [ ] PDP shows the volume pricing ladder when quantity price breaks exist
- [ ] Compare-at price suppressed for B2B customers
- [ ] Quantity input honours min, max and increment from `variant.quantity_rule`
- [ ] Cart line prices update correctly when a quantity crosses a break — verified with a real cart
- [ ] Separate trade navigation driven by a menu handle, maintained in the admin
- [ ] Flexible sections have a `visible_to` setting, with a design-mode override
- [ ] Alternate `templates/collection.wholesale.json` created and assigned
- [ ] Confirmed which customer account system the store uses and documented the implications
- [ ] Wrote `docs/b2b-theme.md` enumerating every B2B branch
- [ ] B2B paths added to the regression suite and run once end to end
:::

### Stretch problems

1. Build the "ordering for" bar so it is sticky on mobile and shows the location's payment terms and delivery lead time from a company location metafield. Ask a non-developer whether it is clear.
2. Implement the cart-validity check on location switch properly: compare each line against the new catalog, report added, removed and repriced lines, and offer to keep or discard. This is a genuinely hard piece of UX and a strong portfolio item.
3. Build a logged-out trade landing page that explains the programme and drives account applications, with a form that creates a draft company record via Flow or an API endpoint.
4. Take your DTC PDP and your B2B PDP side by side and list every difference. Then decide, for each, whether it should be a branch, a setting, or an alternate template. There is no single right answer — the exercise is making each choice deliberately.

## Where this is going

Tomorrow: the ordering experience itself. Quick order forms, bulk entry by SKU, saved lists, reordering, and the CSV upload that wholesale buyers ask for on day one — the features that decide whether buyers use your storefront or keep emailing spreadsheets.
