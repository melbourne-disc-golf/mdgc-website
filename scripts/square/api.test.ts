import { describe, it, expect } from "vitest";
import {
  filterItems,
  filterImages,
  filterCategories,
  extractVariationIds,
} from "./api.js";
import type {
  SquareCatalogObject,
  SquareCatalogItem,
  SquareImage,
  SquareCatalogCategory,
} from "./types.js";

describe("filterItems", () => {
  it("filters only ITEM type objects", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "ITEM",
        id: "item-1",
        updated_at: "2024-01-01",
        item_data: { name: "Disc" },
      } as SquareCatalogItem,
      {
        type: "IMAGE",
        id: "img-1",
        image_data: { url: "https://example.com/img.jpg" },
      } as SquareImage,
      {
        type: "CATEGORY",
        id: "cat-1",
        category_data: { name: "Discs" },
      } as SquareCatalogCategory,
    ];

    const items = filterItems(objects);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("item-1");
    expect(items[0].type).toBe("ITEM");
  });
});

describe("filterImages", () => {
  it("filters only IMAGE type objects", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "ITEM",
        id: "item-1",
        updated_at: "2024-01-01",
        item_data: { name: "Disc" },
      } as SquareCatalogItem,
      {
        type: "IMAGE",
        id: "img-1",
        image_data: { url: "https://example.com/img.jpg" },
      } as SquareImage,
    ];

    const images = filterImages(objects);

    expect(images).toHaveLength(1);
    expect(images[0].id).toBe("img-1");
    expect(images[0].type).toBe("IMAGE");
  });
});

describe("filterCategories", () => {
  it("filters only CATEGORY type objects", () => {
    const objects: SquareCatalogObject[] = [
      {
        type: "ITEM",
        id: "item-1",
        updated_at: "2024-01-01",
        item_data: { name: "Disc" },
      } as SquareCatalogItem,
      {
        type: "CATEGORY",
        id: "cat-1",
        category_data: { name: "Discs" },
      } as SquareCatalogCategory,
    ];

    const categories = filterCategories(objects);

    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe("cat-1");
    expect(categories[0].type).toBe("CATEGORY");
  });
});

describe("extractVariationIds", () => {
  it("extracts all variation IDs from items", () => {
    const items: SquareCatalogItem[] = [
      {
        type: "ITEM",
        id: "item-1",
        updated_at: "2024-01-01",
        item_data: {
          name: "Disc 1",
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "var-1",
              item_variation_data: {
                item_id: "item-1",
                name: "Regular",
                pricing_type: "FIXED_PRICING",
              },
            },
            {
              type: "ITEM_VARIATION",
              id: "var-2",
              item_variation_data: {
                item_id: "item-1",
                name: "Large",
                pricing_type: "FIXED_PRICING",
              },
            },
          ],
        },
      },
      {
        type: "ITEM",
        id: "item-2",
        updated_at: "2024-01-01",
        item_data: {
          name: "Disc 2",
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "var-3",
              item_variation_data: {
                item_id: "item-2",
                name: "Regular",
                pricing_type: "FIXED_PRICING",
              },
            },
          ],
        },
      },
    ];

    const ids = extractVariationIds(items);

    expect(ids).toEqual(["var-1", "var-2", "var-3"]);
  });

  it("handles items without variations", () => {
    const items: SquareCatalogItem[] = [
      {
        type: "ITEM",
        id: "item-1",
        updated_at: "2024-01-01",
        item_data: {
          name: "Disc 1",
          // no variations
        },
      },
    ];

    const ids = extractVariationIds(items);

    expect(ids).toEqual([]);
  });
});
