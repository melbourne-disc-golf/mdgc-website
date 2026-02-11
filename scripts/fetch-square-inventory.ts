#!/usr/bin/env tsx

/**
 * Fetch product catalog and inventory from Square API.
 * Writes normalized product data to src/data/square-inventory.json
 *
 * Requires SQUARE_ACCESS_TOKEN environment variable.
 *
 * Usage:
 *   pnpm tsx scripts/fetch-square-inventory.ts
 *   SQUARE_ENVIRONMENT=sandbox pnpm tsx scripts/fetch-square-inventory.ts
 */

import fs from "node:fs";
import path from "node:path";

import {
  listCatalog,
  getInventoryCounts,
  filterItems,
  filterImages,
  filterCategories,
  extractVariationIds,
  type SquareApiConfig,
} from "./square/api.js";
import {
  extractProducts,
  buildImageMap,
  buildInventoryMap,
  type TransformContext,
} from "./square/transform.js";
import type { InventoryData, Product } from "./square/types.js";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "square-inventory.json");
const DEFAULT_CURRENCY = "AUD";

function getConfig(): SquareApiConfig {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("Error: SQUARE_ACCESS_TOKEN environment variable is required");
    process.exit(1);
  }

  const environment =
    process.env.SQUARE_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

  return { accessToken, environment };
}

async function main() {
  const config = getConfig();

  console.log(`Fetching catalog from Square (${config.environment})...`);

  // Fetch all catalog objects (items, images, categories)
  const catalogObjects = await listCatalog(config, ["ITEM", "IMAGE", "CATEGORY"]);
  console.log(`  Fetched ${catalogObjects.length} catalog objects`);

  // Separate by type
  const items = filterItems(catalogObjects);
  const images = filterImages(catalogObjects);
  const categories = filterCategories(catalogObjects);

  console.log(`  - ${items.length} items`);
  console.log(`  - ${images.length} images`);
  console.log(`  - ${categories.length} categories`);

  // Build lookup maps
  const imageMap = buildImageMap(images);
  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.category_data.name);
  }

  // Fetch inventory counts for all variations
  const variationIds = extractVariationIds(items);
  console.log(`\nFetching inventory for ${variationIds.length} variations...`);

  const inventoryCounts = await getInventoryCounts(config, variationIds);
  console.log(`  Fetched ${inventoryCounts.length} inventory counts`);

  const inventoryMap = buildInventoryMap(inventoryCounts);

  // Transform to our product format
  console.log("\nTransforming data...");

  const ctx: TransformContext = {
    images: imageMap,
    inventory: inventoryMap,
    categories: categoryMap,
    defaultCurrency: DEFAULT_CURRENCY,
  };

  const products: Product[] = [];
  for (const item of items) {
    const extracted = extractProducts(item, ctx);
    products.push(...extracted);
  }

  console.log(`  Extracted ${products.length} products`);

  // Write output
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const output: InventoryData = {
    fetchedAt: new Date().toISOString(),
    products,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_FILE}`);

  // Summary stats
  const inStock = products.filter((p) => p.quantity > 0).length;
  const outOfStock = products.length - inStock;
  console.log(`\nSummary:`);
  console.log(`  In stock: ${inStock}`);
  console.log(`  Out of stock: ${outOfStock}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
