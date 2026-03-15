import { describe, it, expect } from "vitest";
import {
  formatName,
  formatBrand,
  discTypeLabel,
  parseVariationColor,
  normalizeColor,
  slugify,
  aggregateItems,
  expandVariations,
  toGoogleProduct,
  variationToGoogleProduct,
  generateTsvFeed,
  type AggregatedItem,
  type VariationItem,
  type SquareInventoryData,
} from "./google-feed.js";
import type { CatalogObject, InventoryCount } from "square";

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
  channels?: string[];
  ecomVisibility?: string;
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
      channels: opts.channels ?? ["CH_default"],
      ecomVisibility: opts.ecomVisibility ?? "VISIBLE",
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

describe("formatBrand", () => {
  it("converts all-caps brand to title case", () => {
    expect(formatBrand("INNOVA")).toBe("Innova");
  });

  it("converts multi-word all-caps brand", () => {
    expect(formatBrand("AXIOM DISCS")).toBe("Axiom Discs");
    expect(formatBrand("DYNAMIC DISCS")).toBe("Dynamic Discs");
    expect(formatBrand("LATITUDE 64")).toBe("Latitude 64");
  });

  it("keeps short words as acronyms", () => {
    expect(formatBrand("RPM")).toBe("RPM");
    expect(formatBrand("MVP")).toBe("MVP");
  });

  it("keeps hyphenated acronyms intact", () => {
    expect(formatBrand("X-COM")).toBe("X-COM");
  });

  it("preserves already mixed-case brands", () => {
    expect(formatBrand("Kastaplast")).toBe("Kastaplast");
  });
});

describe("discTypeLabel", () => {
  it("maps putt and approach to Putter", () => {
    expect(discTypeLabel("PUTT AND APPROACH")).toBe("Disc Golf Putter");
  });

  it("maps mid-range to Midrange Disc", () => {
    expect(discTypeLabel("MID-RANGE")).toBe("Midrange Golf Disc");
  });

  it("maps drivers to Driver", () => {
    expect(discTypeLabel("DRIVERS")).toBe("Disc Golf Driver");
  });

  it("returns undefined for unknown categories", () => {
    expect(discTypeLabel("GLOW")).toBeUndefined();
    expect(discTypeLabel("STARTER SETS")).toBeUndefined();
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("RURU")).toBe("ruru");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("Innova Destroyer")).toBe("innova-destroyer");
  });

  it("removes special characters", () => {
    expect(slugify("Disc's & Things!")).toBe("disc-s-things");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("foo  --  bar")).toBe("foo-bar");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify(" -Ruru- ")).toBe("ruru");
  });
});

