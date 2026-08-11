---
title: Responsive Theme CSS Without a Framework
summary: How CSS is organised in a theme with no build step and a flat assets folder — scoped section styles, colour scheme custom properties, responsive images through image_url, and the layout patterns that hold up across desktop, tablet and mobile.
minutes: 100
objectives:
  - Structure theme CSS across a flat assets directory with a naming convention that scales
  - Use section-scoped styles and CSS custom properties driven by schema settings
  - Emit correctly sized, correctly aspect-ratioed responsive images with image_url and image_tag
  - Build layouts with grid, flexbox, clamp and container queries rather than breakpoint sprawl
  - Load CSS in an order that does not sabotage LCP or cause layout shift
keyTerms:
  - term: Section-scoped style
    definition: CSS emitted inside a section file — via a `<style>` block or the `{% stylesheet %}` tag — that applies only to that section, usually keyed to `section.id`.
  - term: CSS custom property bridge
    definition: The pattern of passing schema settings into CSS as custom properties on the section wrapper, so Liquid controls values and CSS controls behaviour.
  - term: image_url
    definition: The Liquid filter that requests a specific rendition of an image from Shopify's CDN. Replaces the deprecated `img_url`.
  - term: image_tag
    definition: A filter that builds a complete `<img>` element from an image URL, emitting srcset, width, height, loading and decoding attributes.
  - term: Cumulative Layout Shift
    definition: A Core Web Vital measuring unexpected movement of visible content. Overwhelmingly caused in themes by images without dimensions and by content injected after first paint.
  - term: Container query
    definition: A CSS query on an element's own container size rather than the viewport. The right tool for components that appear in a full-width section and a narrow sidebar.
resources:
  - label: Liquid filters — image_url and image_tag
    url: https://shopify.dev/docs/api/liquid/filters/media-filters
  - label: Theme assets
    url: https://shopify.dev/docs/storefronts/themes/architecture/assets
  - label: Dawn's CSS conventions
    url: https://github.com/Shopify/dawn/tree/main/assets
  - label: web.dev — optimize CLS
    url: https://web.dev/articles/optimize-cls
---

You already know CSS. What you do not yet know is how CSS behaves in an environment with **no build step, a flat assets directory, a wrapper element you do not control, and a merchant who can reorder your sections arbitrarily**.

That last constraint is the one that matters most. In a normal site you know the header comes before the hero. In a Shopify theme a merchandiser can put the newsletter section above the hero on Tuesday and remove the hero entirely on Wednesday. CSS that assumes document order is CSS that breaks in the theme editor.

## File organisation in a flat directory

`assets/` allows no subdirectories. Themes solve this with filename prefixes, and the convention is worth adopting exactly because everyone else uses it:

```text title="assets/"
base.css                      # reset, tokens, typography, utilities — loaded on every page
component-card.css            # a reusable component
component-price.css
component-cart-drawer.css
section-image-banner.css      # styles for one section
section-featured-collection.css
template-collection.css       # styles specific to one template
```

Load them where they are needed, not all at once:

```liquid title="layout/theme.liquid"
{{ 'base.css' | asset_url | stylesheet_tag }}
```

```liquid title="sections/image-banner.liquid"
{{ 'section-image-banner.css' | asset_url | stylesheet_tag }}
```

Shopify deduplicates repeated `stylesheet_tag` calls for the same asset, so a component stylesheet requested by three sections on one page produces one `<link>`. That is what makes per-section loading practical rather than a waterfall.

:::hint{type=warning}
`stylesheet_tag` emits a **render-blocking** `<link>`. That is correct for above-the-fold styles and wrong for a section that sits 4,000 pixels down the page. For below-the-fold sections, either accept the cost (it is usually small and cached) or defer:

```liquid
<link rel="stylesheet" href="{{ 'section-newsletter.css' | asset_url }}" media="print" onload="this.media='all'">
<noscript>{{ 'section-newsletter.css' | asset_url | stylesheet_tag }}</noscript>
```

Do this deliberately and measure it. Day 11 puts numbers on when it helps.
:::

## Section-scoped styles

Two mechanisms, with a real difference between them.

```liquid title="sections/image-banner.liquid"
{%- comment -%} Option A: a scoped style block, keyed to this section instance {%- endcomment -%}
<style>
  #shopify-section-{{ section.id }} .banner {
    --banner-height: {{ section.settings.height }}px;
    --banner-overlay: {{ section.settings.overlay_opacity | divided_by: 100.0 }};
  }
</style>
```

```liquid title="sections/newsletter.liquid"
{%- comment -%} Option B: the stylesheet tag — extracted and concatenated by Shopify {%- endcomment -%}
{% stylesheet %}
  .newsletter__form {
    display: grid;
    gap: var(--space-3);
  }
{% endstylesheet %}
```

