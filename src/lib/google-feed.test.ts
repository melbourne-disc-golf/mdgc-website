import { describe, it, expect } from "vitest";
import {
  titleCase,
  titleCaseKeepAcronyms,
  formatVariationTitle,
  discTypeFromCategory,
  DISC_TYPES,
  parseVariationParts,
  parseVariationColor,
  parseVariationPlastic,
  parseVariationWeight,
  normalizeColor,
  slugify,
  extractFlightRatings,
  flightProductDetails,
  expandVariations,
  variationToGoogleProduct,
  generateTsvFeed,
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

describe("titleCase", () => {
  it("converts all-caps to title case", () => {
    expect(titleCase("MAVERICK")).toBe("Maverick");
  });

  it("converts all-caps multi-word names", () => {
    expect(titleCase("RURU")).toBe("Ruru");
  });

  it("preserves mixed case names", () => {
    expect(titleCase("Innova Destroyer")).toBe("Innova Destroyer");
  });

  it("preserves single word mixed case", () => {
    expect(titleCase("Envy")).toBe("Envy");
  });
});

describe("formatVariationTitle", () => {
  it("combines brand, item name, and variation detail", () => {
    expect(formatVariationTitle("KOTARE", "KOTARE - ATOMIC/BURNT ORANGE/173", "RPM"))
      .toBe("RPM Kotare - Atomic/Burnt Orange/173");
  });

  it("works without brand", () => {
    expect(formatVariationTitle("RURU", "ATOMIC/PINK/171"))
      .toBe("Ruru - Atomic/Pink/171");
  });

  it("strips variant suffix from item name", () => {
    expect(formatVariationTitle("TAKAPU - GLOW", "Glow/White/170-2", "RPM"))
      .toBe("RPM Takapu - Glow/White/170-2");
  });

  it("strips item name prefix from variation name", () => {
    expect(formatVariationTitle("KOTARE", "KOTARE - ATOMIC/RED/175"))
      .toBe("Kotare - Atomic/Red/175");
  });

  it("avoids duplicating brand already in item name", () => {
    expect(formatVariationTitle("RPM Starter Disc Set", "Pekapeka/Kotuku/Ruru", "RPM"))
      .toBe("RPM Starter Disc Set - Pekapeka/Kotuku/Ruru");
  });

  it("title-cases multi-word item names", () => {
    expect(formatVariationTitle("TIME LAPSE", "Neutron/Red-grey/173-5", "Axiom Discs"))
      .toBe("Axiom Discs Time Lapse - Neutron/Red-grey/173-5");
  });

  it("keeps short abbreviations in item names", () => {
    expect(formatVariationTitle("BUZZZ OS", "ESP/Pink Swirl/164-6", "Discraft"))
      .toBe("Discraft Buzzz OS - ESP/Pink Swirl/164-6");
    expect(formatVariationTitle("BUZZZ SS", "ESP/Pink Swirl/170-2", "Discraft"))
      .toBe("Discraft Buzzz SS - ESP/Pink Swirl/170-2");
  });

  it("title-cases short disc names", () => {
    expect(formatVariationTitle("TUI", "Glow/White/173-5", "RPM"))
      .toBe("RPM Tui - Glow/White/173-5");
  });

  it("keeps short alphanumeric model codes in item names", () => {
    expect(formatVariationTitle("TL3", "Star/Orange/172", "Innova"))
      .toBe("Innova TL3 - Star/Orange/172");
  });

  it("title-cases longer alphanumeric names", () => {
    expect(formatVariationTitle("ROC3", "Champion/Yellow/180", "Innova"))
      .toBe("Innova Roc3 - Champion/Yellow/180");
  });

  it("includes disc type between name and variation detail", () => {
    expect(formatVariationTitle("KOTARE", "KOTARE - ATOMIC/BURNT ORANGE/173", "RPM", "Disc Golf Putter"))
      .toBe("RPM Kotare - Disc Golf Putter - Atomic/Burnt Orange/173");
  });

  it("includes disc type without brand", () => {
    expect(formatVariationTitle("RURU", "ATOMIC/PINK/171", undefined, "Midrange Golf Disc"))
      .toBe("Ruru - Midrange Golf Disc - Atomic/Pink/171");
  });
});

describe("titleCaseKeepAcronyms", () => {
  it("converts all-caps brand to title case", () => {
    expect(titleCaseKeepAcronyms("INNOVA")).toBe("Innova");
  });

  it("converts multi-word all-caps brand", () => {
    expect(titleCaseKeepAcronyms("AXIOM DISCS")).toBe("Axiom Discs");
    expect(titleCaseKeepAcronyms("DYNAMIC DISCS")).toBe("Dynamic Discs");
    expect(titleCaseKeepAcronyms("LATITUDE 64")).toBe("Latitude 64");
  });

  it("keeps short words as acronyms", () => {
    expect(titleCaseKeepAcronyms("RPM")).toBe("RPM");
    expect(titleCaseKeepAcronyms("MVP")).toBe("MVP");
  });

  it("keeps hyphenated acronyms intact", () => {
    expect(titleCaseKeepAcronyms("X-COM")).toBe("X-COM");
  });

  it("preserves already mixed-case brands", () => {
    expect(titleCaseKeepAcronyms("Kastaplast")).toBe("Kastaplast");
  });
});

describe("discTypeFromCategory", () => {
  it("maps putt and approach to Putter", () => {
    expect(discTypeFromCategory("PUTT AND APPROACH")).toBe("Putter");
  });

  it("maps mid-range to Midrange", () => {
    expect(discTypeFromCategory("MID-RANGE")).toBe("Midrange");
  });

  it("maps drivers to Driver", () => {
    expect(discTypeFromCategory("DRIVERS")).toBe("Driver");
  });

  it("returns undefined for unknown categories", () => {
    expect(discTypeFromCategory("GLOW")).toBeUndefined();
    expect(discTypeFromCategory("STARTER SETS")).toBeUndefined();
  });
});

describe("DISC_TYPES", () => {
  it("has long-form descriptions", () => {
    expect(DISC_TYPES.Putter.long).toBe("Disc Golf Putter");
    expect(DISC_TYPES.Midrange.long).toBe("Midrange Golf Disc");
    expect(DISC_TYPES.Driver.long).toBe("Disc Golf Driver");
  });

  it("has Square category names", () => {
    expect(DISC_TYPES.Putter.category).toBe("PUTT AND APPROACH");
    expect(DISC_TYPES.Midrange.category).toBe("MID-RANGE");
    expect(DISC_TYPES.Driver.category).toBe("DRIVERS");
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

  it("generates TSV with header row including variation columns", () => {
    const result = generateTsvFeed(sampleData);
    const headers = result.split("\n")[0].split("\t");

    expect(headers).toContain("item_group_id");
    expect(headers).toContain("color");
  });

  it("generates one row per variation", () => {
    const result = generateTsvFeed(sampleData);
    const lines = result.split("\n");

    // 1 header + 2 variations
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("var-1");
    expect(lines[2]).toContain("var-2");
  });

  it("skips variations without channels (no URL)", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "No Channels Disc",
          imageIds: ["img-1"],
          channels: [],
          variations: [{ id: "var-3", name: "ATOMIC/RED/175", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-3", 1),
      ],
    };

    const result = generateTsvFeed(data);

    expect(result).not.toContain("var-3");
  });

  it("skips variations without images", () => {
    const data: SquareInventoryData = {
      ...sampleData,
      catalogObjects: [
        ...sampleData.catalogObjects,
        makeItem({
          id: "item-2",
          name: "No Image Disc",
          variations: [{ id: "var-3", name: "ATOMIC/RED/175", priceAmount: 2000n }],
        }),
      ],
      inventoryCounts: [
        ...sampleData.inventoryCounts,
        makeInventoryCount("var-3", 1),
      ],
    };

    const result = generateTsvFeed(data);

    expect(result).not.toContain("var-3");
  });

  it("escapes tabs and newlines in values", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeImage("img-1", "https://example.com/ruru.jpg"),
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "Line 1\nLine 2\twith tab",
          imageIds: ["img-1"],
          variations: [{ id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n }],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 5)],
    };

    const result = generateTsvFeed(data);

    expect(result).not.toContain("\nLine 2");
    expect(result).toContain("Line 1 Line 2 with tab");
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

    const result = generateTsvFeed(data);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 in-stock variation
    expect(result).not.toContain("var-1");
    expect(result).toContain("var-2");
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

describe("parseVariationParts", () => {
  it("splits standard PLASTIC/COLOR/WEIGHT format", () => {
    expect(parseVariationParts("COSMIC/YELLOW/177")).toEqual({
      plastic: "COSMIC",
      color: "YELLOW",
      weight: "177",
    });
  });

  it("strips item name prefix", () => {
    expect(parseVariationParts("RURU - ATOMIC/PINK/171")).toEqual({
      plastic: "ATOMIC",
      color: "PINK",
      weight: "171",
    });
  });

  it("returns undefined for non-standard names", () => {
    expect(parseVariationParts("STANDARD")).toBeUndefined();
    expect(parseVariationParts("COSMIC/YELLOW")).toBeUndefined();
  });
});

describe("parseVariationWeight", () => {
  it("extracts weight from standard format", () => {
    expect(parseVariationWeight("COSMIC/YELLOW/177")).toBe("177 g");
  });

  it("extracts weight from prefixed variation name", () => {
    expect(parseVariationWeight("RURU - ATOMIC/PINK/171")).toBe("171 g");
  });

  it("uses lower bound for weight ranges", () => {
    expect(parseVariationWeight("MAVERICK - FUZION/ORANGE/166-9")).toBe("166 g");
  });

  it("strips trailing + from weight", () => {
    expect(parseVariationWeight("COSMIC/BLUE/177+")).toBe("177 g");
  });

  it("returns undefined for non-standard names", () => {
    expect(parseVariationWeight("STANDARD")).toBeUndefined();
  });
});

describe("extractFlightRatings", () => {
  it("parses flight ratings and strips .0 suffix", () => {
    const desc = "Great disc.\n\nSpeed: 7.0\nGlide: 4.0\nTurn: -1.5\nFade: 2.0";
    const result = extractFlightRatings(desc)!;
    expect(result.flight).toEqual({
      speed: "7",
      glide: "4",
      turn: "-1.5",
      fade: "2",
    });
    expect(result.description).toBe("Great disc. (7 / 4 / -1.5 / 2)");
  });

  it("parses integer flight ratings (case-insensitive)", () => {
    const desc = "A good disc\n\nSPEED: 6\nGLIDE: 6\nTURN: -3\nFADE: 0";
    const result = extractFlightRatings(desc)!;
    expect(result.flight).toEqual({
      speed: "6",
      glide: "6",
      turn: "-3",
      fade: "0",
    });
    expect(result.description).toBe("A good disc (6 / 6 / -3 / 0)");
  });

  it("returns undefined when flight ratings are missing", () => {
    expect(extractFlightRatings("Just a description")).toBeUndefined();
  });

  it("returns undefined when only some stats are present", () => {
    expect(extractFlightRatings("Speed: 7.0\nGlide: 4.0")).toBeUndefined();
  });

  it("ignores stat keywords in prose, matches the actual stats", () => {
    const desc = "stable flight with a gentle late fade. The bead-less rim\n\nSPEED: 2\nGLIDE: 3\nTURN: 0\nFADE: 2";
    const result = extractFlightRatings(desc)!;
    expect(result.flight).toEqual({ speed: "2", glide: "3", turn: "0", fade: "2" });
    expect(result.description).toBe("stable flight with a gentle late fade. The bead-less rim (2 / 3 / 0 / 2)");
  });

  it("returns undefined when one stat is missing", () => {
    expect(extractFlightRatings("SPEED: 5\nGLIDE: 4\nTURN: -1")).toBeUndefined();
  });

  it("returns undefined when a stat value is garbled", () => {
    expect(extractFlightRatings("SPEED: 5\nGLIDE: 5\nTURN: -!\nFADE: 1")).toBeUndefined();
  });

  it("parses flight numbers on a single line", () => {
    const desc = "A great disc. SPEED: 9GLIDE: 5TURN: -1FADE: 2";
    const result = extractFlightRatings(desc)!;
    expect(result.flight).toEqual({
      speed: "9",
      glide: "5",
      turn: "-1",
      fade: "2",
    });
    expect(result.description).toBe("A great disc. (9 / 5 / -1 / 2)");
  });

  it("parses flight numbers without colons", () => {
    const desc = "A disc\n\nSPEED: 3\nGLIDE 3\nTURN: -1\nFADE: 1";
    const result = extractFlightRatings(desc)!;
    expect(result.flight).toEqual({
      speed: "3",
      glide: "3",
      turn: "-1",
      fade: "1",
    });
    expect(result.description).toBe("A disc (3 / 3 / -1 / 1)");
  });
});

describe("flightProductDetails", () => {
  it("builds product_detail entries from flight numbers", () => {
    const details = flightProductDetails({
      speed: "7",
      glide: "4",
      turn: "-1.5",
      fade: "2",
    });
    expect(details).toEqual([
      "Disc:Speed:7",
      "Disc:Glide:4",
      "Disc:Turn:-1.5",
      "Disc:Fade:2",
    ]);
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

describe("parseVariationPlastic", () => {
  it("extracts plastic from standard format", () => {
    expect(parseVariationPlastic("COSMIC/YELLOW/177")).toBe("Cosmic");
  });

  it("extracts plastic from prefixed variation name", () => {
    expect(parseVariationPlastic("KOTARE - ATOMIC/BURNT ORANGE/173")).toBe("Atomic");
  });

  it("keeps short plastic names as acronyms", () => {
    expect(parseVariationPlastic("ESP/RED/175")).toBe("ESP");
    expect(parseVariationPlastic("VIP-X/RED/175")).toBe("VIP-X");
  });

  it("returns undefined for non-standard names", () => {
    expect(parseVariationPlastic("STANDARD")).toBeUndefined();
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
      name: "Ruru - Atomic/Pink/171",  
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

  it("extracts plastic type from variation name", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Kotare",
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 1)],
    };

    const items = expandVariations(data);

    expect(items[0].plastic).toBe("Atomic");
    expect(items[0].productDetails).toContain("Disc:Plastic:Atomic");
  });

  it("extracts weight from variation name", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Ruru",
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 1)],
    };

    const items = expandVariations(data);

    expect(items[0].weight).toBe("171 g");
  });

  it("builds product highlights from flight numbers in description", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Ruru",
          description: "A putter\n\nSpeed: 2.0\nGlide: 5.0\nTurn: 0\nFade: 1.0",
          variations: [
            { id: "var-1", name: "ATOMIC/PINK/171", priceAmount: 2200n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 1)],
    };

    const items = expandVariations(data);

    expect(items[0].productDetails).toEqual([
      "Disc:Speed:2",
      "Disc:Glide:5",
      "Disc:Turn:0",
      "Disc:Fade:1",
      "Disc:Plastic:Atomic",
    ]);
  });

  it("omits product details when description lacks flight numbers", () => {
    const data: SquareInventoryData = {
      catalogObjects: [
        makeItem({
          id: "item-1",
          name: "Disc bag",
          description: "A bag for discs",
          variations: [
            { id: "var-1", name: "STANDARD", priceAmount: 5000n },
          ],
        }),
      ],
      inventoryCounts: [makeInventoryCount("var-1", 1)],
    };

    const items = expandVariations(data);

    expect(items[0].productDetails).toBeUndefined();
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
    expect(items[0].discType).toBe("Putter");
    expect(items[0].name).toBe("RPM Ruru - Disc Golf Putter - Atomic/Pink/171");
    expect(items[0].productDetails).toContain("Disc:Type:Putter");
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
    discType: "Putter",
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

  it("uses name as title", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.title).toBe("Ruru");
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

  it("sets material to Plastic for discs", () => {
    const result = variationToGoogleProduct(sampleVariation);
    expect(result.material).toBe("Plastic");
  });

  it("omits material for non-disc items", () => {
    const nonDisc = { ...sampleVariation, category: "BAGS" };
    expect(variationToGoogleProduct(nonDisc).material).toBeUndefined();
  });

  it("includes product_weight when weight is set", () => {
    const withWeight = { ...sampleVariation, weight: "171 g" };
    const result = variationToGoogleProduct(withWeight);
    expect(result.product_weight).toBe("171 g");
  });

  it("includes product_detail from flight numbers", () => {
    const withDetails = {
      ...sampleVariation,
      productDetails: [
        "Disc:Speed:7",
        "Disc:Glide:5",
        "Disc:Turn:-2",
        "Disc:Fade:1",
      ],
    };
    const result = variationToGoogleProduct(withDetails);
    expect(result.product_detail).toBe("Disc:Speed:7,Disc:Glide:5,Disc:Turn:-2,Disc:Fade:1");
  });
});


