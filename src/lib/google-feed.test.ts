import { describe, it, expect } from "vitest";
import {
  formatName,
  aggregateItems,
  toGoogleProduct,
  generateTsvFeed,
  type FeedConfig,
  type AggregatedItem,
  type SquareInventoryData,
} from "./google-feed.js";
import type { CatalogObject, InventoryCount } from "square";

const config: FeedConfig = {
  defaultBrand: "MDGC",
};

/**
 * Helper to create a minimal Square ITEM catalog object.
 */
function makeItem(opts: {
  id: string;
  name: string;
  description?: string;
  imageIds?: string[];
  categoryId?: string;
  categoryIds?: string[];
  ecomUri?: string;
  productType?: string;
  variations: Array<{
    id: string;
    name?: string;
    priceAmount?: bigint;
    currency?: string;
  }>;
}): CatalogObject {
  return {
    type: "ITEM",
    id: opts.id,
    itemData: {
      name: opts.name,
      description: opts.description,
      imageIds: opts.imageIds,
      categoryId: opts.categoryId,
      categories: opts.categoryIds?.map((id) => ({ id })),
      ecomUri: opts.ecomUri,
      productType: opts.productType ?? "REGULAR",
      variations: opts.variations.map((v) => ({
        type: "ITEM_VARIATION",
        id: v.id,
        itemVariationData: {
          name: v.name,
          priceMoney: v.priceAmount
            ? { amount: v.priceAmount, currency: v.currency ?? "AUD" }
            : undefined,
        },
      })),
    },
  } as CatalogObject;
}

/**
 * Helper to create a Square IMAGE catalog object.
 */
function makeImage(id: string, url: string): CatalogObject {
  return {
    type: "IMAGE",
    id,
    imageData: { url },
  } as CatalogObject;
}

/**
 * Helper to create a Square CATEGORY catalog object.
 */
function makeCategory(
  id: string,
  name: string,
  parentId?: string
): CatalogObject {
  return {
    type: "CATEGORY",
    id,
    categoryData: {
      name,
      parentCategory: parentId ? { id: parentId } : undefined,
    },
  } as CatalogObject;
}

/**
 * Helper to create inventory counts.
 */
function makeInventoryCount(
  catalogObjectId: string,
  quantity: number
): InventoryCount {
  return {
    catalogObjectId,
    quantity: quantity.toString(),
  } as InventoryCount;
}

describe("formatName", () => {
  it("converts all-caps to title case", () => {
    expect(formatName("MAVERICK")).toBe("Maverick");
  });

  it("converts all-caps multi-word names", () => {
    expect(formatName("RURU")).toBe("Ruru");
  });

  it("preserves mixed case names", () => {
    expect(formatName("Innova Destroyer")).toBe("Innova Destroyer");
  });

  it("preserves single word mixed case", () => {
    expect(formatName("Envy")).toBe("Envy");
  });
});

describe("aggregateItems", () => {
  it("combines variants into single item", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "A putter",
          imageIds: ["img-1"],
          ecomUri: "https://mdgcshop.square.site/product/ruru/25",
          variations: [
            { id: "var-1", name: "Atomic/Pink/171", priceAmount: 2200n },
            { id: "var-2", name: "Cosmic/Blue/170", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 2),
        makeInventoryCount("var-2", 3),
      ],
    };

    const items = aggregateItems(data);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemId: "item-1",
      name: "Ruru",
      totalQuantity: 5,
      minPrice: 2200,
    });
  });

  it("uses minimum price from in-stock variants only", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Disc",
          ecomUri: "https://example.com/disc",
          variations: [
            { id: "var-1", name: "Cheap but out of stock", priceAmount: 1500n },
            { id: "var-2", name: "In stock", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 0), // out of stock
        makeInventoryCount("var-2", 3), // in stock
      ],
    };

    const items = aggregateItems(data);

    expect(items[0].minPrice).toBe(2500); // not 1500
    expect(items[0].totalQuantity).toBe(3);
  });

  it("uses minimum price across variants", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Disc",
          ecomUri: "https://example.com/disc",
          variations: [
            { id: "var-1", name: "Cheap", priceAmount: 1500n },
            { id: "var-2", name: "Expensive", priceAmount: 3000n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 1),
        makeInventoryCount("var-2", 1),
      ],
    };

    const items = aggregateItems(data);

    expect(items[0].minPrice).toBe(1500);
  });

  it("keeps separate items separate", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Ruru",
          ecomUri: "https://example.com/ruru",
          variations: [{ id: "var-1", priceAmount: 2200n }],
        }),
        makeItem({
          id: "item-2",
          name: "Tui",
          ecomUri: "https://example.com/tui",
          variations: [{ id: "var-2", priceAmount: 2200n }],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 2),
        makeInventoryCount("var-2", 3),
      ],
    };

    const items = aggregateItems(data);

    expect(items).toHaveLength(2);
  });

  it("extracts brand from category hierarchy", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        // Parent category for brands
        makeCategory("brands-cat", "BRANDS"),
        // Brand category (child of BRANDS)
        makeCategory("rpm-cat", "RPM", "brands-cat"),
        // Other category (not a brand)
        makeCategory("putters-cat", "PUTTERS"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "A putter",
          imageIds: ["img-1"],
          categoryIds: ["putters-cat", "rpm-cat"],
          ecomUri: "https://example.com/ruru",
          variations: [{ id: "var-1", priceAmount: 2200n }],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 5)],
    };

    const items = aggregateItems(data);

    expect(items).toHaveLength(1);
    expect(items[0].brand).toBe("RPM");
  });

  it("skips non-REGULAR product types", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeImage("img-1", "https://example.com/disc.jpg"),
        makeItem({
          id: "item-1",
          name: "Regular Disc",
          imageIds: ["img-1"],
          ecomUri: "https://example.com/disc",
          productType: "REGULAR",
          variations: [{ id: "var-1", priceAmount: 2200n }],
        }),
        makeItem({
          id: "item-2",
          name: "Event Registration",
          imageIds: ["img-1"],
          ecomUri: "https://example.com/event",
          productType: "EVENT",
          variations: [{ id: "var-2", priceAmount: 1500n }],
        }),
        makeItem({
          id: "item-3",
          name: "Membership",
          imageIds: ["img-1"],
          ecomUri: "https://example.com/membership",
          productType: "LEGACY_SQUARE_ONLINE_SERVICE",
          variations: [{ id: "var-3", priceAmount: 5000n }],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 5),
        makeInventoryCount("var-2", 10),
        makeInventoryCount("var-3", 100),
      ],
    };

    const items = aggregateItems(data);

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Regular Disc");
  });

  it("skips items without price", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "No Price Disc",
          ecomUri: "https://example.com/disc",
          variations: [{ id: "var-1" }], // no price
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 5)],
    };

    const items = aggregateItems(data);

    expect(items).toHaveLength(0);
  });
});