describe("aggregateItems", () => {
  it("combines variants into single item", () => {
    const data: SquareInventoryData = {
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
    const result = toGoogleProduct(sampleItem);

    expect(result).toEqual({
      id: "item-1",
      title: "Ruru",
      description: "A putter disc",
      link: "https://mdgcshop.square.site/product/ruru/25",
      image_link: "https://example.com/ruru.jpg",
      availability: "in_stock",
      price: "22.00 AUD",
      condition: "new",
      brand: undefined,
      google_product_category: "Sporting Goods > Outdoor Recreation > Disc Golf",
      product_type: "Putters",
    });
  });

  it("sets availability to out_of_stock when quantity is 0", () => {
    const outOfStock = { ...sampleItem, totalQuantity: 0 };
    const result = toGoogleProduct(outOfStock);

    expect(result.availability).toBe("out_of_stock");
  });

  it("uses title as description fallback", () => {
    const noDescription = { ...sampleItem, description: "" };
    const result = toGoogleProduct(noDescription);

    expect(result.description).toBe("Ruru");
  });

  it("prefixes brand to title", () => {
    const withBrand = { ...sampleItem, brand: "RPM" };
    const result = toGoogleProduct(withBrand);

    expect(result.title).toBe("RPM Ruru");
  });

  it("does not duplicate brand if name already starts with it", () => {
    const alreadyPrefixed = { ...sampleItem, name: "RPM Ruru", brand: "RPM" };
    const result = toGoogleProduct(alreadyPrefixed);

    expect(result.title).toBe("RPM Ruru");
  });

  it("appends disc type to title", () => {
    const withType = { ...sampleItem, discType: "Disc Golf Putter" };
    const result = toGoogleProduct(withType);

    expect(result.title).toBe("Ruru - Disc Golf Putter");
  });

  it("includes both brand and disc type in title", () => {
    const withBoth = { ...sampleItem, brand: "RPM", discType: "Disc Golf Putter" };
    const result = toGoogleProduct(withBoth);

    expect(result.title).toBe("RPM Ruru - Disc Golf Putter");
  });

  it("omits disc type from title when not set", () => {
    const noType = { ...sampleItem, brand: "RPM", discType: undefined };
    const result = toGoogleProduct(noType);

    expect(result.title).toBe("RPM Ruru");
  });

  it("uses item brand when available", () => {
    const withBrand = { ...sampleItem, brand: "RPM" };
    const result = toGoogleProduct(withBrand);

    expect(result.brand).toBe("RPM");
  });

  it("leaves brand undefined when item has no brand", () => {
    const noBrand = { ...sampleItem, brand: undefined };
    const result = toGoogleProduct(noBrand);

    expect(result.brand).toBeUndefined();
  });

  it("does not prefix brand to title when item has no brand", () => {
    const noBrand = { ...sampleItem, brand: undefined };
    const result = toGoogleProduct(noBrand);

    expect(result.title).toBe("Ruru");
  });
});

describe("generateTsvFeed", () => {
  const sampleData: SquareInventoryData = {
    catalogObjects: [
      makeImage("img-1", "https://example.com/ruru.jpg"),
      makeCategory("cat-1", "Putters"),
      makeItem({
        id: "item-1",
        name: "Ruru",
        description: "A putter",
        imageIds: ["img-1"],
        categoryId: "cat-1",
        variations: [{ id: "var-1", name: "Atomic/Pink", priceAmount: 2200n }],
      }),
    ],
    inventoryCounts: [makeInventoryCount("var-1", 5)],
  };

  it("generates TSV with header row", () => {
    const result = generateTsvFeed(sampleData);
    const lines = result.split("\n");

    expect(lines[0]).toBe(
      "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\tcondition\tbrand\tgoogle_product_category\tproduct_type"
    );
  });

  it("generates aggregated data rows", () => {
    const result = generateTsvFeed(sampleData);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item
    expect(lines[1]).toContain("item-1");
    expect(lines[1]).toContain("Ruru");
    expect(lines[1]).toContain("22.00 AUD");
    expect(lines[1]).toContain("https://mdgcshop.square.site/product/ruru/item-1");
  });

  it("skips items without channels (no URL)", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "No Channels Disc",
          imageIds: ["img-1"],
          channels: [], // no channels = no URL
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 1),
      ],
    };

    const result = generateTsvFeed(data);
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
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 1),
      ],
    };

    const result = generateTsvFeed(data);
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
          variations: [{ id: "var-1", priceAmount: 2200n }],
        }),
      ],
    };

    const result = generateTsvFeed(data);

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
          variations: [{ id: "var-2", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-2", 0),
      ],
    };

    const result = generateTsvFeed(data);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 in-stock item
    expect(result).not.toContain("Out of Stock Disc");
  });

  it("handles empty catalog", () => {
    const data: SquareInventoryData = {
      catalogObjects: [],
      inventoryCounts: [],
    };

    const result = generateTsvFeed(data);
    const lines = result.split("\n");

    expect(lines).toHaveLength(1); // just header
  });
});

describe("parseVariationColor", () => {
  it("extracts color from PLASTIC/COLOR/WEIGHT format", () => {
    expect(parseVariationColor("COSMIC/YELLOW/177")).toBe("Yellow");
  });

  it("extracts color from prefixed variation name", () => {
    expect(parseVariationColor("RURU - ATOMIC/PINK/171")).toBe("Pink");
  });

  it("handles multi-word colors", () => {
    expect(parseVariationColor("COSMIC/LIGHT BLUE/177+")).toBe("Blue");
  });

  it("returns undefined for non-standard names", () => {
    expect(parseVariationColor("STANDARD")).toBeUndefined();
    expect(parseVariationColor("Original")).toBeUndefined();
  });

  it("returns undefined for names with wrong number of parts", () => {
    expect(parseVariationColor("COSMIC/YELLOW")).toBeUndefined();
  });
});

describe("normalizeColor", () => {
  it("strips shade modifiers and abbreviations", () => {
    expect(normalizeColor("Lt blue")).toBe("Blue");
    expect(normalizeColor("Lt lilac swirl")).toBe("Lilac");
    expect(normalizeColor("Dark pink")).toBe("Pink");
    expect(normalizeColor("Pale pink")).toBe("Pink");
    expect(normalizeColor("Fluorescent yellow")).toBe("Yellow");
  });

  it("strips 'trans' prefix", () => {
    expect(normalizeColor("Trans pink")).toBe("Pink");
    expect(normalizeColor("Trans lime")).toBe("Lime");
    expect(normalizeColor("Trans orange")).toBe("Orange");
  });

  it("strips 'swirl' suffix", () => {
    expect(normalizeColor("Pink swirl")).toBe("Pink");
    expect(normalizeColor("Orange swirl")).toBe("Orange");
    expect(normalizeColor("Blue-pink swirl")).toBe("Blue/Pink");
  });

  it("converts hyphenated color pairs to slash-separated", () => {
    expect(normalizeColor("Lime-purple")).toBe("Lime/Purple");
    expect(normalizeColor("Pink-blue")).toBe("Pink/Blue");
    expect(normalizeColor("White-orange")).toBe("White/Orange");
    expect(normalizeColor("Charcoal-red")).toBe("Charcoal/Red");
  });

  it("passes through standard colors unchanged", () => {
    expect(normalizeColor("Pink")).toBe("Pink");
    expect(normalizeColor("Yellow")).toBe("Yellow");
    expect(normalizeColor("Blue")).toBe("Blue");
  });

  it("returns undefined for values with digits", () => {
    expect(normalizeColor("Idye3")).toBeUndefined();
  });

  it("strips 'rim' suffix and normalizes", () => {
    expect(normalizeColor("Glow-white rim")).toBe("Glow/White");
  });
});

