import { describe, it, expect } from "vitest";
import {
  extractBaseName,
  aggregateByItem,
  toGoogleProduct,
  generateTsvFeed,
  type FeedConfig,
  type AggregatedItem,
} from "./google-feed.js";
import type { Product } from "../../scripts/square/types.js";

const config: FeedConfig = {
  storeUrl: "https://mdgcshop.square.site",
  defaultBrand: "MDGC",
};

describe("extractBaseName", () => {
  it("extracts base name from variant name with suffix", () => {
    expect(extractBaseName("Innova Destroyer - 170g Blue")).toBe(
      "Innova Destroyer"
    );
  });

  it("handles double name pattern", () => {
    expect(extractBaseName("RURU - RURU - ATOMIC/PINK/171")).toBe("Ruru");
  });

  it("converts all-caps to title case", () => {
    expect(extractBaseName("MAVERICK")).toBe("Maverick");
  });

  it("preserves mixed case names", () => {
    expect(extractBaseName("Innova Destroyer")).toBe("Innova Destroyer");
  });

  it("handles single word names", () => {
    expect(extractBaseName("Envy")).toBe("Envy");
  });
});

describe("aggregateByItem", () => {
  it("combines variants into single item", () => {
    const products: Product[] = [
      {
        id: "var-1",
        itemId: "item-1",
        name: "Ruru - Atomic/Pink/171",
        description: "A putter",
        price: 2200,
        currency: "AUD",
        imageUrl: "https://example.com/ruru.jpg",
        productUrl: "https://mdgcshop.square.site/product/ruru/25",
        quantity: 2,
      },
      {
        id: "var-2",
        itemId: "item-1",
        name: "Ruru - Cosmic/Blue/170",
        description: "A putter",
        price: 2500,
        currency: "AUD",
        imageUrl: "https://example.com/ruru.jpg",
        productUrl: "https://mdgcshop.square.site/product/ruru/25",
        quantity: 3,
      },
    ];

    const items = aggregateByItem(products);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemId: "item-1",
      name: "Ruru",
      totalQuantity: 5,
      minPrice: 2200,
    });
  });

  it("uses minimum price across variants", () => {
    const products: Product[] = [
      {
        id: "var-1",
        itemId: "item-1",
        name: "Disc - Cheap",
        description: "",
        price: 1500,
        currency: "AUD",
        quantity: 1,
      },
      {
        id: "var-2",
        itemId: "item-1",
        name: "Disc - Expensive",
        description: "",
        price: 3000,
        currency: "AUD",
        quantity: 1,
      },
    ];

    const items = aggregateByItem(products);

    expect(items[0].minPrice).toBe(1500);
  });

  it("picks up productUrl from any variant that has it", () => {
    const products: Product[] = [
      {
        id: "var-1",
        itemId: "item-1",
        name: "Disc",
        description: "",
        price: 2000,
        currency: "AUD",
        productUrl: undefined,
        quantity: 1,
      },
      {
        id: "var-2",
        itemId: "item-1",
        name: "Disc",
        description: "",
        price: 2000,
        currency: "AUD",
        productUrl: "https://example.com/disc",
        quantity: 1,
      },
    ];

    const items = aggregateByItem(products);

    expect(items[0].productUrl).toBe("https://example.com/disc");
  });

  it("keeps separate items separate", () => {
    const products: Product[] = [
      {
        id: "var-1",
        itemId: "item-1",
        name: "Ruru",
        description: "",
        price: 2200,
        currency: "AUD",
        quantity: 2,
      },
      {
        id: "var-2",
        itemId: "item-2",
        name: "Tui",
        description: "",
        price: 2200,
        currency: "AUD",
        quantity: 3,
      },
    ];

    const items = aggregateByItem(products);

    expect(items).toHaveLength(2);
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
});

describe("generateTsvFeed", () => {
  const sampleProducts: Product[] = [
    {
      id: "var-1",
      itemId: "item-1",
      name: "Ruru - Atomic/Pink",
      description: "A putter",
      sku: "R001",
      price: 2200,
      currency: "AUD",
      imageUrl: "https://example.com/ruru.jpg",
      productUrl: "https://mdgcshop.square.site/product/ruru/25",
      category: "Putters",
      quantity: 5,
    },
  ];

  it("generates TSV with header row", () => {
    const result = generateTsvFeed(sampleProducts, config);
    const lines = result.split("\n");

    expect(lines[0]).toBe(
      "id\ttitle\tdescription\tlink\timage_link\tavailability\tprice\tcondition\tbrand\tmpn\tproduct_type"
    );
  });

  it("generates aggregated data rows", () => {
    const result = generateTsvFeed(sampleProducts, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item
    expect(lines[1]).toContain("item-1");
    expect(lines[1]).toContain("Ruru");
    expect(lines[1]).toContain("22.00 AUD");
  });

  it("skips items without productUrl", () => {
    const products: Product[] = [
      ...sampleProducts,
      {
        id: "var-2",
        itemId: "item-2",
        name: "No URL Disc",
        description: "",
        price: 2000,
        currency: "AUD",
        imageUrl: "https://example.com/disc.jpg",
        productUrl: undefined,
        quantity: 1,
      },
    ];
    const result = generateTsvFeed(products, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item (not 3)
  });

  it("skips items without images", () => {
    const products: Product[] = [
      ...sampleProducts,
      {
        id: "var-2",
        itemId: "item-2",
        name: "No Image Disc",
        description: "",
        price: 2000,
        currency: "AUD",
        imageUrl: undefined,
        productUrl: "https://example.com/disc",
        quantity: 1,
      },
    ];
    const result = generateTsvFeed(products, config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2); // header + 1 item
  });

  it("escapes tabs and newlines in values", () => {
    const products: Product[] = [
      {
        ...sampleProducts[0],
        description: "Line 1\nLine 2\twith tab",
      },
    ];
    const result = generateTsvFeed(products, config);

    expect(result).not.toContain("\nLine 2");
    expect(result).toContain("Line 1 Line 2 with tab");
  });

  it("handles empty product list", () => {
    const result = generateTsvFeed([], config);
    const lines = result.split("\n");

    expect(lines).toHaveLength(1); // just header
  });
});