- **Option A** is per-instance. If the merchant adds the section twice with different settings, each gets its own values. This is the pattern for anything driven by a schema setting.
- **Option B** is static CSS collected into one file by the platform. It cannot contain Liquid. Use it for structural styles that never vary.

The mature pattern combines them: **Liquid emits custom properties; CSS consumes them.**

```liquid title="the bridge pattern"
<div
  class="banner banner--{{ section.settings.height_preset }} color-{{ section.settings.color_scheme }}"
  style="
    --banner-min-height: {{ section.settings.min_height }}px;
    --banner-content-align: {{ section.settings.alignment }};
    --banner-overlay: {{ section.settings.overlay | divided_by: 100.0 }};
  "
>
```

```css title="assets/section-image-banner.css"
.banner {
  position: relative;
  min-height: var(--banner-min-height, 400px);
  display: grid;
  place-items: var(--banner-content-align, center);
}

.banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / var(--banner-overlay, 0.3));
}
```

Why this is better than generating whole rules in Liquid: the CSS file is cacheable, readable and lintable, while the values stay merchant-controlled. You get one small inline `style` attribute per section instance instead of a `<style>` block per instance.

:::hint{type=danger}
**Never interpolate unescaped merchant input into a `<style>` block.** A `text` setting piped into CSS is an injection vector — a merchant with theme-editor access is not the threat, but an app with write access to theme settings is. Numeric settings should come from `range` (already constrained), and anything else should be run through `escape` or, better, mapped through a `case` statement to a known set of values.
:::

## Colour schemes in practice

Yesterday's schema work pays off here. Shopify generates custom properties per scheme; your CSS only ever references the properties:

```css title="assets/base.css (abridged)"
.color-scheme-1 {
  --color-background: 255 255 255;
  --color-foreground: 20 20 20;
  --color-button: 242 101 34;
  --color-button-text: 255 255 255;
}

body,
.color-scheme-1,
.color-scheme-2,
.color-scheme-3 {
  color: rgb(var(--color-foreground));
  background-color: rgb(var(--color-background));
}

.button {
  background-color: rgb(var(--color-button));
  color: rgb(var(--color-button-text));
}
```

Storing colours as **space-separated RGB channels** rather than hex is the trick that makes alpha work: `rgb(var(--color-foreground) / 0.6)` gives you a 60%-opacity foreground colour that automatically follows the scheme. Dawn does this and it is worth copying.

## Responsive images

This is where theme CSS meets Core Web Vitals, and where most themes lose points.

```liquid title="responsive-image.liquid"
{%- comment -%} Bad: fixed size, no srcset, no dimensions — guarantees CLS {%- endcomment -%}
<img src="{{ product.featured_image | image_url: width: 1200 }}" alt="{{ product.title }}">

{%- comment -%} Good {%- endcomment -%}
{{ product.featured_image
   | image_url: width: 1600
   | image_tag:
       loading: 'lazy',
       widths: '300, 500, 700, 900, 1200, 1600',
       sizes: '(min-width: 990px) 33vw, (min-width: 750px) 50vw, 100vw',
       alt: product.featured_image.alt | default: product.title | escape,
       class: 'card__image' }}
```

`image_tag` emits `width` and `height` attributes derived from the image's real aspect ratio. Combined with `height: auto` in CSS, that reserves the correct space before the image loads and takes your CLS contribution from that image to zero. This is not a micro-optimisation; it is the single highest-leverage CSS/markup habit in a theme.

Three rules:

1. **`sizes` must describe your actual layout.** If your grid is 4-up on desktop and you tell the browser `100vw`, it downloads a 1600px image for a 350px slot on every card. Getting `sizes` wrong is worth megabytes on a collection page.
2. **The LCP image must not be lazy.** The hero or first product image should be `loading: 'eager'` and, ideally, preloaded. `loading="lazy"` on an LCP element is one of the most reliable ways to fail that metric.
3. **Never request an image larger than the largest slot.** `width: 1600` on a card that renders at 400px is wasted bandwidth even with a correct `sizes`.

```liquid title="preloading the LCP image"
{%- if section.settings.image != blank and section.index == 1 -%}
  <link
    rel="preload"
    as="image"
    href="{{ section.settings.image | image_url: width: 1600 }}"
    imagesrcset="{{ section.settings.image | image_url: width: 800 }} 800w, {{ section.settings.image | image_url: width: 1600 }} 1600w"
    imagesizes="100vw"
  >
{%- endif -%}
```

:::hint{type=tip}
`section.index` tells you the position of the section within the template (1-based), and `section.index0` the zero-based version. Guarding an eager-load or preload on `section.index == 1` is how you express "this is the top of the page" without hard-coding which section that is — because the merchandiser gets to decide.
:::

## Layout patterns that survive reordering

### Fluid type and space, not breakpoint ladders

