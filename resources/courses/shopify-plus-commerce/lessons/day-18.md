---
title: Checkout Extensibility
summary: Customising the one part of the store you do not own — checkout UI extensions, the branding API, checkout profiles, post-purchase and thank-you/order-status extensions, and migrating off checkout.liquid.
minutes: 130
objectives:
  - Explain what replaced checkout.liquid and Additional Scripts, and why
  - Build a checkout UI extension at a defined target, with validation and metafield writes
  - Configure checkout branding and profiles, including a separate B2B checkout experience
  - Choose correctly between a UI extension, a Function and a pixel for a given checkout requirement
  - Plan a migration off legacy checkout customisations
keyTerms:
  - term: Checkout UI extension
    definition: A React-based component rendered by Shopify at a defined extension target inside checkout, running in a sandbox with a typed API for reading and writing checkout state.
  - term: Extension target
    definition: The named slot where an extension renders — for example a block after the shipping method, a field near contact information, or a dynamic target the merchant places in the checkout editor.
  - term: Checkout profile
    definition: A named checkout configuration — branding, extension placement, settings — that can be published, scheduled or assigned to a context such as B2B.
  - term: Branding API
    definition: The Admin API surface for setting checkout colours, typography, corner radii, logo and layout per checkout profile.
  - term: Post-purchase extension
    definition: An extension rendered between order submission and the thank-you page, typically used for a one-click upsell.
  - term: checkout.liquid
    definition: The legacy Plus-only Liquid template for checkout pages, being retired in stages along with the Additional Scripts boxes.
resources:
  - label: Checkout UI extensions
    url: https://shopify.dev/docs/api/checkout-ui-extensions
  - label: Checkout extension targets
    url: https://shopify.dev/docs/api/checkout-ui-extensions/latest/extension-targets-overview
  - label: Checkout branding API
    url: https://shopify.dev/docs/api/admin-graphql/latest/mutations/checkoutBrandingUpsert
  - label: Checkout extensibility overview
    url: https://shopify.dev/docs/apps/build/checkout
  - label: Upgrading from checkout.liquid
    url: https://help.shopify.com/en/manual/checkout-settings/checkout-extensibility
---

Checkout is the highest-stakes surface on the platform and the one you control least. That is deliberate: Shopify guarantees checkout conversion, PCI compliance, fraud analysis and uptime, and it can only do that if merchants cannot put arbitrary code in the payment path.

For years Plus merchants got an exception — `checkout.liquid`, plus "Additional Scripts" boxes on the checkout and order status pages. Those are being retired in stages, and the replacement is a set of defined, supported seams.

The practical consequence: **you can no longer do anything you like at checkout, and you can do most of what anyone actually asks for.** Knowing exactly where that line sits is what makes you useful in a requirements conversation.

## What replaced what

| Old approach | New approach |
|---|---|
| Editing `checkout.liquid` markup | Checkout UI extensions at defined targets |
| Checkout CSS overrides | Branding API + checkout profiles |
| Additional Scripts for tracking | Web Pixels API (Day 12) |
| Additional Scripts on order status | Thank-you and order-status UI extensions |
| Scripts for discounts / shipping / payments | Functions (Day 17) |
| Hidden fields hacked into the form | Extension-written cart or order attributes and metafields |

:::hint{type=danger}
The retirement of `checkout.liquid` and Additional Scripts happens on **published dates**, in stages — the information, shipping and payment pages first, then the thank-you and order status pages. Stores that miss a date do not degrade gracefully; the customisation simply stops.

If you inherit a store on legacy checkout, the inventory of what lives there is the highest-priority discovery task you have. Some items map cleanly to a new mechanism, some need a product decision, and a few genuinely cannot be rebuilt — and the business needs to know which is which long before the deadline.
:::

## Checkout UI extensions

An extension is a React component in an app, deployed with the Shopify CLI, rendered by Shopify inside its own checkout.

```bash
shopify app generate extension --template checkout_ui --name delivery-instructions
```

