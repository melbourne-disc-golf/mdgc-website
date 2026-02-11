#!/usr/bin/env tsx

/**
 * Fetch product catalog and inventory from Square API using the official SDK.
 * Writes raw Square data to src/data/square-inventory.json
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
  SquareClient,
  SquareEnvironment,
  type CatalogObject,
  type InventoryCount,
} from "square";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "square-inventory.json");

function getClient(): SquareClient {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(
      "Error: SQUARE_ACCESS_TOKEN environment variable is required"
    );
    process.exit(1);
  }

  const environment =
    process.env.SQUARE_ENVIRONMENT === "sandbox"
      ? SquareEnvironment.Sandbox
      : SquareEnvironment.Production;

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

async function fetchCatalog(client: SquareClient): Promise<CatalogObject[]> {
  const objects: CatalogObject[] = [];

  // The SDK's list method returns a paginated iterator
  const pages = await client.catalog.list({
    types: "ITEM,IMAGE,CATEGORY",
  });

  for await (const obj of pages) {
    objects.push(obj);
  }

  return objects;
}

async function fetchInventoryCounts(
  client: SquareClient,
  catalogObjectIds: string[]
): Promise<InventoryCount[]> {
  if (catalogObjectIds.length === 0) {
    return [];
  }

  const counts: InventoryCount[] = [];

  // Batch in groups of 100 (API limit)
  const BATCH_SIZE = 100;
  for (let i = 0; i < catalogObjectIds.length; i += BATCH_SIZE) {
    const batch = catalogObjectIds.slice(i, i + BATCH_SIZE);

    const pages = await client.inventory.batchGetCounts({
      catalogObjectIds: batch,
    });

    for await (const count of pages) {
      counts.push(count);
    }
  }

  return counts;
}

function extractVariationIds(objects: CatalogObject[]): string[] {
  const ids: string[] = [];
  for (const obj of objects) {
    if (obj.type === "ITEM" && obj.itemData?.variations) {
      for (const variation of obj.itemData.variations) {
        if (variation.id) {
          ids.push(variation.id);
        }
      }
    }
  }
  return ids;
}

async function main() {
  const client = getClient();
  const env =
    process.env.SQUARE_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

  console.log(`Fetching catalog from Square (${env})...`);

  const catalogObjects = await fetchCatalog(client);
  console.log(`  Fetched ${catalogObjects.length} catalog objects`);

  // Count by type
  const items = catalogObjects.filter((o) => o.type === "ITEM");
  const images = catalogObjects.filter((o) => o.type === "IMAGE");
  const categories = catalogObjects.filter((o) => o.type === "CATEGORY");

  console.log(`  - ${items.length} items`);
  console.log(`  - ${images.length} images`);
  console.log(`  - ${categories.length} categories`);

  // Fetch inventory counts for all variations
  const variationIds = extractVariationIds(catalogObjects);
  console.log(`\nFetching inventory for ${variationIds.length} variations...`);

  const inventoryCounts = await fetchInventoryCounts(client, variationIds);
  console.log(`  Fetched ${inventoryCounts.length} inventory counts`);

  // Write output in native Square format
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const output = {
    fetchedAt: new Date().toISOString(),
    catalogObjects,
    inventoryCounts,
  };

  // BigInt values need a custom replacer for JSON serialization
  const replacer = (_key: string, value: unknown) =>
    typeof value === "bigint" ? Number(value) : value;

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, replacer, 2));
  console.log(`\nWrote ${OUTPUT_FILE}`);

  // Summary stats
  const variationsWithStock = new Set(
    inventoryCounts
      .filter((c) => parseFloat(c.quantity ?? "0") > 0)
      .map((c) => c.catalogObjectId)
  );
  console.log(`\nSummary:`);
  console.log(`  Items: ${items.length}`);
  console.log(`  Variations: ${variationIds.length}`);
  console.log(`  Variations with stock: ${variationsWithStock.size}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
