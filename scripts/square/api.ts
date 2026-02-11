/**
 * Square API client for fetching catalog and inventory data.
 *
 * Requires SQUARE_ACCESS_TOKEN environment variable.
 * Uses Square's REST API directly (no SDK dependency).
 */

import type {
  SquareListCatalogResponse,
  SquareBatchRetrieveResponse,
  SquareInventoryCountsResponse,
  SquareCatalogObject,
  SquareCatalogItem,
  SquareImage,
  SquareCatalogCategory,
  SquareInventoryCount,
} from "./types.js";

const SQUARE_API_BASE = "https://connect.squareup.com/v2";

export interface SquareApiConfig {
  accessToken: string;
  environment?: "production" | "sandbox";
}

function getBaseUrl(environment: "production" | "sandbox" = "production"): string {
  return environment === "sandbox"
    ? "https://connect.squareupsandbox.com/v2"
    : SQUARE_API_BASE;
}

async function squareFetch<T>(
  config: SquareApiConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl(config.environment);
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Square API error (${response.status}): ${body}`);
  }

  return response.json();
}

/**
 * Fetch all catalog objects of specified types, handling pagination.
 */
export async function listCatalog(
  config: SquareApiConfig,
  types: string[] = ["ITEM", "IMAGE", "CATEGORY"]
): Promise<SquareCatalogObject[]> {
  const allObjects: SquareCatalogObject[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("types", types.join(","));
    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await squareFetch<SquareListCatalogResponse>(
      config,
      `/catalog/list?${params.toString()}`
    );

    if (response.objects) {
      allObjects.push(...response.objects);
    }

    cursor = response.cursor;
  } while (cursor);

  return allObjects;
}

/**
 * Batch retrieve catalog objects by ID.
 */
export async function batchRetrieveCatalogObjects(
  config: SquareApiConfig,
  objectIds: string[]
): Promise<SquareCatalogObject[]> {
  if (objectIds.length === 0) {
    return [];
  }

  // Square API limits batch requests to 1000 objects
  const BATCH_SIZE = 1000;
  const allObjects: SquareCatalogObject[] = [];

  for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
    const batch = objectIds.slice(i, i + BATCH_SIZE);

    const response = await squareFetch<SquareBatchRetrieveResponse>(
      config,
      "/catalog/batch-retrieve",
      {
        method: "POST",
        body: JSON.stringify({ object_ids: batch }),
      }
    );

    if (response.objects) {
      allObjects.push(...response.objects);
    }
  }

  return allObjects;
}

/**
 * Fetch inventory counts for specified catalog object IDs.
 */
export async function getInventoryCounts(
  config: SquareApiConfig,
  catalogObjectIds: string[]
): Promise<SquareInventoryCount[]> {
  if (catalogObjectIds.length === 0) {
    return [];
  }

  const allCounts: SquareInventoryCount[] = [];
  let cursor: string | undefined;

  // Square API limits to 100 object IDs per request
  const BATCH_SIZE = 100;

  for (let i = 0; i < catalogObjectIds.length; i += BATCH_SIZE) {
    const batch = catalogObjectIds.slice(i, i + BATCH_SIZE);
    cursor = undefined;

    do {
      const body: Record<string, unknown> = {
        catalog_object_ids: batch,
      };
      if (cursor) {
        body.cursor = cursor;
      }

      const response = await squareFetch<SquareInventoryCountsResponse>(
        config,
        "/inventory/counts/batch-retrieve",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      if (response.counts) {
        allCounts.push(...response.counts);
      }

      cursor = response.cursor;
    } while (cursor);
  }

  return allCounts;
}

/**
 * Helper to filter catalog objects by type.
 */
export function filterItems(objects: SquareCatalogObject[]): SquareCatalogItem[] {
  return objects.filter((obj): obj is SquareCatalogItem => obj.type === "ITEM");
}

export function filterImages(objects: SquareCatalogObject[]): SquareImage[] {
  return objects.filter((obj): obj is SquareImage => obj.type === "IMAGE");
}

export function filterCategories(objects: SquareCatalogObject[]): SquareCatalogCategory[] {
  return objects.filter((obj): obj is SquareCatalogCategory => obj.type === "CATEGORY");
}

/**
 * Extract all variation IDs from catalog items.
 */
export function extractVariationIds(items: SquareCatalogItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    const variations = item.item_data.variations || [];
    for (const variation of variations) {
      ids.push(variation.id);
    }
  }
  return ids;
}