```jsx title="src/Checkout.jsx"
import {
  reactExtension,
  BlockStack,
  TextField,
  Banner,
  Checkbox,
  useApplyAttributeChange,
  useAttributeValues,
  useBuyerJourneyIntercept,
  useTranslate,
  useSettings,
  useApi
} from '@shopify/ui-extensions-react/checkout'

export default reactExtension('purchase.checkout.shipping-option-list.render-after', () => (
  <DeliveryInstructions />
))

function DeliveryInstructions() {
  const translate = useTranslate()
  const applyAttributeChange = useApplyAttributeChange()
  const { site_access_label: label } = useSettings()
  const [instructions, needsBooking] = useAttributeValues([
    'delivery_instructions',
    'site_booking_required'
  ])
  const { buyerJourney } = useApi()

  // Block progress when a required condition is unmet, with a targeted message.
  useBuyerJourneyIntercept(({ canBlockProgress }) => {
    if (canBlockProgress && needsBooking === 'true' && !instructions) {
      return {
        behavior: 'block',
        reason: 'Site access details required',
        errors: [
          {
            message: translate('errors.instructionsRequired'),
            target: '$.cart.deliveryGroups[0].deliveryAddress'
          }
        ]
      }
    }
    return { behavior: 'allow' }
  })

  return (
    <BlockStack spacing="base">
      <Checkbox
        checked={needsBooking === 'true'}
        onChange={(value) =>
          applyAttributeChange({
            type: 'updateAttribute',
            key: 'site_booking_required',
            value: String(value)
          })
        }
      >
        {label || translate('siteAccess.label')}
      </Checkbox>

      {needsBooking === 'true' && (
        <>
          <Banner status="info">{translate('siteAccess.info')}</Banner>
          <TextField
            label={translate('instructions.label')}
            multiline={3}
            value={instructions || ''}
            onChange={(value) =>
              applyAttributeChange({
                type: 'updateAttribute',
                key: 'delivery_instructions',
                value
              })
            }
          />
        </>
      )}
    </BlockStack>
  )
}
```

Five things in there that generalise:

1. **You use Shopify's components, not HTML.** `BlockStack`, `TextField`, `Banner`, `Checkbox`. There is no DOM access, no arbitrary CSS. The components inherit the merchant's branding automatically, which is why extensions look native rather than bolted on.
2. **State goes through hooks.** `useApplyAttributeChange` writes a cart attribute that flows onto the order; `useAttributeValues` reads it back. That attribute is then visible in the admin, to Flow and to your ERP integration — the same mechanism from Day 9.
3. **`useBuyerJourneyIntercept` can block progress**, with a message targeted at a specific field. This is validation done properly rather than by hiding a button.
4. **`useSettings` reads merchant-configured settings** declared in the extension's TOML, so a merchant can change the label without a deployment. Same instinct as section schema settings.
5. **`useTranslate` for every string.** Checkout is where international customers arrive; hard-coded English is a defect.

:::hint{type=warning}
Extensions run **sandboxed in a worker**, not on the checkout's main thread. That is what makes them safe, and it is why the API is deliberately narrow: no `document`, no direct network access to arbitrary origins (network calls go to your app's declared endpoints), no ability to restyle Shopify's own components beyond what branding allows.

Every "can we just…" question about checkout resolves to: is there a target, a component and an API for it? If not, the answer is genuinely no, and the useful follow-up is what the underlying business need is — because there is usually a different seam that meets it.
:::

### Static and dynamic targets

**Static targets** render at a fixed location: `purchase.checkout.block.render`, `purchase.checkout.shipping-option-list.render-after`, `purchase.checkout.contact.render-after`, `purchase.checkout.delivery-address.render-before`, and so on.

**Dynamic targets** let the *merchant* place your extension in the checkout editor, which is the better default for anything merchandising-owned — the same argument as section schema settings, one layer up.

The **thank-you** and **order status** pages have their own targets (`purchase.thank-you.*`, `customer-account.order-status.*`) and are where post-purchase content, tracking widgets and account-creation prompts now live.

## Branding and profiles

```graphql title="setting checkout branding"
mutation SetCheckoutBranding($checkoutProfileId: ID!) {
  checkoutBrandingUpsert(
    checkoutProfileId: $checkoutProfileId
    checkoutBrandingInput: {
      designSystem: {
        colors: {
          global: { brand: "#F26522", accent: "#141414" }
          schemes: {
            scheme1: {
              base: { background: "#FFFFFF", text: "#141414" }
              primaryButton: { background: "#F26522", text: "#FFFFFF" }
            }
          }
        }
        cornerRadius: { base: 4, small: 2, large: 8 }
        typography: {
          primary: { customFontGroup: { base: { genericFileId: "gid://shopify/GenericFile/123" } } }
        }
      }
      customizations: {
        global: { cornerRadius: BASE }
        header: { alignment: START, position: INLINE }
        merchandiseThumbnail: { border: FULL }
        primaryButton: { blockPadding: BASE }
      }
    }
  ) {
    checkoutBranding { designSystem { colors { global { brand } } } }
    userErrors { field message }
  }
}
```

Verbose, but it is real API-driven configuration, which means it is version-controllable and repeatable across stores — a meaningful advantage over the CSS file it replaced.

**Checkout profiles** let you hold several configurations. The uses that come up:

- A **B2B profile** with different fields, a purchase-order number capture, and no promotional upsells.
- A **campaign profile** with seasonal branding, published on a schedule (Day 20 does this with Launchpad).
- A **draft profile** where you build and preview the next change without touching the live checkout.

```quiz
question: A stakeholder asks for a countdown timer in checkout that creates urgency, styled to match a campaign, with custom fonts and animation. What is the honest answer?
options:
  - "Yes — add it to checkout.liquid"
  - "Yes — a checkout UI extension can render arbitrary HTML and CSS"
  - "Partly — an extension can render a countdown using Shopify's components and branding-controlled styling, but arbitrary markup, custom animation and free-form CSS are not available"
  - "No — nothing can be added to checkout"
answer: 2
explanation: "Checkout UI extensions are real and can render a countdown at a defined target, but they use Shopify's component set and inherit branding rather than accepting arbitrary HTML, CSS or animation. Being precise about that boundary early prevents a design being approved that cannot be built."
```

