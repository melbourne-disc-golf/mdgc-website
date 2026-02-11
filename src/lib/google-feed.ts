/**
 * Google Merchant Center product feed generation.
 * Transforms Square catalog data into Google's required format.
 */

import type { CatalogObject, InventoryCount } from "square";

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
  defaultBrand?: string;
}

/**
 * Square inventory data as stored in src/data/square-inventory.json
 */
export interface SquareInventoryData {
  fetchedAt: string;
  catalogObjects: CatalogObject[];
  inventoryCounts: InventoryCount[];
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
  brand?: string;
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
 * Build lookup maps from Square data.
 */
function buildLookups(data: SquareInventoryData) {
  // Image ID -> URL
  const images = new Map<string, string>();
  for (const obj of data.catalogObjects) {
    if (obj.type === "IMAGE" && obj.id && obj.imageData?.url) {
      images.set(obj.id, obj.imageData.url);
    }
  }

  // Category ID -> name
  const categories = new Map<string, string>();
  // Category ID -> parent ID
  const categoryParents = new Map<string, string | undefined>();
  for (const obj of data.catalogObjects) {
    if (obj.type === "CATEGORY" && obj.id && obj.categoryData?.name) {
      categories.set(obj.id, obj.categoryData.name);
      categoryParents.set(obj.id, obj.categoryData.parentCategory?.id);
    }
  }

  // Find the "BRANDS" parent category ID
  let brandsCategoryId: string | undefined;
  for (const [id, name] of categories) {
    if (name === "BRANDS") {
      brandsCategoryId = id;
      break;
    }
  }

  // Brand category IDs (categories whose parent is BRANDS)
  const brandCategoryIds = new Set<string>();
  if (brandsCategoryId) {
    for (const [id, parentId] of categoryParents) {
      if (parentId === brandsCategoryId) {
        brandCategoryIds.add(id);
      }
    }
  }

  // Variation ID -> total quantity (summed across locations)
  const inventory = new Map<string, number>();
  for (const count of data.inventoryCounts) {
    if (count.catalogObjectId) {
      const existing = inventory.get(count.catalogObjectId) ?? 0;
      const qty = parseFloat(count.quantity ?? "0") || 0;
      inventory.set(count.catalogObjectId, existing + qty);
    }
  }

  return { images, categories, brandCategoryIds, inventory };
}

/**
 * Aggregate catalog items (combining variants into single items).
 */
export function aggregateItems(data: SquareInventoryData): AggregatedItem[] {
  const { images, categories, brandCategoryIds, inventory } = buildLookups(data);
  const itemMap = new Map<string, AggregatedItem>();

  for (const obj of data.catalogObjects) {
    if (obj.type !== "ITEM" || !obj.id || !obj.itemData) continue;
    if (obj.isDeleted || obj.itemData.isArchived) continue;
    // Only include regular products (not events, memberships, etc.)
    if (obj.itemData.productType !== "REGULAR") continue;

    const itemData = obj.itemData;
    const variations = itemData.variations ?? [];
    if (variations.length === 0) continue;

    // Get image URL (first image)
    const imageIds = itemData.imageIds ?? [];
    const imageUrl = imageIds.length > 0 ? images.get(imageIds[0]) : undefined;

    // Get category name (from reportingCategory or first category)
    const category = itemData.reportingCategory?.id
      ? categories.get(itemData.reportingCategory.id)
      : undefined;

    // Get brand from item's categories (find one that's a child of BRANDS)
    let brand: string | undefined;
    const itemCategories = itemData.categories ?? [];
    for (const cat of itemCategories) {
      if (cat.id && brandCategoryIds.has(cat.id)) {
        brand = categories.get(cat.id);
        break;
      }
    }

    // Get product URL from ecom_uri
    const productUrl = itemData.ecomUri;

    // Process each variation and aggregate
    for (const variation of variations) {
      if (!variation.id || !variation.itemVariationData) continue;

      const varData = variation.itemVariationData;
      const quantity = inventory.get(variation.id) ?? 0;
      const price = varData.priceMoney?.amount
        ? Number(varData.priceMoney.amount)
        : 0;
      const currency = varData.priceMoney?.currency ?? "AUD";

      const existing = itemMap.get(obj.id);

      if (existing) {
        existing.totalQuantity += quantity;
        if (price > 0 && price < existing.minPrice) {
          existing.minPrice = price;
          existing.currency = currency;
        }
        if (!existing.productUrl && productUrl) {
          existing.productUrl = productUrl;
        }
        if (!existing.imageUrl && imageUrl) {
          existing.imageUrl = imageUrl;
        }
      } else {
        // Build name from first variation
        const fullName = varData.name
          ? `${itemData.name} - ${varData.name}`
          : itemData.name ?? "";

        itemMap.set(obj.id, {
          itemId: obj.id,
          name: extractBaseName(fullName),
          description: itemData.description ?? "",
          productUrl,
          imageUrl,
          category,
          brand,
          minPrice: price || Infinity,
          currency,
          totalQuantity: quantity,
        });
      }
    }
  }

  // Filter out items with Infinity price (no valid prices found)
  return Array.from(itemMap.values()).filter((item) => item.minPrice < Infinity);
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
    brand: item.brand ?? config.defaultBrand,
    mpn: undefined,
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
 */
function escapeTsvValue(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/[\t\n\r]/g, " ");
}

/**
 * Generate TSV feed content from Square inventory data.
 */
export function generateTsvFeed(
  data: SquareInventoryData,
  config: FeedConfig
): string {
  const lines: string[] = [];

  // Header row
  lines.push(FEED_COLUMNS.join("\t"));

  // Aggregate variants into items
  const items = aggregateItems(data);

  // Data rows
  for (const item of items) {
    // Skip items without a product URL (can't link to them)
    if (!item.productUrl) continue;

    // Skip items without images (Google requires images)
    if (!item.imageUrl) continue;

    // Skip items without prices
    if (!item.minPrice || item.minPrice === Infinity) continue;

    // Skip out-of-stock items
    if (item.totalQuantity <= 0) continue;

    const googleProduct = toGoogleProduct(item, config);
    const values = FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