```css title="assets/base.css"
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: clamp(1.5rem, 4vw, 3rem);
  --space-5: clamp(3rem, 8vw, 6rem);

  --font-heading-xl: clamp(2rem, 1.2rem + 4vw, 4rem);
  --font-body: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);

  --page-width: 1440px;
  --page-gutter: clamp(1rem, 4vw, 3rem);
}

.page-width {
  max-width: var(--page-width);
  margin-inline: auto;
  padding-inline: var(--page-gutter);
}
```

`clamp()` removes most of the breakpoints a theme would otherwise carry. The ones that remain should be about **layout structure changing**, not about numbers getting bigger.

### Grid for the structural change

```css title="assets/component-card-grid.css"
.card-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(var(--cards-per-row-mobile, 2), minmax(0, 1fr));
}

@media screen and (min-width: 750px) {
  .card-grid {
    grid-template-columns: repeat(var(--cards-per-row, 4), minmax(0, 1fr));
  }
}
```

`minmax(0, 1fr)` rather than `1fr` is not pedantry — `1fr` has a minimum of `auto`, so a long unbroken product title or a wide image will blow the column out. This single substitution fixes the majority of "the grid overflows on mobile" bugs.

### Container queries for genuinely reusable components

```css title="assets/component-card.css"
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 320px) {
  .card { grid-template-columns: 1fr 1fr; }
  .card__title { font-size: var(--font-body); }
}
```

A product card appears in a 4-up grid, a 2-up related-products row, a cart drawer and a search dropdown. Viewport media queries cannot distinguish those. Container queries can, and this is exactly the case they were designed for.

```quiz
question: A product card renders correctly in a 4-column collection grid but is cramped inside a narrow cart drawer at the same viewport width. What is the appropriate fix?
options:
  - "Add a viewport media query for narrow screens"
  - "Give the card a container query on its own inline size"
  - "Duplicate the card snippet with drawer-specific styles"
  - "Set the drawer to a fixed pixel width and hard-code the card layout"
answer: 1
explanation: "The viewport is identical in both cases; only the container differs. `container-type: inline-size` plus `@container` lets one component respond to the space it is actually given — which is what makes a card genuinely reusable across grid, drawer, related products and search results."
```

## Accessibility as a build habit

The theme is the store. An inaccessible storefront is a legal exposure as well as a lost customer, and it is dramatically cheaper to build in than retrofit.

The non-negotiables, all of which are CSS/markup concerns:

- **Visible focus.** Never `outline: none` without an equally visible replacement. Use `:focus-visible` so mouse users do not see rings but keyboard users do.
- **Skip link.** Dawn ships one. Keep it, and make sure it becomes visible on focus.
- **Target size.** Interactive controls at least 44×44 CSS pixels — quantity steppers and swatch buttons are the usual offenders.
- **Contrast.** 4.5:1 for body text. This is where per-section colour pickers bite you: a merchandiser can set white text on a pale grey background and nothing stops them. Colour *schemes* let you validate combinations once.
- **Reduced motion.**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- **Do not hide content from screen readers with `display: none`** when you meant "visually hidden". Use a `.visually-hidden` utility.

## Exercise

:::checklist{title="Day 6 checklist"}
- [ ] Reorganised your added CSS into `component-*` / `section-*` files with per-section `stylesheet_tag` loading
- [ ] Confirmed a component stylesheet requested by three sections produces only one `<link>` in the rendered HTML
- [ ] Implemented the custom-property bridge on one section: Liquid emits properties, CSS consumes them
- [ ] Replaced every hand-written `<img>` in your work with `image_url | image_tag`, including `sizes` matched to the real layout
- [ ] Verified in DevTools that images now carry `width`/`height` attributes and that the page's CLS is effectively zero on reload
- [ ] Set the first section's image to `loading: 'eager'` and added a preload guarded on `section.index == 1`
- [ ] Replaced at least three breakpoint-driven font sizes with `clamp()`
- [ ] Changed every `1fr` in a grid template to `minmax(0, 1fr)` and confirmed a long product title no longer overflows
- [ ] Converted the product card to a container query so it works in both the grid and the cart drawer
- [ ] Added the reduced-motion block and a `:focus-visible` style, and tabbed the entire homepage with no mouse
:::

### Stretch problems

1. Measure it: load a collection page, note the total image bytes transferred, then fix the `sizes` attribute to match your actual grid and reload. Record the before and after. This is the number you will quote when someone asks why `sizes` matters.
2. Build a section whose layout genuinely changes at a container breakpoint — two-column on wide, stacked on narrow — and place it in both a full-width slot and a sidebar in the same page. Confirm one CSS file handles both.
3. Take a section with a `color` picker and convert it to `color_scheme`. Write down every place in the CSS that got simpler.
4. Find the LCP element on your homepage using DevTools' Performance panel. Then reorder the sections in the theme editor so a different section is first. Does your preload still target the right image? If not, fix the guard.

## Where this is going

Tomorrow: JavaScript. Framework-free, web-component-shaped, and — crucially — written to survive the theme editor re-rendering your section underneath it at any moment.
