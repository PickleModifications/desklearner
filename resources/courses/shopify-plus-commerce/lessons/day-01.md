---
title: The Shopify Development Environment
summary: Get a free development store, install the Shopify CLI, pull down Dawn, run a hot-reloading dev theme against real store data, and understand why Shopify development is unlike every other front-end job you have had.
minutes: 90
objectives:
  - Create a Shopify Partner account and a development store seeded with test products
  - Install the Shopify CLI and authenticate it against your store
  - Pull, run and push a theme with shopify theme dev / pull / push, and explain what each one touches
  - Explain the difference between a development theme, an unpublished theme and the live theme
  - Run Theme Check as a linter and understand why it is the closest thing the platform has to a compiler
keyTerms:
  - term: Development store
    definition: A free, fully-featured Shopify store created from a Partner account. It cannot take real payments (it uses Bogus Gateway) and is password-protected, but it runs the same code as production.
  - term: Shopify CLI
    definition: Shopify's command-line tool. For theme work it authenticates against a store, serves a local hot-reloading preview, and pushes/pulls theme files. For app work it scaffolds and deploys apps, extensions and Functions.
  - term: Dawn
    definition: Shopify's free reference theme. It is the canonical example of Online Store 2.0 conventions, framework-free JavaScript and accessible markup — you will read it constantly.
  - term: Development theme
    definition: A hidden, temporary theme the CLI creates when you run `shopify theme dev`. It is invisible in the theme library list, does not count against the 20-theme limit, and is deleted after about a week of inactivity.
  - term: Theme Check
    definition: Shopify's Liquid linter. It catches undefined objects, deprecated tags, missing translations, unused assets and performance anti-patterns. Runs in the CLI and in editors via the Liquid extension.
  - term: Online Store 2.0
    definition: The 2021 theme architecture that introduced JSON templates, sections on every page, app blocks and theme-editor-exposed metafields. Any theme you write today should follow it.
resources:
  - label: Shopify Partners — create an account
    url: https://www.shopify.com/partners
  - label: Shopify CLI for themes
    url: https://shopify.dev/docs/api/shopify-cli/theme
  - label: Dawn on GitHub
    url: https://github.com/Shopify/dawn
  - label: Theme Check
    url: https://shopify.dev/docs/storefronts/themes/tools/theme-check
  - label: Shopify.dev — themes overview
    url: https://shopify.dev/docs/storefronts/themes
---

You already know how to build for the web. You can write semantic HTML, you understand the cascade, you can ship JavaScript that does not leak listeners, and you have deployed enough sites to have opinions about build pipelines. None of that is what makes Shopify development hard.

What makes it different is that **you do not own the runtime**. Your code executes on Shopify's servers, inside a templating language you cannot extend, against a data model you cannot alter, wrapped in a checkout you mostly cannot touch. There is no `npm run build` producing a bundle you control end to end. There is no server you can SSH into. The platform sets the boundaries, and the craft is in knowing precisely where they are.

That constraint is the good news. It means the surface area is finite and learnable, and that the engineer who genuinely knows the boundaries is worth far more than the one who fights them.

## The store you will build against

Everything in this course is built against one fictional business: a workwear brand selling boots and apparel through three channels — a direct-to-consumer storefront, a wholesale catalog for trade distributors, and physical retail running Shopify POS. That is deliberately the hardest realistic shape, because the three channels share a product catalog and disagree about almost everything else.

You need a store to build in. Do not use a production store, and do not pay for anything.

:::steps

1. **Create a Shopify Partner account** at partners.shopify.com. It is free and requires no card. Partner accounts exist so agencies and freelancers can create stores for clients; you are using it for the same reason at a smaller scale.

2. **Partner dashboard → Stores → Add store → Create development store.** Choose **"Create a store to test and build"**. Name it something you will recognise — `workwear-dev` — and pick a store purpose of *test and build*.

3. **Select "Start with test data"** if the option is offered. This seeds products, collections, customers and orders. An empty store is a bad teacher: half of theme development is handling the cases where data is messy, and you cannot see those cases with three products.

4. **Note the store domain.** It will be `your-store-name.myshopify.com`. That `.myshopify.com` domain never goes away, even when a real domain is attached later, and it is what the CLI and every API call actually address.

5. **Set a staff password** under Online Store → Preferences if prompted. Development stores are password-protected by default. That is fine and you should leave it on.

