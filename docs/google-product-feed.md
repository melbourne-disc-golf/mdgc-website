# Google product feed from Square inventory

This document explains how we generate a Google Merchant Center product feed from Square catalog and inventory data.

## Background

The MDGC Pro Shop uses Square for point-of-sale and online sales (via Square Online at `mdgcshop.square.site`). To advertise products on Google Shopping, we need to provide a product feed in Google's required format.

## Challenges

### 1. Square data structure

Square's catalog has a hierarchical structure that doesn't map directly to Google's flat product format:

- **Items** contain multiple **variations** (e.g., different colours/weights of the same disc)
- **Inventory counts** are tracked per variation, per location
- **Images** and **categories** are separate catalog objects linked by ID
- **Prices** are stored as integers in cents (e.g., 2200 = $22.00)

Google expects one row per product with a single price, not multiple variations.

### 2. Product URL construction

Square's `ecomUri` field (which previously held the product URL) is deprecated and missing from many items. We needed to construct URLs ourselves.

After research (including finding a Slack thread from Square developer relations), we determined the URL format is:

```
https://{domain}/product/{slug}/{item-id}
```

Where:
- `{domain}` is the Square Online site domain (e.g., `mdgcshop.square.site`)
- `{slug}` is a URL-safe version of the product name (can be any value, including `-`)
- `{item-id}` is the Square catalog item ID

### 3. Determining online availability

Not all catalog items are available on the online store. We need to check:

- `itemData.channels` - must have at least one channel (indicates online store presence)
- `itemData.ecomVisibility` - must not be `UNAVAILABLE`
- `itemData.productType` - must be `REGULAR` (excludes events, memberships, services)

### 4. Brand extraction

Google requires a brand for each product. Square doesn't have a dedicated brand field, but MDGC uses a category hierarchy where brands are child categories of a "BRANDS" parent category.

We traverse the category tree to find which of an item's categories has "BRANDS" as its parent.

### 5. Price selection

With multiple variations at different prices, we need to choose which price to show. Google doesn't support price ranges.

We show the **minimum price from in-stock variations only**. This ensures we don't advertise a low price that's actually unavailable.

## Solution

### Data flow

```
Square API  →  square-inventory.json  →  git push  →  site build  →  google-products.tsv  →  Google Merchant Center
```

1. **GitHub Action** runs `scripts/fetch-square-inventory.ts` daily, pulling catalog and inventory from Square API
2. **Data file** (`src/data/square-inventory.json`) is committed and pushed to the repo
3. The push triggers a **Cloudflare Pages build**, which runs `src/lib/google-feed.ts` to transform the data
4. **TSV feed** is published at `/feeds/google-products.tsv` on the live site
5. **Google Merchant Center** fetches the TSV on a schedule via [Scheduled Fetch](https://support.google.com/merchants/answer/14991445?hl=en)

### Key functions

| Function | Purpose |
|----------|---------|
| `aggregateItems()` | Combines variations into single items, extracts brand, calculates min price |
| `toGoogleProduct()` | Converts aggregated item to Google's required fields |
| `generateTsvFeed()` | Produces the final TSV with header row |
| `slugify()` | Converts product names to URL-safe slugs |
| `formatName()` | Converts ALL-CAPS names to Title Case |

### Filtering

Items are excluded from the feed if they:

- Have `productType` other than `REGULAR`
- Have no channels (not on online store)
- Have `ecomVisibility` of `UNAVAILABLE`
- Have no images
- Have no valid price
- Are out of stock (total quantity = 0)

### Configuration

The shop domain is hardcoded in `google-feed.ts`:

```typescript
const SHOP_DOMAIN = "mdgcshop.square.site";
```

The default brand (used when no brand category is found) is configured when calling `generateTsvFeed()`:

```typescript
const config: FeedConfig = {
  defaultBrand: "MDGC",
};
```

## Usage

### Updating inventory data

Inventory data is synced automatically by the **Sync Square Inventory** GitHub Action, which runs daily at 4am Melbourne time. It can also be triggered manually from the Actions tab.

To run the fetch script locally:

```bash
SQUARE_ACCESS_TOKEN=<token> pnpm tsx scripts/fetch-square-inventory.ts
```

This fetches fresh data from Square and writes to `src/data/square-inventory.json`.

### Building the feed

The feed is generated automatically during site build:

```bash
pnpm build
```

Output: `dist/feeds/google-products.tsv`

### Testing

```bash
pnpm test
```

Tests cover aggregation logic, price calculation, URL construction, and TSV generation.
