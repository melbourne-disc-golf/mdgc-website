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
  material?: string;
  product_weight?: string;
  product_detail?: string;
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
 * A single variation, extracted from Square catalog data.
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
  plastic?: string;
  color?: string;
  weight?: string;
  productDetails?: string[];
  price: number;
  currency: string;
  quantity: number;
}

/**
 * Split a Square variation name into its PLASTIC/COLOR/WEIGHT parts.
 * Handles optional item name prefix: "RURU - ATOMIC/PINK/171" -> ["ATOMIC", "PINK", "171"]
 * Returns undefined if the name doesn't follow this format.
 */
export function parseVariationParts(
  name: string,
): { plastic: string; color: string; weight: string } | undefined {
  const stripped = name.includes(" - ") ? name.split(" - ").pop()! : name;
  const parts = stripped.split("/");
  if (parts.length !== 3) return undefined;

  const plastic = parts[0].trim();
  const color = parts[1].trim();
  const weight = parts[2].trim();
  if (!plastic || !color || !weight) return undefined;

  return { plastic, color, weight };
}

/**
 * Parse a Square variation name to extract color.
 * Variation names typically follow "PLASTIC/COLOR/WEIGHT" or
 * "ITEM_NAME - PLASTIC/COLOR/WEIGHT".
 * e.g., "COSMIC/YELLOW/177" -> "Yellow"
 * e.g., "RURU - ATOMIC/PINK/171" -> "Pink"
 */
export function parseVariationColor(name: string): string | undefined {
  const parsed = parseVariationParts(name);
  if (!parsed) return undefined;
  return normalizeColor(titleCase(parsed.color));
}

/**
 * Parse a Square variation name to extract the plastic type.
 * e.g., "COSMIC/YELLOW/177" -> "Cosmic"
 * e.g., "KOTARE - ATOMIC/BURNT ORANGE/173" -> "Atomic"
 */
export function parseVariationPlastic(name: string): string | undefined {
  const parsed = parseVariationParts(name);
  if (!parsed) return undefined;
  return titleCaseKeepAcronyms(parsed.plastic);
}

/**
 * Parse a Square variation name to extract the weight in grams.
 * Returns the weight formatted for Google's product_weight attribute.
 * Weights may be single values ("177") or ranges ("166-9").
 * For ranges, we use the lower bound.
 * e.g., "COSMIC/YELLOW/177" -> "177 g"
 * e.g., "ATOMIC/PINK/166-9" -> "166 g"
 * e.g., "COSMIC/BLUE/177+" -> "177 g"
 */
export function parseVariationWeight(name: string): string | undefined {
  const parsed = parseVariationParts(name);
  if (!parsed) return undefined;

  // Strip trailing "+" (means "or heavier")
  const raw = parsed.weight.replace(/\+$/, "");
  // Take the first number (handles ranges like "166-9")
  const match = raw.match(/^(\d+)/);
  if (!match) return undefined;

  return `${match[1]} g`;
}

/**
 * Normalize a raw color string from Square variation names into
 * a Google-friendly color. Returns undefined if the value isn't
 * a recognisable color.
 */
export function normalizeColor(raw: string): string | undefined {
  let color = raw;

  // Strip modifiers that aren't color-relevant
  color = color.replace(/\s+(swirl|burst|orbit|halo|marble|rim)$/i, "");

  // Strip "trans" (translucent) prefix
  color = color.replace(/^Trans(parent|lucent)?\s+/i, "");

  // Expand then strip shade modifiers — keep the base color
  color = color.replace(/^Lt /i, "Light ");
  color = color.replace(/^Dk /i, "Dark ");
  color = color.replace(/^(Light|Dark|Pale|Fluro|Fluorescent)\s+/i, "");

  // Capitalise first letter (may have been lowered by prefix stripping)
  color = color.charAt(0).toUpperCase() + color.slice(1);

  // Convert hyphenated color pairs to Google's slash format
  // e.g. "Lime-purple" -> "Lime/Purple"
  color = color
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("/");

  // Reject values that don't look like colors
  if (/\d/.test(color)) return undefined;
  if (color.split(/[\s\/]/).length > 3) return undefined;
  if (color.length > 40) return undefined;

  return color;
}

/**
 * Convert all-caps name to title case.
 * e.g., "RURU" -> "Ruru"
 * e.g., "Innova Destroyer" -> "Innova Destroyer" (unchanged)
 */
export function titleCase(name: string): string {
  // If the name is all caps, convert to title case
  if (name === name.toUpperCase() && name.length > 1) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}

/**
 * Build a display title from brand, item name and variation name.
 *
 * Handles two quirks of Square naming:
 * - Item names may include a variant suffix, e.g. "TAKAPU - GLOW" → strip " - GLOW"
 * - Variation names may include the disc name prefix, e.g. "KOTARE - ATOMIC/BURNT ORANGE/173" → strip "KOTARE - "
 *
 * e.g., "RPM" + "KOTARE" + "KOTARE - ATOMIC/BURNT ORANGE/173"
 *    -> "RPM Kotare - Atomic/Burnt Orange/173"
 * e.g., undefined + "RURU" + "ATOMIC/PINK/171"
 *    -> "Ruru - Atomic/Pink/171"
 */
