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
  item_group_id?: string;
  color?: string;
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
 * A single variation, expanded from an aggregated item.
 */
export interface VariationItem {
  variationId: string;
  itemId: string;
  name: string;
  description: string;
  productUrl?: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  discType?: string;
  color?: string;
  price: number;
  currency: string;
  quantity: number;
}

/**
 * Parse a Square variation name to extract color.
 * Variation names typically follow "PLASTIC/COLOR/WEIGHT" or
 * "ITEM_NAME - PLASTIC/COLOR/WEIGHT".
 * e.g., "COSMIC/YELLOW/177" -> "Yellow"
 * e.g., "RURU - ATOMIC/PINK/171" -> "Pink"
 */
export function parseVariationColor(name: string): string | undefined {
  // Strip item name prefix (e.g. "RURU - ATOMIC/PINK/171" -> "ATOMIC/PINK/171")
  const stripped = name.includes(" - ") ? name.split(" - ").pop()! : name;
  const parts = stripped.split("/");
  if (parts.length !== 3) return undefined;

  const rawColor = parts[1].trim();
  if (!rawColor) return undefined;
  return normalizeColor(formatName(rawColor));
}

/**
 * Standard color names that Google will recognise.
 */
const KNOWN_COLORS = new Set([
  "amber",
  "aqua",
  "black",
  "blue",
  "bronze",
  "brown",
  "charcoal",
  "cream",
  "gold",
  "grape",
  "green",
  "grey",
  "indigo",
  "lilac",
  "lime",
  "orange",
  "peach",
  "pearl",
  "pink",
  "purple",
  "red",
  "rose",
  "sand",
  "sunset",
  "teal",
  "turquoise",
  "white",
  "yellow",
]);

/**
 * Normalize a raw color string from Square variation names into
 * a Google-friendly color. Returns undefined if the value isn't
 * a recognisable color.
 */
