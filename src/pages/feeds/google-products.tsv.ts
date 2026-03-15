import type { APIRoute } from "astro";
import inventoryData from "@data/square-inventory.json";
import { generateTsvFeed, type SquareInventoryData } from "@lib/google-feed";

// Type assertion for the imported JSON
const data = inventoryData as unknown as SquareInventoryData;

export const GET: APIRoute = async () => {
  const tsvContent = generateTsvFeed(data);

  return new Response(tsvContent, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": 'inline; filename="google-products.tsv"',
    },
  });
};
