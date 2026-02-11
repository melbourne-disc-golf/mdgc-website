/**
 * Transform Square catalog data to our intermediate product format.
 */

import type {
  SquareCatalogItem,
  SquareImage,
  SquareInventoryCount,
  Product,
} from "./types.js";

export interface TransformContext {
  images: Map<string, string>; // image_id -> url
  inventory: Map<string, number>; // variation_id -> quantity
  categories: Map<string, string>; // category_id -> name
  defaultCurrency: string;
}

/**
 * Extract products from a Square catalog item.
 * Each item variation becomes a separate product.
 */
export function extractProducts(
  item: SquareCatalogItem,
  ctx: TransformContext
): Product[] {
  const itemData = item.item_data;

  // Skip archived or deleted items
  if (item.is_deleted || itemData.is_archived) {
    return [];
  }

  const variations = itemData.variations || [];
  if (variations.length === 0) {
    return [];
  }

  // Get the first image URL for this item
  const imageIds = itemData.image_ids || [];
  const imageUrl =
    imageIds.length > 0 ? ctx.images.get(imageIds[0]) : undefined;

  // Get category name
  const category = itemData.category_id
    ? ctx.categories.get(itemData.category_id)
    : undefined;

  return variations.map((variation) => {
    const varData = variation.item_variation_data;
    const quantity = ctx.inventory.get(variation.id) ?? 0;

    // Build product name: "Item Name" or "Item Name - Variation" if variation has distinct name
    const variationName = varData.name;
    const name =
      variationName &&
      variationName !== "Regular" &&
      variationName !== itemData.name
        ? `${itemData.name} - ${variationName}`
        : itemData.name;

    return {
      id: variation.id,
      itemId: item.id,
      name,
      description: itemData.description || "",
      sku: varData.sku,
      price: varData.price_money?.amount ?? 0,
      currency: varData.price_money?.currency ?? ctx.defaultCurrency,
      imageUrl,
      category,
      quantity,
      productUrl: itemData.ecom_uri,
      permalink: itemData.ecom_seo_data?.permalink,
    };
  });
}

/**
 * Build a lookup map from image ID to URL.
 */
export function buildImageMap(images: SquareImage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const img of images) {
    map.set(img.id, img.image_data.url);
  }
  return map;
}

/**
 * Build a lookup map from variation ID to total quantity.
 * Sums quantities across all locations.
 */
export function buildInventoryMap(
  counts: SquareInventoryCount[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const count of counts) {
    const existing = map.get(count.catalog_object_id) ?? 0;
    const qty = parseFloat(count.quantity) || 0;
    map.set(count.catalog_object_id, existing + qty);
  }
  return map;
}
