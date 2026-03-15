/**
 * Google Merchant Center product feed generation.
 * Transforms Square catalog data into Google's required format.
 */

import type { CatalogObject, InventoryCount } from "square";

const SHOP_DOMAIN = "mdgcshop.square.site";

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
  google_product_category?: string;
  product_type?: string;
}

/**
 * Square inventory data as stored in src/data/square-inventory.json
 */
export interface SquareInventoryData {
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
  discType?: string;
  minPrice: number;
  currency: string;
  totalQuantity: number;
}

/**
 * Convert all-caps name to title case.
 * e.g., "RURU" -> "Ruru"
 * e.g., "Innova Destroyer" -> "Innova Destroyer" (unchanged)
 */
export function formatName(name: string): string {
  // If the name is all caps, convert to title case
  if (name === name.toUpperCase() && name.length > 1) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}

/**
 * Convert all-caps brand name to proper casing.
 * Short words (≤3 chars) are kept as-is, since they're likely acronyms.
 * e.g., "INNOVA" -> "Innova"
 * e.g., "LATITUDE 64" -> "Latitude 64"
 * e.g., "AXIOM DISCS" -> "Axiom Discs"
 * e.g., "RPM" -> "RPM"
 * e.g., "MVP" -> "MVP"
 */
export function formatBrand(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          if (part.length <= 3) return part;
          return part.charAt(0) + part.slice(1).toLowerCase();
        })
        .join("-"),
    )
    .join(" ");
}

/**
 * Map Square's disc type category name to a search-friendly label.
 * e.g., "PUTT AND APPROACH" -> "Putter"
 */
export function discTypeLabel(categoryName: string): string | undefined {
  switch (categoryName) {
    case "PUTT AND APPROACH":
      return "Disc Golf Putter";
    case "MID-RANGE":
      return "Midrange Golf Disc";
    case "DRIVERS":
      return "Disc Golf Driver";
    default:
      return undefined;
  }
}

/**
 * Convert a name to a URL-safe slug.
 * e.g., "RURU" -> "ruru"
 * e.g., "Innova Destroyer" -> "innova-destroyer"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

  // Find parent category IDs for BRANDS and DISC TYPES
  let brandsCategoryId: string | undefined;
  let discTypesCategoryId: string | undefined;
  for (const [id, name] of categories) {
    if (name === "BRANDS") brandsCategoryId = id;
    if (name === "DISC TYPES") discTypesCategoryId = id;
  }

  // Brand category IDs (categories whose parent is BRANDS)
  const brandCategoryIds = new Set<string>();
  // Disc type category IDs (categories whose parent is DISC TYPES)
  const discTypeCategoryIds = new Set<string>();
  for (const [id, parentId] of categoryParents) {
    if (brandsCategoryId && parentId === brandsCategoryId) {
      brandCategoryIds.add(id);
    }
    if (discTypesCategoryId && parentId === discTypesCategoryId) {
      discTypeCategoryIds.add(id);
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

  return { images, categories, brandCategoryIds, discTypeCategoryIds, inventory };
}

/**
 * Aggregate catalog items (combining variants into single items).
 */
export function aggregateItems(data: SquareInventoryData): AggregatedItem[] {
  const { images, categories, brandCategoryIds, discTypeCategoryIds, inventory } =
    buildLookups(data);
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
        const rawBrand = categories.get(cat.id);
        brand = rawBrand ? formatBrand(rawBrand) : undefined;
        break;
      }
    }

    // Get disc type from item's categories (find one that's a child of DISC TYPES)
    let discType: string | undefined;
    for (const cat of itemCategories) {
      if (cat.id && discTypeCategoryIds.has(cat.id)) {
        const rawType = categories.get(cat.id);
        discType = rawType ? discTypeLabel(rawType) : undefined;
        break;
      }
    }

    // Construct product URL if item is visible on the online store
    // URL format: https://{domain}/product/{slug}/{item-id}
    // Requires: ecom_visibility not UNAVAILABLE and has channels
    const hasChannels = (itemData.channels?.length ?? 0) > 0;
    // ecom_visibility exists in the raw JSON but is missing from the SDK types
    const ecomVisibility = (itemData as Record<string, unknown>)
      .ecom_visibility as string | undefined;
    const isVisible = ecomVisibility !== "UNAVAILABLE";
    const slug = slugify(itemData.name ?? "");
    const productUrl =
      hasChannels && isVisible && slug
        ? `https://${SHOP_DOMAIN}/product/${slug}/${obj.id}`
        : undefined;

    // Aggregate price and quantity across all variations
    let minPrice = Infinity;
    let currency = "AUD";
    let totalQuantity = 0;

    for (const variation of variations) {
      if (variation.type !== "ITEM_VARIATION" || !variation.id) continue;

      const varData = variation.itemVariationData;
      if (!varData) continue;
      const quantity = inventory.get(variation.id) ?? 0;
      const price = varData.priceMoney?.amount
        ? Number(varData.priceMoney.amount)
        : 0;

      totalQuantity += quantity;
      // Only consider in-stock variations for minimum price
      if (quantity > 0 && price > 0 && price < minPrice) {
        minPrice = price;
        currency = varData.priceMoney?.currency ?? "AUD";
      }
    }

    // Skip items without valid prices
    if (minPrice === Infinity) continue;

    itemMap.set(obj.id, {
      itemId: obj.id,
      name: formatName(itemData.name ?? ""),
      description: itemData.description ?? "",
      productUrl,
      imageUrl,
      category,
      brand,
      discType,
      minPrice,
      currency,
      totalQuantity,
    });
  }

  return Array.from(itemMap.values());
}

/**
 * Map Square category to Google product category.
 * See: https://support.google.com/merchants/answer/6324436
 */
function getGoogleProductCategory(category?: string): string {
  if (category === "DISCS") {
    return "Sporting Goods > Outdoor Recreation > Disc Golf > Disc Golf Discs";
  }
  return "Sporting Goods > Outdoor Recreation > Disc Golf";
}

/**
 * Convert an aggregated item to Google's format.
 */
export function toGoogleProduct(item: AggregatedItem): GoogleProduct {
  // Format price as "29.00 AUD"
  const priceValue = (item.minPrice / 100).toFixed(2);
  const price = `${priceValue} ${item.currency}`;

  // Build title: prefix brand, suffix disc type
  // e.g. "Pekapeka" -> "RPM Pekapeka Midrange Disc"
  let title = item.name;
  if (item.brand && !title.startsWith(item.brand)) {
    title = `${item.brand} ${title}`;
  }
  if (item.discType) {
    title = `${title} - ${item.discType}`;
  }

  return {
    id: item.itemId,
    title,
    description: item.description || item.name,
    link: item.productUrl || "",
    image_link: item.imageUrl || "",
    availability: item.totalQuantity > 0 ? "in_stock" : "out_of_stock",
    price,
    condition: "new",
    brand: item.brand,
    google_product_category: getGoogleProductCategory(item.category),
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
  "google_product_category",
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
export function generateTsvFeed(data: SquareInventoryData): string {
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

    const googleProduct = toGoogleProduct(item);
    const values = FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
