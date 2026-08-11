---
title: "Custom Data: Metafields & Metaobjects"
summary: Shopify's schema extension system — adding structured, validated, queryable data to products, variants, customers, companies and locations, and modelling whole entities with metaobjects instead of hard-coding them.
minutes: 110
objectives:
  - Create metafield definitions with the right type and validation, and access them in Liquid
  - Distinguish metafields, metaobjects and tags, and choose correctly between them
  - Model a repeating content entity (a fit guide, a store locator, a size chart) as a metaobject
  - Expose custom data to the theme editor via dynamic sources and metaobject settings
  - Explain the storefront visibility flag and why an "empty" metafield is usually a permissions problem
keyTerms:
  - term: Metafield
    definition: A typed custom field attached to a Shopify resource — product, variant, collection, customer, order, company, location, shop and more. Namespaced, e.g. `custom.safety_rating`.
  - term: Metafield definition
    definition: The schema for a metafield — its namespace, key, type, validation rules and whether it is exposed to the storefront. Defined once in the admin or via the Admin API; applies to every resource of that type.
  - term: Metaobject
    definition: A custom object type you define yourself, with its own fields and its own entries. Use it when the thing you are modelling is an entity in its own right rather than a property of an existing one.
  - term: Storefront visibility
    definition: A per-definition flag controlling whether a metafield is readable from the storefront (Liquid and the Storefront API). Off by default for API-created definitions, which is why a correct-looking metafield renders blank.
  - term: Reference type
    definition: A metafield type that points at another resource — `product_reference`, `file_reference`, `metaobject_reference`, and their `list.*` variants. Liquid resolves them into real objects via `.value`.
  - term: Standard metafield
    definition: A Shopify-defined definition with a fixed namespace (often `shopify.` or a standard `custom` shape) that apps and channels understand — care instructions, product certifications, colour pattern, and so on.
resources:
  - label: Metafields overview
    url: https://shopify.dev/docs/apps/build/custom-data/metafields
  - label: Metafield types
    url: https://shopify.dev/docs/apps/build/custom-data/metafields/list-of-data-types
  - label: Metaobjects
    url: https://shopify.dev/docs/apps/build/custom-data/metaobjects
  - label: Accessing metafields in Liquid
    url: https://shopify.dev/docs/api/liquid/objects/metafield
  - label: Custom data in the theme editor
    url: https://shopify.dev/docs/storefronts/themes/architecture/settings#dynamic-sources
---

Every store outgrows Shopify's built-in product fields within a month. A workwear brand needs a safety rating, a toe type, a waterproof rating, a fit guide, an ASTM certification list and a break-in period. Shopify's product object has `title`, `vendor`, `type`, `tags` and a description.

The bad answer is to encode all of it into tags (`toe:steel`, `astm:F2413`) and parse strings in Liquid. You saw that pattern yesterday and it works — for about a year, until a merchandiser types `Toe: Steel` with a capital and a space, the filter silently stops matching, and nobody notices for six weeks.

The good answer is **custom data**: metafields for properties, metaobjects for entities. Typed, validated, queryable, and editable in a proper admin form.

## Metafields

A metafield is a typed value attached to a resource, addressed as `namespace.key`.

```liquid title="reading-metafields.liquid"
{{ product.metafields.custom.safety_rating }}
{{ product.metafields.custom.safety_rating.value }}
{{ product.metafields.custom.safety_rating.type }}
```

The distinction between the object and `.value` matters:

- `{{ metafield }}` — outputs a **formatted** representation. For `rich_text_field` it renders HTML; for `list.*` it renders something unhelpful.
- `{{ metafield.value }}` — the **raw typed value**. Use this for anything you need to loop over, compare or pass to a filter.

The safe habit: use `.value` for logic, and the bare object only for `rich_text_field` and `multi_line_text_field` where the formatted output is what you want.

### Creating a definition

Admin → **Settings → Custom data → Products → Add definition**.