export function formatVariationTitle(
  itemName: string,
  varName: string,
  brand?: string,
): string {
  // Strip variant suffix from item name (e.g. "TAKAPU - GLOW" -> "TAKAPU")
  const cleanItemName = itemName.includes(" - ")
    ? itemName.split(" - ")[0].trim()
    : itemName;

  // Strip item name prefix from variation name
  const detail = varName.includes(" - ") ? varName.split(" - ").pop()!.trim() : varName;

  const formatWords = (s: string) =>
    s.split(" ").map((w) => titleCase(w)).join(" ");
  const detailParts = detail.split("/");
  const formattedDetail = detailParts
    .map((seg, i) => (i === 0 ? titleCaseKeepAcronyms(seg) : formatWords(seg)))
    .join("/");

  const formattedItem = titleCaseKeepAcronyms(cleanItemName, 2);
  const needsBrand = brand && !formattedItem.toUpperCase().startsWith(brand.toUpperCase());
  const prefix = needsBrand ? `${brand} ${formattedItem}` : formattedItem;
  return `${prefix} - ${formattedDetail}`;
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
export function titleCaseKeepAcronyms(
  name: string,
  maxAcronymLength = 3,
): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          if (part.length <= maxAcronymLength) return part;
          const alpha = part.replace(/[^a-zA-Z]/g, "");
          if (/\d/.test(part) && alpha.length <= maxAcronymLength) return part;
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
      return "Putter";
    case "MID-RANGE":
      return "Midrange";
    case "DRIVERS":
      return "Driver";
    default:
      return undefined;
  }
}

/**
 * Flight rating numbers for a disc golf disc.
 */
export interface FlightNumbers {
  speed: string;
  glide: string;
  turn: string;
  fade: string;
}

/**
 * Extract flight numbers (Speed/Glide/Turn/Fade) from a product description.
 * Returns the parsed numbers and a cleaned description with the verbose
 * flight rating lines replaced by a compact summary, e.g. "(7/5/-1/2)".
 *
 * Input formats handled:
 *   "Speed: 7.0\nGlide: 4.0\nTurn: -1.5\nFade: 2.0"
 *   "SPEED: 6\nGLIDE: 6\nTURN: -3\nFADE: 0"
 */
export function extractFlightRatings(
  description: string,
): { flight: FlightNumbers; description: string } | undefined {
  const pattern =
    /\s*speed\s*:?\s*(-?\d[\d.]*)\s*glide\s*:?\s*(-?\d[\d.]*)\s*turn\s*:?\s*(-?\d[\d.]*)\s*fade\s*:?\s*(-?\d[\d.]*)/i;
  const m = description.match(pattern);
  if (!m) return undefined;

  const strip = (v: string) => v.replace(/\.0$/, "");
  const flight: FlightNumbers = {
    speed: strip(m[1]),
    glide: strip(m[2]),
    turn: strip(m[3]),
    fade: strip(m[4]),
  };

  const compact = `(${flight.speed} / ${flight.glide} / ${flight.turn} / ${flight.fade})`;
  const cleaned = description.replace(pattern, ` ${compact}`).trim();

  return { flight, description: cleaned };
}

/**
 * Build product_detail entries from flight ratings.
 * Uses Google's TSV product_detail format: "section_name:attribute_name:attribute_value".
 */
export function flightProductDetails(flight: FlightNumbers): string[] {
  return [
    `Disc:Speed:${flight.speed}`,
    `Disc:Glide:${flight.glide}`,
    `Disc:Turn:${flight.turn}`,
    `Disc:Fade:${flight.fade}`,
  ];
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
 * Extract catalog items into one row per variation.
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
        brand = rawBrand ? titleCaseKeepAcronyms(rawBrand) : undefined;
        break;
      }
    }

    let discType: string | undefined;
    for (const cat of itemCategories) {
      if (cat.id && discTypeCategoryIds.has(cat.id)) {
        const rawType = categories.get(cat.id);
        const label = rawType ? discTypeLabel(rawType) : undefined;
        if (label) {
          discType = label;
          break;
        }
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

    const rawDescription = itemData.description ?? "";
    const extracted = extractFlightRatings(rawDescription);

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

      const varName = varData.name;
      const plastic = varName ? parseVariationPlastic(varName) : undefined;
      const color = varName ? parseVariationColor(varName) : undefined;
      const weight = varName ? parseVariationWeight(varName) : undefined;

      const productDetails: string[] = [];
      if (discType) {
        productDetails.push(`Disc:Type:${discType}`);
      }
      if (extracted) {
        productDetails.push(...flightProductDetails(extracted.flight));
      }
      if (plastic) {
        productDetails.push(`Disc:Plastic:${plastic}`);
      }
      const description = extracted?.description ?? rawDescription;

      results.push({
        variationId: variation.id,
        itemId: obj.id,
        name: varName
          ? formatVariationTitle(itemData.name ?? "", varName, brand)
          : titleCase(itemData.name ?? ""),
        description,
        productUrl,
        imageUrl: varImageUrl ?? itemImageUrl,
        category,
        brand,
        discType,
        plastic,
        productDetails: productDetails.length > 0 ? productDetails : undefined,
        color,
        weight,
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

  return {
    id: item.variationId,
    title: item.name,
    description: item.description || item.name,
    link: item.productUrl || "",
    image_link: item.imageUrl || "",
    availability: item.quantity > 0 ? "in_stock" : "out_of_stock",
    price,
    condition: "new",
    brand: item.brand,
    item_group_id: item.itemId,
    color: item.color,
    material: item.category === "DISCS" ? "Plastic" : undefined,
    product_weight: item.weight,
    product_detail: item.productDetails?.join(","),
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
  "item_group_id",
  "color",
  "material",
  "product_weight",
  "product_detail",
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
  lines.push(FEED_COLUMNS.join("\t"));

  const variations = expandVariations(data);

  for (const item of variations) {
    if (!item.productUrl) continue;
    if (!item.imageUrl) continue;
    if (item.quantity <= 0) continue;

    const googleProduct = variationToGoogleProduct(item);
    const values = FEED_COLUMNS.map((col) =>
      escapeTsvValue(googleProduct[col]?.toString())
    );
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
