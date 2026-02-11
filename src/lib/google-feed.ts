/**
 * Google Merchant Center product feed generation.
 * Transforms our inventory data into Google's required format.
 */

import type { Product } from "../../scripts/square/types.js";

export interface GoogleProduct {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  availability: "in_stock" | "out_of_stock" | "preorder";
  price: string;
  condition: "new" | "refurbished" | "used";
  brand?: string;
  gtin?: string;
  mpn?: string;
  product_type?: string;
}

export interface FeedConfig {
  storeUrl: string;
  defaultBrand?: string;
}

/**
 * An aggregated item (multiple variants combined into one).
 */
export interface AggregatedItem {
  itemId: string;
  name: string;
  description: string;
  productUrl?: string;
  imageUrl?: string;
  category?: string;
  minPrice: number;
  currency: string;
  totalQuantity: number;
}

/**
 * Extract the base item name, removing variation suffixes.
 * e.g., "RURU - RURU - ATOMIC/PINK/171" -> "Ruru"
 * e.g., "Innova Destroyer - 170g Blue" -> "Innova Destroyer"
 */
export function extractBaseName(variantName: string): string {
  // Split on " - " and take the first part
  const parts = variantName.split(" - ");
  let baseName = parts[0].trim();

  // If the name is all caps, convert to title case
  if (baseName === baseName.toUpperCase() && baseName.length > 1) {
    baseName = baseName.charAt(0) + baseName.slice(1).toLowerCase();
  }

  return baseName;
}

/**
 * Aggregate products by item (combining variants).
 */
export function aggregateByItem(products: Product[]): AggregatedItem[] {
  const itemMap = new Map<string, AggregatedItem>();

  for (const product of products) {
    const existing = itemMap.get(product.itemId);

    if (existing) {
      // Update aggregated values
      existing.totalQuantity += product.quantity;
      if (product.price < existing.minPrice && product.price > 0) {
        existing.minPrice = product.price;
        existing.currency = product.currency;
      }
      // Use productUrl if we don't have one yet
      if (!existing.productUrl && product.productUrl) {
        existing.productUrl = product.productUrl;
      }
      // Use imageUrl if we don't have one yet
      if (!existing.imageUrl && product.imageUrl) {
        existing.imageUrl = product.imageUrl;
      }
    } else {
      // Create new aggregated item
      itemMap.set(product.itemId, {
        itemId: product.itemId,
        name: extractBaseName(product.name),
        description: product.description,
        productUrl: product.productUrl,
        imageUrl: product.imageUrl,
        category: product.category,
        minPrice: product.price,
        currency: product.currency,
        totalQuantity: product.quantity,
      });
    }
  }

  return Array.from(itemMap.values());
}

/**
 * Convert an aggregated item to Google's format.
 */
export function toGoogleProduct(
  item: AggregatedItem,
  config: FeedConfig
): GoogleProduct {
  // Format price as "29.00 AUD"
  const priceValue = (item.minPrice / 100).toFixed(2);
  const price = `${priceValue} ${item.currency}`;

  return {
    id: item.itemId,
    title: item.name,
    description: item.description || item.name,
    link: item.productUrl || "",
    image_link: item.imageUrl || "",
    availability: item.totalQuantity > 0 ? "in_stock" : "out_of_stock",
    price,
    condition: "new",
    brand: config.defaultBrand,
    mpn: undefined, // SKU doesn't make sense at item level
    product_type: item.category,
  };
}

/**
 * Google feed column headers (order matters).
 */
const FEED_COLUMNS: (keyof GoogleProduct)[] = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "price",
  "condition",
  "brand",
  "mpn",
  "product_type",
];

/**
 * Escape a value for TSV format.
 * - Tabs and newlines are replaced with spaces
 * - No quoting needed for TSV (unlike CSV)
 */
function escapeTsvValue(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/[\t\n\r]/g, " ");
}

/**
 * Generate TSV feed content from products.
 * Aggregates by item (not variant) since we can't deep-link to variants.
 */
export function generateTsvFeed(
  products: Product[],
  config: FeedConfig
): string {
  const lines: string[] = [];

  // Header row
  lines.push(FEED_COLUMNS.join("\t"));

  // Aggregate variants into items
  const items = aggregateByItem(products);

  // Data rows
  for (const item of items) {
    // Skip items without a product URL (can't link to them)
    if (!item.productUrl) continue;

    // Skip items without images (Google requires images)
    if (!item.imageUrl) continue;

    // Skip items without prices
    if (!item.minPrice) continue;

    const googleProduct = toGoogleProduct(item, config);
    const values = FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