describe("expandVariations", () => {
  it("produces one row per variation", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "A putter",
          imageIds: ["img-1"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
            { id: "var-2", name: "COSMIC/BLUE/170", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 2),
        makeInventoryCount("var-2", 3),
      ],
    };

    const items = expandVariations(data);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      variationId: "var-1",
      itemId: "item-1",
      name: "Ruru",
      color: "Pink",
      price: 2200,
      quantity: 2,
    });
    expect(items[1]).toMatchObject({
      variationId: "var-2",
      color: "Blue",
      price: 2500,
      quantity: 3,
    });
  });

  it("includes out-of-stock variations", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Disc",
          variations: [
            { id: "var-1", name: "ATOMIC/RED/175", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 0)],
    };

    const items = expandVariations(data);

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(0);
  });

  it("skips variations without price", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Disc",
          variations: [
            { id: "var-1", name: "ATOMIC/RED/175" }, // no price
            { id: "var-2", name: "COSMIC/BLUE/170", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 1),
        makeInventoryCount("var-2", 1),
      ],
    };

    const items = expandVariations(data);

    expect(items).toHaveLength(1);
    expect(items[0].variationId).toBe("var-2");
  });

  it("inherits brand and disc type from parent item", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeCategory("brand-parent", "BRANDS"),
        makeCategory("brand-rpm", "RPM", "brand-parent"),
        makeCategory("dt-parent", "DISC TYPES"),
        makeCategory("dt-putter", "PUTT AND APPROACH", "dt-parent"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          categoryIds: ["brand-rpm", "dt-putter"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 1)],
    };

    const items = expandVariations(data);

    expect(items[0].brand).toBe("RPM");
    expect(items[0].discType).toBe("Disc Golf Putter");
  });
});

describe("variationToGoogleProduct", () => {
  const sampleVariation: VariationItem = {
    variationId: "var-1",
    itemId: "item-1",
    name: "Ruru",
    description: "A putter disc",
    productUrl: "https://mdgcshop.square.site/product/ruru/item-1",
    imageUrl: "https://example.com/ruru-pink.jpg",
    category: "DISCS",
    brand: "RPM",
    discType: "Disc Golf Putter",
    color: "Pink",
    price: 2200,
    currency: "AUD",
    quantity: 3,
  };

  it("uses variation ID as product ID", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.id).toBe("var-1");
  });

  it("sets item_group_id to the parent item ID", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.item_group_id).toBe("item-1");
  });

  it("includes color", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.color).toBe("Pink");
  });

  it("uses variation-specific price", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.price).toBe("22.00 AUD");
  });

  it("builds title with brand and disc type", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.title).toBe("RPM Ruru - Disc Golf Putter");
  });

  it("sets availability from variation quantity", () => {
    const outOfStock = { ...sampleVariation, quantity: 0 };
    expect(variationToGoogleProduct(outOfStock).availability).toBe(
      "out_of_stock"
    );
    expect(variationToGoogleProduct(sampleVariation).availability).toBe(
      "in_stock"
    );
  });
});

describe("generateTsvFeed with variations", () => {
  it("includes item_group_id and color columns", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "A putter",
          imageIds: ["img-1"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
            { id: "var-2", name: "COSMIC/BLUE/170", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 2),
        makeInventoryCount("var-2", 3),
      ],
    };

    const result = generateTsvFeed(data, { perVariation: true });
    const lines = result.split("\n");
    const headers = lines[0].split("\t");

    expect(headers).toContain("item_group_id");
    expect(headers).toContain("color");
    // 1 header + 2 variations
    expect(lines).toHaveLength(3);
  });

  it("uses variation ID as product ID", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          imageIds: ["img-1"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 2)],
    };

    const result = generateTsvFeed(data, { perVariation: true });
    const lines = result.split("\n");

    expect(lines[1]).toContain("var-1");
  });

  it("skips out-of-stock variations", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          imageIds: ["img-1"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
            { id: "var-2", name: "COSMIC/BLUE/170", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 0),
        makeInventoryCount("var-2", 3),
      ],
    };

    const result = generateTsvFeed(data, { perVariation: true });
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 in-stock variation
    expect(result).not.toContain("var-1");
    expect(result).toContain("var-2");
  });

  it("defaults to aggregated mode when perVariation is false", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          imageIds: ["img-1"],
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
            { id: "var-2", name: "COSMIC/BLUE/170", priceAmount: 2500n },
          ],
        }),
      ],
      inventoryCounts: [
        makeInventoryCount("var-1", 2),
        makeInventoryCount("var-2", 3),
      ],
    };

    const result = generateTsvFeed(data);
    const lines = result.split("\n");
    const headers = lines[0].split("\t");

    // Aggregated: 1 header + 1 item (not 2 variations)
    expect(lines).toHaveLength(2);
    expect(headers).not.toContain("item_group_id");
  });
});
