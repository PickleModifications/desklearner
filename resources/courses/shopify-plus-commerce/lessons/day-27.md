---
title: Building POS UI Extensions
summary: Custom functionality on the till — smart grid tiles, modals, cart and product detail blocks, and post-purchase actions — built with the POS UI Extensions API, reading your own metafields and writing back to the order.
minutes: 130
objectives:
  - Scaffold and deploy a POS UI extension with the Shopify CLI
  - Build a smart grid tile that opens a modal, using the POS-specific component set
  - Read store data — metafields, metaobjects, company context — from within an extension
  - Write structured data back to the cart and the order from the till
  - Design extensions for associates working fast, standing up, on a small screen
keyTerms:
  - term: POS UI extension
    definition: A custom interface rendered inside the Shopify POS app, built with Shopify's POS UI Extensions API and deployed as an app extension.
  - term: Extension target
    definition: The place an extension renders — the smart grid tile and its modal, a block on the cart, a block on product details, or an action after a completed sale.
  - term: Cart API
    definition: The POS extension API for reading and modifying the current cart — adding line items, applying discounts, setting attributes, attaching a customer.
  - term: Session API
    definition: The extension API exposing the current context — location, staff member, currency, and a token for authenticated calls to your own backend.
  - term: Post-purchase action
    definition: An extension rendered after a sale completes, used for follow-up workflows such as warranty registration or printing a workshop docket.
  - term: Line item property
    definition: Structured data attached to a cart line — the same mechanism as the online store, and how POS captures a fitting note or a customisation.
resources:
  - label: POS UI extensions
    url: https://shopify.dev/docs/api/pos-ui-extensions
  - label: POS UI extension targets
    url: https://shopify.dev/docs/api/pos-ui-extensions/targets
  - label: POS UI components
    url: https://shopify.dev/docs/api/pos-ui-extensions/components
  - label: App extensions overview
    url: https://shopify.dev/docs/apps/build/app-extensions
---

The till is where the business meets the customer in person, and it is the surface most likely to have a workflow no software vendor anticipated. A workwear brand fitting boots has one: the associate measures a foot, recommends a size and a width, notes what the customer does for a living, and that information is worth capturing.

POS UI extensions are how that gets built. They are the least-known surface in this course and, for a role owning a growing retail footprint, one of the most valuable.

## Where extensions can appear

| Target | Renders | Typical use |
|---|---|---|
| Smart grid tile | A tile on the POS home screen | Entry point to a custom workflow |
| Smart grid modal | A full-screen view from a tile | The workflow itself |
| Cart block | Inline in the cart | Show or capture something about this sale |
| Product details block | On a product's detail view | Fit guides, specs, stock at other locations |
| Customer details block | On a customer's profile | Trade account status, loyalty, service history |
| Post-purchase action | After a sale completes | Warranty registration, docket printing, follow-up |

Exact target names and the component set evolve; scaffold with the CLI and read the generated code rather than copying a target string.

## Scaffolding

```bash
shopify app generate extension --template pos_ui --name fitting-assistant
```

```toml title="shopify.extension.toml"
api_version = "2025-10"

[[extensions]]
name = "Fitting assistant"
handle = "fitting-assistant"
type = "ui_extension"

  [[extensions.targeting]]
  target = "pos.home.tile.render"
  module = "./src/Tile.jsx"

  [[extensions.targeting]]
  target = "pos.home.modal.render"
  module = "./src/Modal.jsx"

  [[extensions.targeting]]
  target = "pos.purchase.post.action.render"
  module = "./src/PostPurchase.jsx"
```

## The tile

```jsx title="src/Tile.jsx"
import React from 'react'
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {
  const api = useApi()
  const lineCount = api.cart.subscribable.initial.lineItems.length

  return (
    <Tile
      title="Fitting assistant"
      subtitle={lineCount > 0 ? `${lineCount} items in cart` : 'Start a boot fitting'}
      enabled
      onPress={() => api.action.presentModal()}
    />
  )
}

export default reactExtension('pos.home.tile.render', () => <TileComponent />)
```

Tiles are deliberately minimal — a title, a subtitle, an enabled state and a press handler. The subtitle is the only place to convey state, so use it: "3 items in cart", "2 pickups waiting", "Trade customer attached". An associate glancing at a grid of tiles between customers gets information without tapping.

## The modal