## Choosing the right mechanism

| Requirement | Mechanism |
|---|---|
| Capture a delivery date or site instructions | Checkout UI extension writing a cart attribute |
| Show a trade-account notice to B2B buyers | Checkout UI extension, conditional on purchasing company |
| Block checkout when a rule is broken | UI extension `useBuyerJourneyIntercept`, or a validation Function |
| Hide a delivery option | Delivery customization Function |
| Hide a payment method for some customers | Payment customization Function |
| Apply a discount | Discount Function or an automatic discount |
| Fire a conversion pixel | Web Pixels API |
| Change checkout colours and fonts | Branding API |
| One-click upsell after payment | Post-purchase extension |
| Add content to the thank-you page | Thank-you extension target |

:::hint{type=tip}
**Validation is available in two places and they are not equivalent.** A UI extension's `useBuyerJourneyIntercept` is a good customer experience — it blocks progress with a message next to the offending field — but it is client-side and only applies where the extension renders. A **cart and checkout validation Function** runs server-side and applies regardless of surface, including draft orders and API-created checkouts.

For anything with a commercial consequence — minimum order values, case quantities, restricted products — use the Function, and use the UI extension on top of it for the message. Belt and braces, with the belt being the one that actually holds.
:::

## Migrating off checkout.liquid

The pattern, which is worth having ready:

:::steps

1. **Inventory everything.** Every block in `checkout.liquid`, every line in Additional Scripts on both the checkout and the order status page. Screenshot the current checkout at every step.

2. **Classify each item** as: tracking (→ pixel), logic (→ Function), content or field (→ UI extension), styling (→ branding API), or *no longer needed*. The last category is usually larger than anyone expects.

3. **Get a product decision on the gaps.** Items with no equivalent need an owner and a decision, not an engineering workaround.

4. **Build in a draft checkout profile.** Preview without affecting live checkout.

5. **Reconcile the tracking in parallel.** As on Day 12: run old and new tracking together and compare, because attribution changes are unrecoverable after the fact.

6. **Publish the profile**, then verify with real test orders across every payment method, every shipping option, and — critically — a B2B order if the store has one.

7. **Watch conversion rate for a full business cycle.** Checkout changes are the one place where a small regression is a large number.

:::

:::hint{type=warning}
Test with **real orders**, not just previews. Checkout behaves differently for: logged-in versus guest, B2B versus DTC, local pickup versus delivery, multiple shipping addresses, gift cards, discount codes, and each payment method including Shop Pay and express wallets. The extension that renders perfectly in preview and breaks with Apple Pay is a genuine and common failure, because express checkout skips steps your extension assumed.
:::

## Exercise

You need a development store on a Plus plan for the full exercise. Where a surface is unavailable, read the API reference and write the plan instead — being able to reason accurately about a surface you cannot touch is itself a real skill in this role.

:::checklist{title="Day 18 checklist"}
- [ ] Generated a checkout UI extension and rendered it at a static target
- [ ] Wrote a cart attribute from the extension and confirmed it appears on the order in the admin
- [ ] Read the attribute back and rendered conditionally on it
- [ ] Implemented `useBuyerJourneyIntercept` to block progress with a field-targeted message
- [ ] Added a merchant-configurable setting via the extension TOML and read it with `useSettings`
- [ ] Moved every string into translations and previewed in a second locale
- [ ] Converted the extension to a dynamic target and placed it yourself in the checkout editor
- [ ] Applied checkout branding via the Admin API and confirmed the change
- [ ] Created a second checkout profile and previewed it without publishing
- [ ] Placed test orders covering: guest, logged-in, discount code, and an express wallet
- [ ] Documented in `docs/checkout.md` what is customised, by which mechanism, and who owns it
:::

### Stretch problems

1. Build the B2B checkout experience: a purchase-order number field, a trade-account banner, and no consumer promotions — conditional on the purchasing company being present. Chapter 5 will use this.
2. Write the migration plan for a hypothetical store with 200 lines of Additional Scripts covering four pixels, a trust-badge block and a delivery-date picker. Classify every item and identify the gaps.
3. Investigate post-purchase extensions and write a one-page assessment of whether a one-click upsell is worth building for our workwear store, including the risk to the order-confirmation experience.
4. Read the full list of checkout extension targets and write down three requirements you have heard before that are *not* possible. Being able to say "no, and here is why, and here is the nearest thing" quickly is worth more than most features you will build.

## Where this is going

Tomorrow: Shopify Flow. Automation that replaces a surprising amount of both custom code and manual work — and, in a solo-developer role, the highest-leverage tool on the platform for staying out of your own queue.
