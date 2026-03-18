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

We expand each variation into its own row in the feed, using `item_group_id` to group variations of the same item.

### 2. Product URL construction

Square's `ecomUri` field (which previously held the product URL) is deprecated and missing from many items. We construct URLs ourselves.

After research (including finding a Slack thread from Square developer relations), we determined the URL format is:

```
https://{domain}/product/{slug}/{item-id}?variationId={variation-id}
```

Where:
- `{domain}` is the Square Online site domain (e.g., `mdgcshop.square.site`)
- `{slug}` is a URL-safe version of the product name (can be any value, including `-`)
- `{item-id}` is the Square catalog item ID
- `{variation-id}` is appended as a query parameter to make each variation's URL unique

Note: Square Online doesn't actually use the `variationId` parameter to pre-select a variation on the page. It's included so that Google treats each variation as a distinct product.

### 3. Determining online availability

Not all catalog items are available on the online store. We need to check:

- `itemData.channels` - must have at least one channel (indicates online store presence)
- `itemData.ecomVisibility` - must not be `UNAVAILABLE`
- `itemData.productType` - must be `REGULAR` (excludes events, memberships, services)

### 4. Brand extraction

Square doesn't have a dedicated brand field, but MDGC uses a category hierarchy where brands are child categories of a "BRANDS" parent category.

We traverse the category tree to find which of an item's categories has "BRANDS" as its parent. Items without a brand category are left with no brand in the feed.

### 5. Disc type extraction

Similar to brands, disc types (Putter, Midrange, Driver) are child categories of a "DISC TYPES" parent category. The disc type is included in the product title and as a `product_detail` attribute.

### 6. Variation name parsing

Square variation names follow the pattern `PLASTIC/COLOR/WEIGHT` (e.g., `ATOMIC/PINK/171`), sometimes prefixed with the item name (e.g., `KOTARE - ATOMIC/BURNT ORANGE/173`). We parse these to extract:

- **Plastic type** — included as a `product_detail` attribute
- **Color** — mapped to Google's `color` field, with normalization (stripping modifiers like "Trans", "Light", "Swirl")
- **Weight** — mapped to Google's `product_weight` field (e.g., `177 g`)

### 7. Flight ratings

Product descriptions may contain flight rating numbers (Speed/Glide/Turn/Fade). These are extracted and included as `product_detail` attributes, and the verbose lines in the description are replaced with a compact summary like `(7 / 5 / -1 / 2)`.

## Solution

### Data flow

```
Square API  →  square-inventory.json  →  git push  →  site build  →  google-products.tsv  →  Google Merchant Center
```

1. **GitHub Action** runs `scripts/fetch-square-inventory.ts` daily, pulling catalog and inventory from Square API
2. **Data file** (`src/data/square-inventory.json`) is committed and pushed to the repo
3. The push triggers a **Cloudflare Pages build**, which runs `src/lib/google-feed.ts` to transform the data
4. **TSV feed** is published at `/feeds/google-products.tsv` on the live site
5. **Google Merchant Center** fetches the TSV daily at 05:00 via [Scheduled Fetch](https://support.google.com/merchants/answer/14991445?hl=en)

### Key functions

| Function | Purpose |
|----------|---------|
| `expandVariations()` | Expands items into one row per variation, extracting brand, disc type, color, weight, etc. |
| `variationToGoogleProduct()` | Converts a variation item to Google's required fields |
| `generateTsvFeed()` | Produces the final TSV with header row, filtering out ineligible items |
| `formatVariationTitle()` | Builds display title from brand, item name, disc type, and variation details |
| `parseVariationParts()` | Splits variation name into plastic/color/weight components |
| `extractFlightRatings()` | Extracts Speed/Glide/Turn/Fade from product descriptions |
| `slugify()` | Converts product names to URL-safe slugs |
| `titleCaseKeepAcronyms()` | Converts ALL-CAPS names to title case, preserving short acronyms (e.g., RPM, MVP) |

### Feed filtering

`generateTsvFeed()` excludes variations that:

- Have no product URL (not on the online store, or item is deleted/archived)
- Have no image
- Are out of stock (quantity ≤ 0)

Earlier in `expandVariations()`, items are skipped if they:

- Are deleted or archived
- Have `productType` other than `REGULAR`
- Have no variations
- Have no price (or price ≤ 0)

### Configuration

The shop domain is hardcoded in `google-feed.ts`:

```typescript
const SHOP_DOMAIN = "mdgcshop.square.site";
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

Tests cover variation expansion, name parsing, color normalization, flight rating extraction, URL construction, and TSV generation.
