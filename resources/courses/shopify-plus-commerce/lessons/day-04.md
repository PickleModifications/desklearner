---
title: Section Schema & the Theme Editor Contract
summary: Every setting type, dynamic sources, colour schemes, presets and the design judgement behind them — how to build sections a merchandiser can configure without producing a page that looks broken.
minutes: 100
objectives:
  - Use every practical setting type, and choose the right one for a given requirement
  - Expose settings as dynamic sources so merchants can bind them to metafields
  - Design defaults and presets so a freshly-added section looks correct with no configuration
  - Constrain settings deliberately with limits, ranges and selects rather than free text
  - Debug the theme editor when a section fails to appear, fails to update, or breaks on save
keyTerms:
  - term: Schema
    definition: The JSON block at the bottom of a section or block file that declares its name, settings, blocks, presets and behaviour. It is the contract between your code and the theme editor.
  - term: Dynamic source
    definition: A theme editor feature letting a merchant bind a setting to live store data — a metafield or a standard object property — instead of typing a static value. Enabled per setting type.
  - term: Preset
    definition: The default configuration used when a merchant adds the section from the "Add section" menu. A section with no presets cannot be added manually.
  - term: Color scheme
    definition: A theme-wide named palette defined in `settings_schema.json`. Sections expose a `color_scheme` setting rather than individual colour pickers, so the store stays coherent.
  - term: settings_data.json
    definition: The generated file holding the merchant's chosen values for theme settings. Pushing a stale copy over a live store wipes their configuration.
  - term: Design mode
    definition: The theme editor context. `request.design_mode` is true there, and sections re-render individually rather than reloading the page.
resources:
  - label: Input settings reference
    url: https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings
  - label: Section schema reference
    url: https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema
  - label: Dynamic sources
    url: https://shopify.dev/docs/storefronts/themes/architecture/settings#dynamic-sources
  - label: Theme settings (settings_schema.json)
    url: https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json
---

The schema is the smallest file in a section and the one that determines whether the section is used or quietly abandoned. A merchandising team does not read your Liquid. They read forty labels in a sidebar and decide whether this thing is worth the effort.

There is a version of this job where you take a Figma file, hard-code it, and ship. It works once. Then the campaign changes, and it is your ticket, and it is your ticket every time after that. Schema design is how you stop being the bottleneck.

## The setting types

There are more than you will remember, so here they are grouped by what they are actually for.

### Text and content

```json title="text settings"
[
  { "type": "text",      "id": "heading",  "label": "Heading", "default": "Built for the trades" },
  { "type": "textarea",  "id": "subtext",  "label": "Sub-heading" },
  { "type": "richtext",  "id": "body",     "label": "Body", "default": "<p>Description</p>" },
  { "type": "inline_richtext", "id": "title", "label": "Title" },
  { "type": "html",      "id": "embed",    "label": "Custom HTML" },
  { "type": "liquid",    "id": "custom",   "label": "Custom Liquid" }
]
```

- `richtext` returns wrapped HTML (`<p>`, `<strong>`, `<em>`, `<a>`, lists). Its default **must** be valid HTML or the section will not save.
- `inline_richtext` allows formatting without block-level wrapping — the right choice inside a heading, where a `<p>` would break your typography.
- `html` and `liquid` are escape hatches. They are also how a well-designed theme accumulates unreviewed code that nobody can find. Expose them sparingly and never as the *default* answer to "can we add something custom here".

### Selection and constraint

```json title="constrained settings"
[
  {
    "type": "select", "id": "layout", "label": "Layout", "default": "grid",
    "options": [
      { "value": "grid",     "label": "Grid" },
      { "value": "carousel", "label": "Carousel" },
      { "value": "stacked",  "label": "Stacked" }
    ]
  },
  {
    "type": "radio", "id": "alignment", "label": "Text alignment", "default": "left",
    "options": [
      { "value": "left", "label": "Left" },
      { "value": "center", "label": "Centre" }
    ]
  },
  { "type": "checkbox", "id": "show_vendor", "label": "Show vendor", "default": false },
  { "type": "range", "id": "columns", "label": "Columns", "min": 2, "max": 5, "step": 1, "default": 4 },
  { "type": "number", "id": "products_to_show", "label": "Products to show", "default": 8 }
]
```

