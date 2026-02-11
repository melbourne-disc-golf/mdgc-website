import type { APIRoute } from "astro";
import inventoryData from "@data/square-inventory.json";
import { generateTsvFeed, type FeedConfig } from "@lib/google-feed";
import type { InventoryData } from "../../../scripts/square/types.js";

// Type assertion for the imported JSON
const inventory = inventoryData as InventoryData;

// Configure the feed
// TODO: Move to site config or environment variable
const STORE_URL = "https://mdgc-shop.square.site";
const DEFAULT_BRAND = "MDGC";

export const GET: APIRoute = async () => {
  const config: FeedConfig = {
    storeUrl: STORE_URL,
    defaultBrand: DEFAULT_BRAND,
  };

  const tsvContent = generateTsvFeed(inventory.products, config);

  return new Response(tsvContent, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": 'inline; filename="google-products.tsv"',
    },
  });
};