describe("toGoogleProduct", () => {
  const sampleItem: AggregatedItem = {
    itemId: "item-1",
    name: "Ruru",
    description: "A putter disc",
    productUrl: "https://mdgcshop.square.site/product/ruru/25",
    imageUrl: "https://example.com/ruru.jpg",
    category: "Putters",
    minPrice: 2200,
    currency: "AUD",
    totalQuantity: 5,
  };

  it("converts aggregated item to Google format", () => {
    const result = toGoogleProduct(sampleItem, config);

    expect(result).toEqual({
      id: "item-1",
      title: "Ruru",
      description: "A putter disc",
      link: "https://mdgcshop.square.site/product/ruru/25",
      image_link: "https://example.com/ruru.jpg",
      availability: "in_stock",
      price: "22.00 AUD",
      condition: "new",
      brand: "MDGC",
      mpn: undefined,
      product_type: "Putters",
    });
  });

  it("sets availability to out_of_stock when quantity is 0", () => {
    const outOfStock = { ...sampleItem, totalQuantity: 0 };
    const result = toGoogleProduct(outOfStock, config);

    expect(result.availability).toBe("out_of_stock");
  });

  it("uses title as description fallback", () => {
    const noDescription = { ...sampleItem, description: "" };
    const result = toGoogleProduct(noDescription, config);

    expect(result.description).toBe("Ruru");
  });

  it("uses item brand when available", () => {
    const withBrand = { ...sampleItem, brand: "RPM" };
    const result = toGoogleProduct(withBrand, config);

    expect(result.brand).toBe("RPM");
  });

  it("falls back to defaultBrand when item has no brand", () => {
    const noBrand = { ...sampleItem, brand: undefined };
    const result = toGoogleProduct(noBrand, config);

    expect(result.brand).toBe("MDGC");
  });
});

describe("generateTsvFeed", () => {
  const sampleData: SquareInventoryData = {
    fetchedAt: "2024-01-01T00:00:00Z",
    catalogObjects: [
      makeImage("img-1", "https://example.com/ruru.jpg"),
      makeCategory("cat-1", "Putters"),
      makeItem({
        id: "item-1",
        name: "Ruru",
        description: "A putter",
        imageIds: ["img-1"],
        categoryId: "cat-1",
        ecomUri: "https://mdgcshop.square.site/product/ruru/25",
        variations: [{ id: "var-1", name: "Atomic/Pink", priceAmount: 2200n }],
      }),
    ],
    inventoryCounts: [makeInventoryCount("var-1", 5)],
  };

  it("generates TSV with header row", () => {
    const result = generateTsvFeed(sampleData, config);
    const lines = result.split("\n");

    expect(lines[0]).toBe(
      "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\tcondition\tbrand\tmpn\tproduct_type"
    );
  });

  it("generates aggregated data rows", () => {
    const result = generateTsvFeed(sampleData, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item
    expect(lines[1]).toContain("item-1");
    expect(lines[1]).toContain("Ruru");
    expect(lines[1]).toContain("22.00 AUD");
  });

  it("skips items without productUrl (ecomUri)", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "No URL Disc",
          imageIds: ["img-1"],
          // no ecomUri
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 1),
      ],
    };

    const result = generateTsvFeed(data, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item (not 3)
  });

  it("skips items without images", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "No Image Disc",
          // no imageIds
          ecomUri: "https://example.com/disc",
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 1),
      ],
    };

    const result = generateTsvFeed(data, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item
  });

  it("escapes tabs and newlines in values", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "Line 1\nLine 2\twith tab",
          imageIds: ["img-1"],
          ecomUri: "https://example.com/ruru",
          variations: [{ id: "var-1", priceAmount: 2200n }],
        }),
      ],
    };

    const result = generateTsvFeed(data, config);

    expect(result).not.toContain("\nLine 2");
    expect(result).toContain("Line 1 Line 2 with tab");
  });

  it("skips out-of-stock items", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "Out of Stock Disc",
          imageIds: ["img-1"],
          ecomUri: "https://example.com/disc",
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 0),
      ],
    };

    const result = generateTsvFeed(data, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 in-stock item
    expect(result).not.toContain("Out of Stock Disc");
  });

  it("handles empty catalog", () => {
    const data: SquareInventoryData = {
      fetchedAt: "2024-01-01T00:00:00Z",
      catalogObjects: [],
      inventoryCounts: [],
    };

    const result = generateTsvFeed(data, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(1); // just header
  });
});