:::hint{type=tip}
**Prefer `range` over `number`, and `select` over `text`, every time you can.** A `number` field accepts `-4` and `99999`. A `range` cannot produce a value your CSS does not handle. This is not paternalism — it is the same instinct that makes you type a function's arguments. Every unconstrained setting is a support ticket with a delay fuse.
:::

### Resource pickers

```json title="resource settings"
[
  { "type": "image_picker",      "id": "image",      "label": "Image" },
  { "type": "video",             "id": "video",      "label": "Video" },
  { "type": "video_url",         "id": "external",   "label": "Video URL", "accept": ["youtube", "vimeo"] },
  { "type": "product",           "id": "featured",   "label": "Featured product" },
  { "type": "product_list",      "id": "products",   "label": "Products", "limit": 8 },
  { "type": "collection",        "id": "collection", "label": "Collection" },
  { "type": "collection_list",   "id": "collections","label": "Collections", "limit": 5 },
  { "type": "blog",              "id": "blog",       "label": "Blog" },
  { "type": "page",              "id": "page",       "label": "Page" },
  { "type": "link_list",         "id": "menu",       "label": "Menu", "default": "main-menu" },
  { "type": "url",               "id": "link",       "label": "Link" },
  { "type": "metaobject",        "id": "fit_guide",  "label": "Fit guide" },
  { "type": "metaobject_list",   "id": "guides",     "label": "Fit guides", "limit": 4 }
]
```

These return real objects, not IDs. `section.settings.featured` **is** a product object with `.title`, `.price` and everything else. That is why a `product` setting is enormously more useful than a text field holding a handle.

:::hint{type=warning}
A resource setting can be **empty**, and can point at a resource that was later deleted or unpublished. `{{ section.settings.featured.title }}` on a deleted product renders nothing — silently, as usual. Guard every resource setting:

```liquid
{%- if section.settings.featured != blank and section.settings.featured.available -%}
```
:::

### Style and layout

```json title="style settings"
[
  { "type": "color",         "id": "accent",       "label": "Accent colour" },
  { "type": "color_scheme",  "id": "color_scheme", "label": "Colour scheme", "default": "scheme-1" },
  { "type": "color_background", "id": "gradient",  "label": "Background gradient" },
  { "type": "font_picker",   "id": "heading_font", "label": "Heading font", "default": "assistant_n4" },
  { "type": "text_alignment","id": "align",        "label": "Alignment", "default": "left" },
  { "type": "style.layout_panel", "id": "layout",  "label": "Layout" }
]
```

**Use `color_scheme`, not `color`.** Colour schemes are defined once in `settings_schema.json` and applied everywhere. Individual colour pickers on every section is how a store ends up with eleven slightly different greens and a rebrand that takes three weeks instead of an afternoon.

```json title="config/settings_schema.json — colour schemes"
{
  "name": "Colours",
  "settings": [
    {
      "type": "color_scheme_group",
      "id": "color_schemes",
      "definition": [
        { "type": "color", "id": "background", "label": "Background", "default": "#FFFFFF" },
        { "type": "color", "id": "text",       "label": "Text",       "default": "#141414" },
        { "type": "color", "id": "button",     "label": "Solid button background", "default": "#F26522" },
        { "type": "color", "id": "button_label","label": "Solid button label",     "default": "#FFFFFF" }
      ],
      "role": {
        "background": { "solid": "background" },
        "text": "text",
        "primary_button": "button",
        "on_primary_button": "button_label"
      }
    }
  ]
}
```

The `role` mapping is what lets Shopify emit CSS custom properties automatically. In your section you then only need:

```liquid
<div class="color-{{ section.settings.color_scheme }} gradient">
```

…and the theme's base CSS handles the rest, because `.color-scheme-2 { --color-background: …; }` was generated for you.

### Presentational-only settings

```json
[
  { "type": "header",    "content": "Layout" },
  { "type": "paragraph", "content": "Choose how products are arranged on mobile." }
]
```

No `id`, no value. They exist purely to make the sidebar navigable. A section with fifteen settings and no headers is a section nobody configures correctly.

## Dynamic sources

This is the feature that makes Online Store 2.0 worth the migration, and it is under-used.

A merchant can click the ⚡ icon next to a supported setting and bind it to a **metafield** or a **standard object property** instead of typing a value. The section then renders per-product, per-collection or per-page data through the same section.

Supported on: `text`, `textarea`, `richtext`, `inline_richtext`, `url`, `image_picker`, `video`, `product`, `collection`, `page`, `article`, `color`, `number`, `checkbox`, and metaobject settings — with the exact list evolving, so check the docs rather than assuming.