```jsx title="src/Modal.jsx"
import React, { useState, useEffect } from 'react'
import {
  Screen,
  ScrollView,
  Navigator,
  Section,
  Text,
  TextField,
  Button,
  Stack,
  List,
  Banner,
  reactExtension,
  useApi
} from '@shopify/ui-extensions-react/point-of-sale'

const Modal = () => {
  const api = useApi()
  const [size, setSize] = useState('')
  const [width, setWidth] = useState('')
  const [trade, setTrade] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [error, setError] = useState(null)

  const locationId = api.session.currentSession.locationId
  const staffId = api.session.currentSession.staffMemberId

  useEffect(() => {
    if (!size) return
    let cancelled = false

    async function load() {
      try {
        // Authenticated call to your own app backend, which holds the
        // Admin API token. The extension never holds a token itself.
        const token = await api.session.getSessionToken()
        const response = await fetch(
          `https://app.example.com/pos/recommendations?size=${size}&width=${width}&location=${locationId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!response.ok) throw new Error('lookup failed')
        const data = await response.json()
        if (!cancelled) setRecommendations(data.items)
      } catch (e) {
        if (!cancelled) setError('Could not load recommendations. Search the catalogue instead.')
      }
    }

    load()
    return () => { cancelled = true }
  }, [size, width, locationId])

  const addToCart = async (item) => {
    await api.cart.addLineItem(item.variantId, 1)

    // Structured data that flows to the order, the ERP and reporting.
    await api.cart.addLineItemProperties(item.variantId, {
      Fitted_size: size,
      Fitted_width: width,
      _trade: trade,
      _fitted_by: String(staffId)
    })

    api.action.dismissModal()
  }

  return (
    <Navigator>
      <Screen name="Fitting" title="Boot fitting">
        <ScrollView>
          {error && <Banner title={error} variant="alert" visible />}

          <Section title="Measurements">
            <Stack direction="horizontal" spacing={2}>
              <TextField label="Size (UK)" value={size} onChange={setSize} />
              <TextField label="Width" value={width} onChange={setWidth} />
            </Stack>
            <TextField label="Trade" value={trade} onChange={setTrade} placeholder="Electrician, roofer…" />
          </Section>

          <Section title="Recommended">
            <List
              data={recommendations.map((item) => ({
                id: item.variantId,
                title: item.title,
                subtitle: [`${item.sku}`, `${item.stockHere} in store`],
                onPress: () => addToCart(item)
              }))}
            />
          </Section>
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)
```

Four things in there that generalise to any POS extension:

1. **Session context is free and essential.** `locationId` and `staffMemberId` come from the session. Everything location-aware — stock at this store, this store's opening hours, this store's grid — derives from that rather than from anything hard-coded. This is the mechanism that makes the extension work identically at store one and store eight.
2. **Your backend holds the token, not the extension.** `getSessionToken()` produces a token your app verifies, and your app calls the Admin API. Same principle as the app proxy on Day 13.
3. **Line item properties carry the structured data.** `Fitted_size` is visible on the order; `_trade` and `_fitted_by`, with the underscore prefix, are hidden from the customer's receipt but available to the admin, to Flow and to your ERP. The same mechanism as the online store, at the till.
4. **The error path degrades to something usable.** "Search the catalogue instead" — not a spinner that never resolves. An associate with a customer in front of them cannot wait, and an extension that blocks the sale is worse than no extension.

## Reading your own data

The metaobjects from Day 5 come into their own here. A fit guide, a certification, a store's own opening hours — all available to an associate who is asked a question they cannot answer from memory.

```jsx title="src/ProductDetails.jsx — specs at the till"
const ProductBlock = () => {
  const api = useApi()
  const [specs, setSpecs] = useState(null)
  const productId = api.product?.subscribable?.initial?.id

  useEffect(() => {
    if (!productId) return
    api.session.getSessionToken()
      .then((token) =>
        fetch(`https://app.example.com/pos/product-specs?id=${productId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      )
      .then((r) => r.json())
      .then(setSpecs)
      .catch(() => setSpecs({ error: true }))
  }, [productId])

  if (!specs) return <Text>Loading specs…</Text>
  if (specs.error) return <Text>Specs unavailable</Text>

  return (
    <Section title="Specifications">
      <List
        data={specs.rows.map((row, i) => ({
          id: String(i),
          title: row.label,
          subtitle: [row.value]
        }))}
      />
      {specs.certifications?.length > 0 && (
        <Text>Certifications: {specs.certifications.join(', ')}</Text>
      )}
    </Section>
  )
}
```

That is a small piece of code that removes a real friction: the customer asks whether the boot is rated for electrical hazard, and the associate can answer in five seconds instead of finding a manager.

## Post-purchase actions

```jsx title="src/PostPurchase.jsx"
const PostPurchase = () => {
  const api = useApi()
  const order = api.order

  const registerWarranty = async () => {
    const token = await api.session.getSessionToken()
    await fetch('https://app.example.com/pos/warranty', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, locationId: api.session.currentSession.locationId })
    })
    api.action.dismiss()
  }

  return (
    <Screen name="PostPurchase" title="After the sale">
      <Section title="Warranty">
        <Text>Register this purchase for the 12-month workwear warranty.</Text>
        <Button title="Register warranty" onPress={registerWarranty} />
      </Section>
    </Screen>
  )
}
```

Post-purchase is the right home for anything that should not delay the transaction. The customer has paid; the queue is moving. Warranty registration, a follow-up task, a docket for the workshop — all of it belongs here rather than in the cart flow.

```quiz
question: A POS extension needs to look up a customer's trade account credit limit, which lives in a company metafield. How should it get it?
options:
  - "Query the Admin API directly from the extension using an access token stored in the extension"
  - "Call your app's backend with a session token; the backend verifies it and queries the Admin API"
  - "Read the metafield from the POS cart API"
  - "Sync the value into a product metafield so the extension can read it locally"
answer: 1
explanation: "An extension must never hold an Admin API token — it runs on a device in a shop. `getSessionToken()` produces a short-lived token your backend verifies, and the backend makes the privileged call. This is the same trust boundary as an app proxy on the storefront."
```

## Designing for the till

POS UX is not web UX, and getting this wrong makes an otherwise correct extension unusable.

:::cards

:::card{title="Speed over completeness"}
There is a customer waiting and possibly a queue. Three taps maximum for the common path. If the workflow needs eight fields, ask whether five of them can be captured afterwards or inferred.
:::

:::card{title="Large targets, one-handed"}
The associate may be holding a boot, a scanner or a customer's card. Touch targets should be generous, and the primary action reachable with a thumb.
:::

:::card{title="Never block the sale"}
Every extension must fail to a state where the associate can still complete the transaction. A network failure, a slow backend, a bad response — all of them end with "carry on with the sale", not a spinner.
:::

:::card{title="Legible standing up, at arm's length"}
Small screen, variable lighting, a shop floor. Default sizes, high contrast, no dense tables. Use Shopify's components as given rather than compressing them.
:::

:::card{title="Offline is a real state"}
Shop connectivity is unreliable, particularly in retail parks and basements. Know what your extension does with no network, and make sure that state is honest rather than silent.
:::

:::

:::hint{type=warning}
**Test on a real device, standing up, with someone playing the customer.** An extension that is obviously fine on a desktop simulator can be unusable on a tablet in a shop — text too small, the keyboard covering the field, a button below the fold, a workflow that assumes both hands are free.

Better still, test with an actual associate. Retail staff will tell you within thirty seconds what is wrong, in terms you can act on. This is the single highest-value piece of feedback available for POS work, and it costs a trip to a store.
:::

## Deploying and versioning

```bash
shopify app dev      # develop against a development store, live on the device
shopify app deploy   # create and release an app version
```

Extensions ship as **app versions**, which has two consequences worth planning for:

- **Deployment is atomic across every device and location.** Deploying updates every store at once. There is no per-store rollout, so the pre-release testing needs to be right — this is more like a mobile app release than a theme push.
- **Devices need to pick up the new version.** In practice this means the app updating; it is not instantaneous across a fleet. For a change that alters an associate's workflow, coordinate with retail operations rather than surprising them mid-shift.

Which produces the release rule for POS: **never deploy a workflow-changing extension during trading hours without telling the stores.** An associate discovering a changed till workflow with a queue in front of them is a bad experience that turns into distrust of everything you ship afterwards.

## Exercise

The POS app on a phone or tablet against your development store is enough for all of this.

:::checklist{title="Day 27 checklist"}
- [ ] Generated a POS UI extension and deployed it to your development store
- [ ] Built a smart grid tile whose subtitle reflects real cart state
- [ ] Built a modal with at least two screens using `Navigator`
- [ ] Read `locationId` and `staffMemberId` from the session and used both
- [ ] Added a line item to the cart from the extension
- [ ] Attached line item properties, including one underscore-prefixed internal value
- [ ] Completed a sale and confirmed the properties appear on the order in the admin
- [ ] Built a product details block surfacing metaobject-backed specs
- [ ] Called your own backend with a session token and verified it server-side
- [ ] Built a post-purchase action that fires a follow-up without delaying the sale
- [ ] Confirmed the extension degrades usefully with the network disabled
- [ ] Tested on a physical device, standing, with someone acting as the customer
- [ ] Confirmed nothing in the extension hard-codes a location ID
:::

### Stretch problems

1. Build a "stock at other locations" block for the product details target — the endless aisle question associates ask constantly — including the option to sell from another location.
2. Build a trade account lookup: attach a customer, detect that they are a company contact, and display their tier, assigned rep and credit status. This joins Chapters 5 and 6 and is a genuinely differentiated piece of work.
3. Implement offline behaviour deliberately: detect no connectivity, show an honest state, queue the follow-up action, and reconcile when connectivity returns. Then test it by turning the network off mid-workflow.
4. Watch an associate use your extension without instructions. Write down every hesitation. Fix the top three. Repeat.

## Where this is going

Tomorrow: making all of this replicate. Architecting POS so opening store six is a runbook and a data-entry task rather than a project — configuration as code, location metafields, and the operational practices that hold across a growing network.