| Field | Value | Why |
|---|---|---|
| Name | Safety rating | Shown to whoever fills it in |
| Namespace and key | `custom.safety_rating` | `custom` is the conventional namespace for merchant-defined fields |
| Type | Single line text, list of values | Constrained input |
| Validation | Preset list: `EH`, `ST`, `SD`, `PR` | The type system you did not have with tags |
| Storefront access | **Enabled** | Off means Liquid renders nothing |

:::hint{type=danger}
**Storefront visibility is the single most common metafield bug.** A definition created through the admin UI is usually storefront-visible by default; one created via the Admin API is **not** unless you explicitly set access. The symptom is identical either way: the value is clearly present in the admin, and `{{ product.metafields.custom.x }}` renders nothing.

Check the definition before you debug your Liquid. It will save you an hour, twice.
:::

### The types that matter

```liquid title="metafield-types.liquid"
{%- comment -%} Scalars {%- endcomment -%}
{{ product.metafields.custom.break_in_days.value }}          {# number_integer #}
{{ product.metafields.custom.waterproof.value }}             {# boolean #}
{{ product.metafields.custom.care.value }}                   {# multi_line_text_field #}
{{ product.metafields.custom.story }}                        {# rich_text_field → renders HTML #}

{%- comment -%} Lists {%- endcomment -%}
{%- for rating in product.metafields.custom.safety_ratings.value -%}
  <span class="chip">{{ rating }}</span>
{%- endfor -%}

{%- comment -%} Measurements and money come back as objects {%- endcomment -%}
{{ product.metafields.custom.weight.value.value }}{{ product.metafields.custom.weight.value.unit }}

{%- comment -%} File reference — resolves to a file object {%- endcomment -%}
{%- assign chart = product.metafields.custom.size_chart.value -%}
{%- if chart != blank -%}
  {{ chart | image_url: width: 1200 | image_tag: alt: 'Size chart', loading: 'lazy' }}
{%- endif -%}

{%- comment -%} Product reference list — real product objects {%- endcomment -%}
{%- for item in product.metafields.custom.wears_well_with.value -%}
  {% render 'card-product', product: item %}
{%- endfor -%}
```

:::hint{type=warning}
`rich_text_field` returns a **structured JSON document**, not an HTML string. Outputting the metafield object directly renders it as HTML correctly; reaching for `.value` gives you the raw JSON tree, which is occasionally what you want (to render your own markup) and usually not what you meant. This asymmetry catches everyone once.
:::

### Where metafields can live

Products, variants, collections, customers, orders, draft orders, pages, blogs, articles, shop, locations, markets, **companies** and **company locations** (Chapter 5 depends on those two heavily), and more.

That breadth is the point. When Chapter 5 needs a wholesale account's assigned sales rep, or Chapter 6 needs a retail location's opening hours for a POS extension, the answer is a metafield on `company` or `location` — not a hard-coded map in a Liquid snippet.

## Metaobjects

A metafield describes a property of something that already exists. A **metaobject** is something that exists on its own.

The test: *does this thing have its own fields, get reused across multiple products, and get maintained independently?* If yes, it is a metaobject.

Good metaobject candidates for our workwear store:

- **Fit guide** — name, body copy, diagram image, list of measurement rows. One guide is shared by thirty boots.
- **Retail location** — address, hours, phone, manager, photo, features. Referenced by the store locator, POS receipts and local-inventory messaging.
- **Certification** — code, full name, description, badge image. Shared across the catalogue.
- **Testimonial** — quote, name, trade, photo. Reused across landing pages.

### Defining one

Admin → **Settings → Custom data → Metaobjects → Add definition**.

```text title="metaobject: fit_guide"
Type:        fit_guide
Fields:
  title            single_line_text_field   (required)
  intro            rich_text_field
  diagram          file_reference           (image only)
  measurement_rows list.single_line_text_field
  applies_to       list.product_reference
Options:
  ☑ Storefront access
  ☑ Web page (gives each entry a /pages/… style URL and an SEO record)
```

Then create entries — "Boot fit guide", "Outerwear fit guide" — and reference them from products with a `metaobject_reference` metafield.

### Rendering a metaobject