The practical shape:

```liquid title="sections/product-callout.liquid"
{%- if section.settings.callout != blank -%}
  <div class="product-callout color-{{ section.settings.color_scheme }}">
    {{ section.settings.callout }}
  </div>
{%- endif -%}

{% schema %}
{
  "name": "Product callout",
  "settings": [
    { "type": "inline_richtext", "id": "callout", "label": "Callout",
      "info": "Bind this to the product's `custom.field_callout` metafield to vary it per product." },
    { "type": "color_scheme", "id": "color_scheme", "label": "Colour scheme", "default": "scheme-3" }
  ]
}
{% endschema %}
```

One section, added once to `templates/product.json`, produces a different callout for all 300 products because it is bound to a metafield. Without dynamic sources you would need either 300 alternate templates or a Liquid conditional per product. Day 5 is entirely about the metafield side of this.

:::hint{type=tip}
The `"info"` key renders as help text under the setting in the editor. Use it to tell the merchandiser *what the setting is bound to* and *what breaks if they get it wrong*. It is documentation that lives where the person reading it actually is, which is worth more than a Confluence page.
:::

## Presets and defaults

```json title="presets"
"presets": [
  {
    "name": "Featured collection",
    "category": "Collection",
    "settings": { "columns": 4, "layout": "grid", "color_scheme": "scheme-1" },
    "blocks": [
      { "type": "heading", "settings": { "text": "New arrivals" } },
      { "type": "product_grid" }
    ]
  }
]
```

The single most important quality bar for a section: **when a merchandiser adds it from the menu, does it look right immediately, with zero configuration?**

If the answer is no — if it renders as an empty box, or a heading with no content, or a grid with no products — the section will be added, look broken, and be removed. You will hear about it as "your section doesn't work."

Concretely:

- Every text setting gets a plausible `default`.
- Every image-dependent layout has a **placeholder fallback**:

  ```liquid
  {%- if section.settings.image != blank -%}
    {{ section.settings.image | image_url: width: 1600 | image_tag: loading: 'lazy', sizes: '100vw' }}
  {%- else -%}
    {{ 'hero-apparel-1' | placeholder_svg_tag: 'placeholder-svg' }}
  {%- endif -%}
  ```

- Every collection-dependent section falls back to *something* when no collection is selected. Dawn's approach — render placeholder cards — is right.
- The preset includes starter blocks, so an empty section is impossible on first add.

`placeholder_svg_tag` accepts names like `product-1`, `collection-1`, `hero-apparel-1`, `lifestyle-1`, `image`, `detailed-apparel-1`. They are Shopify's own grey placeholders and they look intentional rather than broken.

```quiz
question: A merchandiser adds your new "Featured collection" section from the theme editor menu, and it renders as an empty grey box. What is the most likely defect in your schema?
options:
  - "You forgot {{ block.shopify_attributes }}"
  - "The section has no preset, or the preset supplies no defaults and the section has no placeholder fallback"
  - "The section's settings use `range` instead of `number`"
  - "The colour scheme is not defined in settings_schema.json"
answer: 1
explanation: "A freshly-added section renders with only the preset's settings applied. If the preset sets nothing and the code assumes a collection is selected, it renders empty. Presets plus placeholder fallbacks are what make a section usable on first add — this is a quality bar, not a nicety."
```

## Debugging the theme editor

Four failures you will hit, in the order you will hit them.

:::details{summary="My section does not appear in the Add section menu"}
It has no `presets`, or its schema is invalid JSON. Invalid schema is the more common one and it fails **silently on the storefront** while showing an error in the theme editor. Check:

1. Trailing commas — JSON does not allow them and Liquid will not tell you.
2. Comments — `//` is not valid JSON.
3. Liquid inside the `{% schema %}` block — not allowed, at all. Settings are static JSON.
4. Duplicate `id` values within the same settings array.

`shopify theme check` catches most of these. Run it before you blame the editor.
:::

:::details{summary="Changing a setting reloads the whole page instead of updating live"}
Two causes:

1. **Missing `{{ block.shopify_attributes }}`** on block wrappers, or the section not being wrapped by Shopify's own `shopify-section-*` div because you did something unusual with the layout.
2. Your JavaScript initialises on `DOMContentLoaded` only. In the editor, sections are re-rendered and re-injected without a page load. Listen for the section lifecycle events:

```js title="assets/section-events.js"
document.addEventListener('shopify:section:load', (event) => {
  // event.target is the freshly-rendered section element
  initSection(event.target)
})
document.addEventListener('shopify:section:unload', (event) => {
  teardownSection(event.target)
})
document.addEventListener('shopify:block:select', (event) => {
  // Merchant clicked a block in the sidebar — e.g. jump the carousel to that slide
  event.target.closest('slideshow-component')?.showSlide(event.target)
})
```

`shopify:section:select`, `shopify:section:deselect`, `shopify:block:select` and `shopify:block:deselect` complete the set. Any section with JavaScript that a merchant configures needs these, and forgetting them is the number one reason merchandisers describe a theme as "buggy".
:::

:::details{summary="A setting I renamed lost all its data"}
Setting values are keyed by `id`. Renaming `id` orphans every stored value — across every section instance on every template, on the live store. There is no migration mechanism.

If you must rename, the safe path is: add the new setting, write Liquid that falls back (`{{ section.settings.new_id | default: section.settings.old_id }}`), ship, have someone re-save the affected sections, then remove the old setting in a later release. Yes, that is three deployments to rename a field. That is the cost of a system where merchant data lives in the same file as your configuration.
:::

:::details{summary="My local push wiped the merchant's homepage"}
You pushed `templates/index.json` or `config/settings_data.json` over the top of live merchant edits. This is recoverable if you have the theme in Git *and* the merchant's edits were made before your last pull — otherwise the changes are gone.

The fix is process, not code, and it is Day 14's subject. The immediate mitigation:

```bash
shopify theme push --ignore=config/settings_data.json --ignore=templates/*.json
```

The permanent one is a release pipeline where nobody's laptop pushes to a live theme at all.
:::

## Designing settings people can use

Some rules that survive contact with real merchandising teams:

:::cards

:::card{title="Group with headers"}
Content, Layout, Style, Advanced. Four `{ "type": "header" }` entries turn an unusable wall of fields into a form. Order matters: content first, because that is what changes weekly.
:::

:::card{title="Name for the merchant, not the model"}
`"label": "Show second image on hover"`, not `"label": "Enable hover_swap"`. The label is UI copy. Write it like UI copy, and put it in `en.default.schema.json` so it can be translated.
:::

:::card{title="Constrain the blast radius"}
Ranges, selects and block limits. If a value outside a range would break the layout, the range is the fix — not a note in the info text asking people to be careful.
:::

:::card{title="Delete settings that are never used"}
Audit annually. A setting nobody has ever changed from its default is a branch in your code, a case in your QA plan and a row in your CSS. Removing it is a real performance and maintenance win.
:::

:::

## Exercise

:::checklist{title="Day 4 checklist"}
- [ ] Extended your promo banner section with grouped headers and `info` help text
- [ ] Replaced any `color` setting with `color_scheme`, and confirmed the scheme classes render
- [ ] Replaced a `number` setting with a `range`, and a free-text setting with a `select`
- [ ] Added a preset that includes starter blocks, and confirmed the section looks correct on first add with zero configuration
- [ ] Added `placeholder_svg_tag` fallbacks everywhere an image or collection could be empty
- [ ] Built a section with an `inline_richtext` setting and bound it to a product metafield via a dynamic source in the editor
- [ ] Wired `shopify:section:load` and `shopify:block:select` handlers into a section with JavaScript, and verified live updating in the editor
- [ ] Moved every schema label into `locales/en.default.schema.json` and referenced them with `t:` keys
- [ ] Broke the schema JSON deliberately (trailing comma) and observed exactly how it fails
:::

### Stretch problems

1. Take a section with twelve ungrouped settings from any theme and redesign the schema — headers, ordering, better labels, tighter constraints. Write two sentences justifying each constraint you added.
2. Build a section whose layout setting genuinely changes the markup structure (grid versus carousel), not just a class. Decide whether that should be one section or two, and defend the answer.
3. Implement the safe rename of a setting `id` across three commits as described above. Write the release note a QA engineer would need.
4. Add a `metaobject_list` setting and render it. You will not fully understand metaobjects until tomorrow — do it anyway, then revisit this after Day 5 and see what you would change.

## Where this is going

Tomorrow: metafields and metaobjects. The store's own schema extension system — how you add structured data to products, orders, companies and locations, expose it in the theme editor, and stop hard-coding things that are really data.