export function normalizeColor(raw: string): string | undefined {
  let color = raw;

  // Expand abbreviations
  color = color.replace(/^Lt /i, "Light ");
  color = color.replace(/^Dk /i, "Dark ");
  color = color.replace(/^Fluro /i, "Fluorescent ");

  // Strip modifiers that aren't color-relevant
  color = color.replace(/\s+(swirl|burst|orbit|halo|marble|rim)$/i, "");

  // Strip "trans" (translucent) prefix — not a color
  color = color.replace(/^Trans(parent|lucent)?\s+/i, "");

  // Strip shade modifiers — keep the base color
  color = color.replace(/^(Light|Dark|Pale|Fluorescent)\s+/i, "");

  // Capitalise first letter (may have been lowered by prefix stripping)
  color = color.charAt(0).toUpperCase() + color.slice(1);

  // Convert hyphenated color pairs to Google's slash format
  // e.g. "Lime-purple" -> "Lime/Purple"
  if (color.includes("-")) {
    const parts = color.split("-");
    if (parts.every((p) => KNOWN_COLORS.has(p.toLowerCase()))) {
      color = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("/");
    }
  }

  // Check the base color is recognisable
  const baseColor = color.split(/[\s\-\/]/)[0].toLowerCase();
  if (!KNOWN_COLORS.has(baseColor)) return undefined;

  return color;
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
 * Expand catalog items into one row per variation.
 */
export function expandVariations(data: SquareInventoryData): VariationItem[] {
  const { images, categories, brandCategoryIds, discTypeCategoryIds, inventory } =
    buildLookups(data);
  const results: VariationItem[] = [];

  for (const obj of data.catalogObjects) {
    if (obj.type !== "ITEM" || !obj.id || !obj.itemData) continue;
    if (obj.isDeleted || obj.itemData.isArchived) continue;
    if (obj.itemData.productType !== "REGULAR") continue;

    const itemData = obj.itemData;
    const variations = itemData.variations ?? [];
    if (variations.length === 0) continue;

    // Item-level image (fallback for variations without their own)
    const itemImageIds = itemData.imageIds ?? [];
    const itemImageUrl =
      itemImageIds.length > 0 ? images.get(itemImageIds[0]) : undefined;

    const category = itemData.reportingCategory?.id
      ? categories.get(itemData.reportingCategory.id)
      : undefined;

    let brand: string | undefined;
    const itemCategories = itemData.categories ?? [];
    for (const cat of itemCategories) {
      if (cat.id && brandCategoryIds.has(cat.id)) {
        const rawBrand = categories.get(cat.id);
        brand = rawBrand ? formatBrand(rawBrand) : undefined;
        break;
      }
    }

    let discType: string | undefined;
    for (const cat of itemCategories) {
      if (cat.id && discTypeCategoryIds.has(cat.id)) {
        const rawType = categories.get(cat.id);
        discType = rawType ? discTypeLabel(rawType) : undefined;
        break;
      }
    }

    const hasChannels = (itemData.channels?.length ?? 0) > 0;
    const ecomVisibility = (itemData as Record<string, unknown>)
      .ecom_visibility as string | undefined;
    const isVisible = ecomVisibility !== "UNAVAILABLE";
    const slug = slugify(itemData.name ?? "");
    const productUrl =
      hasChannels && isVisible && slug
        ? `https://${SHOP_DOMAIN}/product/${slug}/${obj.id}`
        : undefined;

    for (const variation of variations) {
      if (variation.type !== "ITEM_VARIATION" || !variation.id) continue;
      const varData = variation.itemVariationData;
      if (!varData) continue;

      const price = varData.priceMoney?.amount
        ? Number(varData.priceMoney.amount)
        : 0;
      if (price <= 0) continue;

      const quantity = inventory.get(variation.id) ?? 0;

      // Per-variation image, falling back to item-level image
      const varImageIds = (varData as Record<string, unknown>)
        .imageIds as string[] | undefined;
      const varImageUrl =
        varImageIds && varImageIds.length > 0
          ? images.get(varImageIds[0])
          : undefined;

      const color = varData.name
        ? parseVariationColor(varData.name)
        : undefined;

      results.push({
        variationId: variation.id,
        itemId: obj.id,
        name: formatName(itemData.name ?? ""),
        description: itemData.description ?? "",
        productUrl,
        imageUrl: varImageUrl ?? itemImageUrl,
        category,
        brand,
        discType,
        color,
        price,
        currency: varData.priceMoney?.currency ?? "AUD",
        quantity,
      });
    }
  }

  return results;
}

/**
 * Convert a variation item to Google's format.
 */
export function variationToGoogleProduct(item: VariationItem): GoogleProduct {
  const priceValue = (item.price / 100).toFixed(2);
  const price = `${priceValue} ${item.currency}`;

  let title = item.name;
  if (item.brand && !title.startsWith(item.brand)) {
    title = `${item.brand} ${title}`;
  }
  if (item.discType) {
    title = `${title} - ${item.discType}`;
  }

  return {
    id: item.variationId,
    title,
    description: item.description || item.name,
    link: item.productUrl || "",
    image_link: item.imageUrl || "",
    availability: item.quantity > 0 ? "in_stock" : "out_of_stock",
    price,
    condition: "new",
    brand: item.brand,
    item_group_id: item.itemId,
    color: item.color,
    google_product_category: getGoogleProductCategory(item.category),
    product_type: item.category,
  };
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

const VARIATION_FEED_COLUMNS: (keyof GoogleProduct)[] = [
  ...FEED_COLUMNS,
  "item_group_id",
  "color",
];

/**
 * Escape a value for TSV format.
 */
function escapeTsvValue(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/[\t\n\r]/g, " ");
}

export interface FeedOptions {
  perVariation?: boolean;
}

/**
 * Generate TSV feed content from Square inventory data.
 */
export function generateTsvFeed(
  data: SquareInventoryData,
  options?: FeedOptions
): string {
  if (options?.perVariation) {
    return generateVariationFeed(data);
  }
  return generateAggregatedFeed(data);
}

function generateAggregatedFeed(data: SquareInventoryData): string {
  const lines: string[] = [];
  lines.push(FEED_COLUMNS.join("\t"));

  const items = aggregateItems(data);

  for (const item of items) {
    if (!item.productUrl) continue;
    if (!item.imageUrl) continue;
    if (!item.minPrice || item.minPrice === Infinity) continue;
    if (item.totalQuantity <= 0) continue;

    const googleProduct = toGoogleProduct(item);
    const values = FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}

function generateVariationFeed(data: SquareInventoryData): string {
  const lines: string[] = [];
  lines.push(VARIATION_FEED_COLUMNS.join("\t"));

  const variations = expandVariations(data);

  for (const item of variations) {
    if (!item.productUrl) continue;
    if (!item.imageUrl) continue;
    if (item.quantity <= 0) continue;

    const googleProduct = variationToGoogleProduct(item);
    const values = VARIATION_FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