```liquid title="snippets/fit-guide.liquid"
{%- comment -%}
  Renders a fit guide.
  Accepts: guide (metaobject) — required.
{%- endcomment -%}

{%- if guide != blank -%}
  <section class="fit-guide" aria-labelledby="fit-guide-heading">
    <h2 id="fit-guide-heading">{{ guide.title }}</h2>

    {{ guide.intro }}

    {%- if guide.diagram != blank -%}
      {{ guide.diagram.value
         | image_url: width: 900
         | image_tag: loading: 'lazy', sizes: '(min-width: 750px) 50vw, 100vw', alt: guide.title }}
    {%- endif -%}

    {%- if guide.measurement_rows.value.size > 0 -%}
      <ul class="fit-guide__rows">
        {%- for row in guide.measurement_rows.value -%}
          <li>{{ row }}</li>
        {%- endfor -%}
      </ul>
    {%- endif -%}
  </section>
{%- endif -%}
```

Called from a product section:

```liquid
{%- assign guide = product.metafields.custom.fit_guide.value -%}
{% render 'fit-guide', guide: guide %}
```

You can also iterate every entry of a type, which is what a store locator or a certification index needs:

```liquid title="all-entries.liquid"
{%- for location in shop.metaobjects.retail_location.values -%}
  <article class="store-card">
    <h3>{{ location.name }}</h3>
    <address>{{ location.address }}</address>
    <p>{{ location.hours }}</p>
  </article>
{%- endfor -%}
```

:::hint{type=tip}
Metaobject definitions can be given a **web page** capability, which gives each entry its own URL and SEO metadata, rendered by `templates/metaobject.<type>.json`. That turns a metaobject type into a whole content section of the site — a certifications library, a trade-programme directory — without a single new page in the admin. It is one of the highest-leverage features on the platform and one of the least used.
:::

## Metafields versus metaobjects versus tags

```quiz
question: A brand needs each product to display which of eight safety certifications it holds, and each certification needs a badge image and an explanatory paragraph shown identically wherever it appears. What is the right model?
options:
  - "A tag per certification, parsed in Liquid"
  - "A list.single_line_text_field metafield on the product, with a Liquid case statement mapping codes to badges"
  - "A `certification` metaobject with badge and description fields, referenced from products by a list.metaobject_reference metafield"
  - "A separate collection per certification"
answer: 2
explanation: "The certification has its own fields (badge, description) and is shared across products, so it is an entity — a metaobject. The product's relationship to it is a reference list. Tags carry no structure; a Liquid case statement duplicates the badge/description data in code where merchandisers cannot maintain it."
```

| | Tags | Metafields | Metaobjects |
|---|---|---|---|
| Structure | None — strings | Typed, validated | Typed fields, own entries |
| Reusable content body | No | Only via reference | **Yes** |
| Storefront filtering | **Yes**, natively | Yes, if the definition is filterable | Via reference on a filterable field |
| Merchandiser UX | Free text, drifts | Proper form with validation | Proper form, editable once and reflected everywhere |
| Good for | Loose grouping, filters, automation triggers | Properties of a resource | Entities with their own content |

Tags are not obsolete — they remain the fastest path to storefront filtering and Flow automation triggers (Day 19). But "tag as a data model" is a legacy pattern you should be actively migrating away from, and being able to explain that trade clearly is a senior signal.

## Exposing custom data to merchandisers

Three routes, and you should know all three because they suit different people:

:::cards

:::card{title="Dynamic sources"}
The merchandiser binds a section setting to a metafield in the theme editor. Best when the *placement* is theirs to decide. Requires the setting type to support dynamic sources.
:::

:::card{title="Metaobject settings"}
`{ "type": "metaobject", "id": "guide" }` in a schema gives a picker for entries of one type. Best when the section is *about* that entity — a fit guide section, a location section.
:::

:::card{title="Direct Liquid access"}
`{{ product.metafields.custom.x }}` hard-wired into a section. Fastest to build, zero merchandiser control. Correct when the field is genuinely structural — a safety rating always renders in the same place on every product page.
:::

:::card{title="Admin only"}
Some metafields exist purely to drive Flow automations, POS behaviour or an integration, and never render. Do not expose those to the theme editor at all; document them instead.
:::