:::

:::hint{type=tip}
**Development stores are not a lesser product.** They run the same Liquid engine, the same Ajax APIs and the same admin as a production store. The differences are: they cannot process real payments (there is a **Bogus Gateway** that accepts a fake card number for testing), they cannot be transferred without going through the Partner flow, and some plan-gated features need to be explicitly enabled.

For this course you will need Plus-tier features. A Partner development store can be set to a **Shopify Plus** plan type from the Partner dashboard (store settings → plan). Do that now — Chapters 4 and 5 depend on it. If a specific feature is unavailable on your development store, the lesson will say so and give you a way to reason about it without hands-on access.
:::

## Installing the CLI

The Shopify CLI is a Node package. Version 3.x is the current generation and unified what used to be several separate tools.

```bash title="install-cli.sh"
# Global install — this is one of the rare cases where global is right,
# because you will use it across many unrelated theme repositories.
npm install -g @shopify/cli

shopify version

# Authenticate. This opens a browser, and the token is cached per-store.
shopify auth logout          # if you have ever logged in as someone else
```

You do not run a separate login command for themes. The first CLI command that needs authentication triggers the browser flow itself.

:::hint{type=warning}
The CLI writes credentials to your machine and, for app development, writes a `.env` containing an API secret. **Never commit a `.env` or a `shopify.app.toml` containing secrets.** Add both to `.gitignore` before your first commit, not after — a secret that has ever been pushed to a remote is compromised even if you delete it in the next commit.
:::

## Getting a theme to work on

Two paths. Take the first one.

:::tabs

:::tab{title="Start from Dawn (recommended)"}
```bash
git clone https://github.com/Shopify/dawn.git workwear-theme
cd workwear-theme
rm -rf .git && git init      # you want your history, not Shopify's
```

Dawn is Shopify's reference theme: framework-free, accessible, fast, and written to demonstrate every Online Store 2.0 convention. Starting from it means every decision you make is a deliberate departure from a known-good baseline, rather than an invention.
:::

:::tab{title="Pull an existing theme"}
```bash
mkdir workwear-theme && cd workwear-theme
shopify theme pull --store your-store-name.myshopify.com
```

`theme pull` downloads a theme from the store into the current directory. You will be asked which theme. This is what you do on day one at a job that already has a storefront — and the first thing you should notice is whether the code you pulled matches what is in the company's Git repository. Very often it does not, because someone edited a file in the admin's code editor. Finding that drift is a legitimate first-week task.
:::

:::

### The directory layout

```text title="theme structure"
├── assets/          # CSS, JS, images, fonts. Flat — no subdirectories allowed.
├── blocks/          # Theme blocks: reusable, nestable blocks usable across sections
├── config/
│   ├── settings_schema.json   # defines theme-wide settings (the "Theme settings" panel)
│   └── settings_data.json     # the *values* a merchant has chosen. Generated. Do not hand-edit.
├── layout/
│   ├── theme.liquid           # the outer HTML shell for every page
│   └── password.liquid        # the shell for the password page
├── locales/
│   ├── en.default.json        # storefront translations
│   └── en.default.schema.json # theme editor UI translations
├── sections/        # sections: the merchandising unit of a 2.0 theme
├── snippets/        # partials, rendered with {% render %}
└── templates/       # one per page type; .json (2.0) or .liquid (legacy)
    └── customers/   # account, login, order, register, addresses
```

Four things about this that are not obvious:

1. **`assets/` is flat.** You cannot create `assets/css/base.css`. Everything lives at the top level, which is why theme conventions lean hard on filename prefixes: `component-card.css`, `section-featured-collection.css`.
2. **`config/settings_data.json` is data, not code.** It holds what the merchant chose in the theme editor. Pushing your local copy over a live store's copy will **wipe their configuration**. This causes more real incidents than any other single mistake in theme development.
3. **`templates/*.json` are also data-shaped** — they store which sections appear on a page and in what order, including merchant edits made in the theme editor.
4. **There is no build step.** Shopify serves `assets/theme.css` as written. If you want a build step you have to bolt one on yourself, and most teams deliberately do not.

:::hint{type=danger}
Commit `config/settings_data.json` to Git, but treat pushing it like a database migration: deliberate, reviewed, and never as a side effect of "I just wanted to push my CSS change." The CLI's `--ignore` flag exists exactly for this:

