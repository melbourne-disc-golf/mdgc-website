import { describe, it, expect } from "vitest";
import {
  extractProducts,
  buildImageMap,
  buildInventoryMap,
  type TransformContext,
} from "./transform.js";
import type { SquareCatalogItem, SquareImage, SquareInventoryCount } from "./types.js";

describe("buildImageMap", () => {
  it("creates a map from image id to url", () => {
    const images: SquareImage[] = [
      {
        type: "IMAGE",
        id: "img-1",
        image_data: { url: "https://example.com/image1.jpg" },
      },
      {
        type: "IMAGE",
        id: "img-2",
        image_data: { url: "https://example.com/image2.jpg" },
      },
    ];

    const map = buildImageMap(images);

    expect(map.get("img-1")).toBe("https://example.com/image1.jpg");
    expect(map.get("img-2")).toBe("https://example.com/image2.jpg");
    expect(map.size).toBe(2);
  });

  it("handles empty array", () => {
    const map = buildImageMap([]);
    expect(map.size).toBe(0);
  });
});

describe("buildInventoryMap", () => {
  it("creates a map from variation id to quantity", () => {
    const counts: SquareInventoryCount[] = [
      {
        catalog_object_id: "var-1",
        catalog_object_type: "ITEM_VARIATION",
        state: "IN_STOCK",
        location_id: "loc-1",
        quantity: "5",
        calculated_at: "2024-01-01T00:00:00Z",
      },
      {
        catalog_object_id: "var-2",
        catalog_object_type: "ITEM_VARIATION",
        state: "IN_STOCK",
        location_id: "loc-1",
        quantity: "10",
        calculated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const map = buildInventoryMap(counts);

    expect(map.get("var-1")).toBe(5);
    expect(map.get("var-2")).toBe(10);
  });

  it("sums quantities across multiple locations", () => {
    const counts: SquareInventoryCount[] = [
      {
        catalog_object_id: "var-1",
        catalog_object_type: "ITEM_VARIATION",
        state: "IN_STOCK",
        location_id: "loc-1",
        quantity: "5",
        calculated_at: "2024-01-01T00:00:00Z",
      },
      {
        catalog_object_id: "var-1",
        catalog_object_type: "ITEM_VARIATION",
        state: "IN_STOCK",
        location_id: "loc-2",
        quantity: "3",
        calculated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const map = buildInventoryMap(counts);

    expect(map.get("var-1")).toBe(8);
  });

  it("handles decimal quantities", () => {
    const counts: SquareInventoryCount[] = [
      {
        catalog_object_id: "var-1",
        catalog_object_type: "ITEM_VARIATION",
        state: "IN_STOCK",
        location_id: "loc-1",
        quantity: "2.5",
        calculated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const map = buildInventoryMap(counts);

    expect(map.get("var-1")).toBe(2.5);
  });
});

describe("extractProducts", () => {
  const baseContext: TransformContext = {
    images: new Map([["img-1", "https://example.com/disc.jpg"]]),
    inventory: new Map([["var-1", 5]]),
    categories: new Map([["cat-1", "Discs"]]),
    defaultCurrency: "AUD",
  };

  const baseItem: SquareCatalogItem = {
    type: "ITEM",
    id: "item-1",
    updated_at: "2024-01-01T00:00:00Z",
    item_data: {
      name: "Innova Destroyer",
      description: "A high-speed distance driver",
      category_id: "cat-1",
      image_ids: ["img-1"],
      variations: [
        {
          type: "ITEM_VARIATION",
          id: "var-1",
          item_variation_data: {
            item_id: "item-1",
            name: "Regular",
            sku: "DEST-001",
            pricing_type: "FIXED_PRICING",
            price_money: { amount: 2995, currency: "AUD" },
          },
        },
      ],
    },
  };

  it("extracts product from a simple item", () => {
    const products = extractProducts(baseItem, baseContext);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "var-1",
      itemId: "item-1",
      name: "Innova Destroyer",
      description: "A high-speed distance driver",
      sku: "DEST-001",
      price: 2995,
      currency: "AUD",
      imageUrl: "https://example.com/disc.jpg",
      category: "Discs",
      quantity: 5,
    });
  });

  it("includes variation name when distinct from item name", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      item_data: {
        ...baseItem.item_data,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: "var-1",
            item_variation_data: {
              item_id: "item-1",
              name: "170g Blue",
              pricing_type: "FIXED_PRICING",
              price_money: { amount: 2995, currency: "AUD" },
            },
          },
        ],
      },
    };

    const products = extractProducts(item, baseContext);

    expect(products[0].name).toBe("Innova Destroyer - 170g Blue");
  });

  it("handles multiple variations", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      item_data: {
        ...baseItem.item_data,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: "var-1",
            item_variation_data: {
              item_id: "item-1",
              name: "165g",
              pricing_type: "FIXED_PRICING",
              price_money: { amount: 2995, currency: "AUD" },
            },
          },
          {
            type: "ITEM_VARIATION",
            id: "var-2",
            item_variation_data: {
              item_id: "item-1",
              name: "170g",
              pricing_type: "FIXED_PRICING",
              price_money: { amount: 2995, currency: "AUD" },
            },
          },
        ],
      },
    };

    const ctx: TransformContext = {
      ...baseContext,
      inventory: new Map([
        ["var-1", 3],
        ["var-2", 0],
      ]),
    };

    const products = extractProducts(item, ctx);

    expect(products).toHaveLength(2);
    expect(products[0].name).toBe("Innova Destroyer - 165g");
    expect(products[0].quantity).toBe(3);
    expect(products[1].name).toBe("Innova Destroyer - 170g");
    expect(products[1].quantity).toBe(0);
  });

  it("skips archived items", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      item_data: {
        ...baseItem.item_data,
        is_archived: true,
      },
    };

    const products = extractProducts(item, baseContext);

    expect(products).toHaveLength(0);
  });

  it("skips deleted items", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      is_deleted: true,
    };

    const products = extractProducts(item, baseContext);

    expect(products).toHaveLength(0);
  });

  it("handles items without images", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      item_data: {
        ...baseItem.item_data,
        image_ids: undefined,
      },
    };

    const products = extractProducts(item, baseContext);

    expect(products[0].imageUrl).toBeUndefined();
  });

  it("defaults quantity to 0 when not in inventory", () => {
    const ctx: TransformContext = {
      ...baseContext,
      inventory: new Map(), // empty inventory
    };

    const products = extractProducts(baseItem, ctx);

    expect(products[0].quantity).toBe(0);
  });

  it("uses default currency when price_money is missing", () => {
    const item: SquareCatalogItem = {
      ...baseItem,
      item_data: {
        ...baseItem.item_data,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: "var-1",
            item_variation_data: {
              item_id: "item-1",
              name: "Regular",
              pricing_type: "VARIABLE_PRICING",
              // no price_money
            },
          },
        ],
      },
    };

    const products = extractProducts(item, baseContext);

    expect(products[0].price).toBe(0);
    expect(products[0].currency).toBe("AUD");
  });
});