:::

## Governance, before you have 200 of them

Metafields sprawl. Two years in, an untended store has `custom.material`, `custom.material_v2`, `my_fields.material` and `app_reviews.material_note`, three of which are empty and one of which drives the PDP.

Establish this now, in a `docs/custom-data.md` in your theme repository:

```markdown title="docs/custom-data.md"
## Product metafields

| Key | Type | Storefront | Owner | Used by | Notes |
|---|---|---|---|---|---|
| custom.safety_ratings | list.single_line_text | ✅ | Merch | PDP spec table, collection filters | Validated preset list |
| custom.fit_guide | metaobject_reference (fit_guide) | ✅ | Merch | PDP fit guide section | Falls back to category default |
| custom.break_in_days | number_integer | ✅ | Merch | PDP callout | Blank = not shown |
| ops.warehouse_zone | single_line_text | ❌ | Ops | 3PL export, Flow | Never render |
```

Rules worth adopting:

1. **Namespace by owner, not by feature.** `custom.*` for merchandising, `ops.*` for operations, `<app>.*` reserved for apps. You can then answer "can I delete this?" without archaeology.
2. **Never delete a definition without checking Liquid, Flow, Functions and any integration.** Deleting a definition deletes every value. There is no undo.
3. **A definition with no owner in the table gets an owner or gets removed** at the next audit.

:::hint{type=warning}
Definitions can be created and managed through the **Admin GraphQL API** (`metafieldDefinitionCreate`, `metaobjectDefinitionCreate`). That is how you keep custom data in sync between a development store and production without recreating twenty definitions by hand in a form — and it is the closest thing Shopify offers to a schema migration. Day 13 builds this; note the idea now.
:::

## Exercise

Model the workwear catalogue properly. This is not a throwaway exercise — Chapters 2, 5 and 6 all build on the data you create today.

:::checklist{title="Day 5 checklist"}
- [ ] Created product metafield definitions: `custom.safety_ratings` (validated list), `custom.break_in_days` (integer), `custom.waterproof` (boolean), `custom.size_chart` (file reference)
- [ ] Confirmed storefront access is enabled on each, and proved it by rendering one
- [ ] Created a `fit_guide` metaobject definition with at least four fields, including a file reference and a list
- [ ] Created two fit guide entries and referenced them from products with a `metaobject_reference` metafield
- [ ] Built `snippets/fit-guide.liquid` with a documented contract and full blank-guarding
- [ ] Created a `retail_location` metaobject with address, hours and features — Chapter 6 uses this
- [ ] Rendered all `retail_location` entries via `shop.metaobjects.retail_location.values`
- [ ] Enabled the web page capability on one metaobject type and viewed an entry's own URL
- [ ] Bound one section setting to a metafield via a dynamic source, with no code change
- [ ] Written `docs/custom-data.md` covering every definition you created, with owners
:::

### Stretch problems

1. Take the tag-based pattern (`toe:steel`) and write the migration plan: what the new definition is, how existing values get moved, what Liquid changes, what breaks in the interim, and how you would verify it. You do not have to run it — the plan is the exercise.
2. Model a `certification` metaobject and reference it from products with a list. Then render a certifications index page from the metaobject's web page capability. Compare the effort against building the same thing as pages plus a naming convention.
3. A metafield on `variant` versus on `product`: pick a field where the choice is genuinely ambiguous (say, `custom.break_in_days`) and write the argument both ways. Note which one makes the PDP JavaScript on Day 8 harder.
4. Find a metafield definition in your store you did not create. Work out what put it there and whether anything reads it.

## Where this is going

Chapter 1 gave you the platform's architecture. Chapter 2 turns it into a storefront: responsive CSS without a framework, framework-free JavaScript that survives the theme editor, the product page, the cart and the Section Rendering API, and the merchandising surfaces — collections, search, filtering and the sections that carry brand story.

Before that, sit the chapter test. It covers Liquid semantics, theme architecture, schema design and custom data, and it assumes you actually built the sections rather than reading about them.