```bash
shopify theme push --ignore=config/settings_data.json --ignore=templates/*.json
```

Chapter 3 turns this into an actual release process. For now, build the reflex.
:::

## Running a development theme

```bash title="dev.sh"
shopify theme dev --store your-store-name.myshopify.com
```

That command does considerably more than it looks like:

- It uploads your local files to a **development theme** — a hidden theme that does not appear in the merchant's theme list and does not count against the 20-theme limit.
- It serves `http://127.0.0.1:9292`, proxying real store data through it. Real products, real prices, real customer sessions.
- It **hot-reloads**. CSS changes apply without a page refresh. Liquid changes trigger a section re-render where possible, and a full reload where not.
- It prints a **preview link** you can share, and a **theme editor link** that opens the customizer against your dev theme.

```text title="what dev prints"
Preview your theme (t):     http://127.0.0.1:9292
Customize your theme (c):   https://admin.shopify.com/store/…/themes/…/editor
Preview your gift cards (g): http://127.0.0.1:9292/gift_cards/…
```

:::hint{type=tip}
The `--theme-editor-sync` flag makes changes made in the theme editor flow **back down** to your local files. This is genuinely useful when a designer or merchandiser is arranging sections while you work, and genuinely dangerous when you have uncommitted local changes. Know it exists; reach for it consciously.
:::

### Development theme vs unpublished theme vs live theme

This distinction trips up every new Shopify developer at least once, usually publicly.

| | Development theme | Unpublished theme | Live theme |
|---|---|---|---|
| Created by | `shopify theme dev` | `theme push --unpublished`, duplicate in admin | Publishing an unpublished theme |
| Visible in theme library | No | Yes | Yes, at the top |
| Customer-facing | No | No (preview link only) | **Yes** |
| Counts to the 20-theme limit | No | Yes | Yes |
| Lifetime | Deleted after ~7 days idle | Until deleted | Until replaced |
| Safe to push to mid-sprint | Yes | Yes | **Never do this** |

The rule that follows: **you never push to the live theme from a terminal.** Live changes go through a review and a publish, and Chapter 3 builds that pipeline. The one exception every team eventually makes — a genuine production hotfix — should still be a reviewed pull request that a pipeline publishes, and the fact that it is 11pm does not change that.

## Theme Check: the closest thing to a compiler

Liquid has no type system and fails quietly. `{{ product.titel }}` renders an empty string. `{% render 'card-produkt' %}` renders nothing at all. Neither raises an error, and neither will be caught by looking at a page where that section happens to be empty.

Theme Check is what fills that gap.

```bash title="lint.sh"
shopify theme check

# Just the errors, machine-readable, for CI:
shopify theme check --fail-level error --output json
```

It reports things like:

- `UndefinedObject` — you referenced a variable that does not exist in this context
- `MissingTemplate` — you rendered a snippet that is not there
- `DeprecatedFilter` / `DeprecatedTag` — `{% include %}`, `img_url`, and friends
- `RemoteAsset` — you are loading a script or font from a third-party CDN instead of the theme's assets
- `TranslationKeyExists` — a `t` filter pointing at a key that does not exist in the locale file
- `UnusedAssign`, `UnusedSnippet`, `ImgLazyLoading`, `AssetSizeCSS`, and a long tail of performance checks

Configure it with a `.theme-check.yml` at the theme root:

```yaml title=".theme-check.yml"
extends: :theme_app_extension

TemplateLength:
  enabled: true
  max_length: 250

AssetSizeJavaScript:
  enabled: true
  threshold_in_bytes: 10000

RemoteAsset:
  enabled: true
```

:::hint{type=tip}
Install the **Shopify Liquid** extension for VS Code. It bundles the Theme Check language server, so those errors appear inline as you type rather than at the end of a build you do not have. It also gives you Liquid object autocomplete, which materially speeds up learning the object model in Chapter 1.
:::

## Your first change

Let us make a change that proves the whole loop works, end to end.

:::steps

1. Run `shopify theme dev` and open `http://127.0.0.1:9292`.

2. Open `sections/footer.liquid` and find where the copyright line is rendered. Add a build marker just above it:

   ```liquid
   <p class="footer__build-marker">Theme build: {{ 'now' | date: '%Y-%m-%d %H:%M' }}</p>
   ```

3. Save. Watch the browser update without you touching it.

4. Now break it deliberately: change `{{ 'now' | date: ... }}` to `{{ 'now' | dateformat: ... }}`. Save and look at the page.

5. Note what happened. **Nothing visible.** The output is empty. There is no console error, no 500, no red text. Run `shopify theme check` and watch it tell you what the browser would not.

6. Fix it, then delete the marker.

:::

That silence is the single most important thing to internalise on day one. In a JavaScript app, a typo throws. In Liquid, a typo renders nothing, the page still returns 200, and the bug ships. Your linter and your review discipline are not optional hygiene here — they are the error handling.

```quiz
question: You run `shopify theme dev` against a store whose live theme is serving customers. What is the risk to those customers?
options:
  - "High — dev serves your local files to live traffic"
  - "None — dev uploads to a hidden development theme served only at your localhost preview"
  - "Moderate — dev overwrites the live theme's settings_data.json"
  - "None, but only if you pass the --unpublished flag"
answer: 1
explanation: "`shopify theme dev` creates or reuses a hidden development theme and proxies it to your localhost. Live traffic is untouched. The dangerous command is `shopify theme push --live` (or pushing to the live theme's ID), which is why it should never be part of anyone's muscle memory."
```

## Where the docs are, and how to read them

You will live at **shopify.dev**. Three areas matter most, and it is worth bookmarking them individually rather than the homepage:

:::cards

:::card{title="Liquid reference"}
Every object, tag and filter, with the properties each object exposes. When you are asking "what can I get off `product` here?", this is the answer. Note the *availability* notes — many objects only exist in specific templates.
:::

:::card{title="Theme architecture"}
Layouts, templates, sections, blocks, section groups, settings schema. This is the conceptual spine of Chapter 1 and the part most tutorials skip.
:::

:::card{title="API reference"}
Admin GraphQL, Storefront API, Ajax API, Function APIs. Versioned quarterly — `2025-01`, `2025-04` and so on. Always check which version an example targets.
:::

:::card{title="Changelog"}
shopify.dev/changelog. The platform ships constantly and deprecates on published timelines. Reading this weekly is a genuine part of the job, not optional professional development.
:::

:::

:::hint{type=warning}
**API versions expire.** Shopify releases a new API version quarterly and supports each for a minimum of twelve months. Code pinned to an old version does not break gradually — it stops working on a published date. Part of owning a Shopify platform is tracking which versions your apps, custom integrations and Functions target, and scheduling the upgrades before the deadline rather than during an incident.
:::

## Exercise

:::checklist{title="Day 1 checklist"}
- [ ] Partner account created, development store created with test data
- [ ] Store plan set to Shopify Plus in the Partner dashboard
- [ ] `@shopify/cli` installed globally; `shopify version` prints 3.x
- [ ] Dawn cloned into a fresh Git repository with your own initial commit
- [ ] `.gitignore` covers `.env`, `node_modules/`, `.shopify/`
- [ ] `shopify theme dev` running, localhost preview loading real store products
- [ ] Made a change to `sections/footer.liquid` and watched it hot-reload
- [ ] Introduced a deliberate Liquid typo, confirmed it rendered silently, and caught it with `shopify theme check`
- [ ] Shopify Liquid extension installed in your editor with inline Theme Check working
- [ ] Pushed an *unpublished* theme with `shopify theme push --unpublished` and previewed it from the admin
:::

### Stretch problems

1. Push an unpublished theme, then duplicate it in the admin and rename both. Confirm you can tell from the CLI (`shopify theme list`) which one is live.
2. Read `layout/theme.liquid` in Dawn from top to bottom. You will not understand all of it. Write down five things you do not recognise — tomorrow's lesson answers most of them.
3. Find `RemoteAsset` in the Theme Check docs. Then find a theme in the Shopify Theme Store that violates it (loading a Google Font from `fonts.googleapis.com` is a common one) and write one sentence on why Shopify considers this a performance problem rather than a style preference.
4. Run `shopify theme check` on unmodified Dawn. It should be clean or near-clean. That is your baseline: any error you introduce is yours.

## Where this is going

Tomorrow: Liquid itself — the objects, the tags, the filters, and the two or three semantics (scope isolation in `{% render %}`, the cost of nested loops, why `{% assign %}` inside a `for` behaves the way it does) that separate someone who can read Liquid from someone who can write it well.
