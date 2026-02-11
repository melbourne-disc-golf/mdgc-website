/**
 * Types for Square Catalog and Inventory APIs
 * Based on: https://developer.squareup.com/reference/square/catalog-api
 */

// --- Square API Response Types ---

export interface SquareMoney {
  amount: number; // in smallest currency unit (cents)
  currency: string;
}

export interface SquareImage {
  type: "IMAGE";
  id: string;
  image_data: {
    url: string;
    caption?: string;
  };
}

export interface SquareItemVariationData {
  item_id: string;
  name: string;
  sku?: string;
  ordinal?: number;
  pricing_type: "FIXED_PRICING" | "VARIABLE_PRICING";
  price_money?: SquareMoney;
  track_inventory?: boolean;
  sellable?: boolean;
  stockable?: boolean;
}

export interface SquareItemVariation {
  type: "ITEM_VARIATION";
  id: string;
  item_variation_data: SquareItemVariationData;
}

export interface SquareEcomSeoData {
  page_title?: string;
  page_description?: string;
  permalink?: string;
}

export interface SquareItemData {
  name: string;
  description?: string;
  category_id?: string;
  image_ids?: string[];
  variations?: SquareItemVariation[];
  product_type?: string;
  is_archived?: boolean;
  ecom_uri?: string; // Deprecated but may contain product URL
  ecom_seo_data?: SquareEcomSeoData;
}

export interface SquareCatalogItem {
  type: "ITEM";
  id: string;
  updated_at: string;
  is_deleted?: boolean;
  item_data: SquareItemData;
}

export interface SquareCatalogCategory {
  type: "CATEGORY";
  id: string;
  category_data: {
    name: string;
  };
}

export type SquareCatalogObject =
  | SquareCatalogItem
  | SquareImage
  | SquareCatalogCategory;

export interface SquareListCatalogResponse {
  objects?: SquareCatalogObject[];
  cursor?: string;
  errors?: SquareError[];
}

export interface SquareBatchRetrieveResponse {
  objects?: SquareCatalogObject[];
  errors?: SquareError[];
}

export interface SquareInventoryCount {
  catalog_object_id: string;
  catalog_object_type: string;
  state: "IN_STOCK" | "SOLD" | "RETURNED_BY_CUSTOMER" | "WASTE" | "NONE";
  location_id: string;
  quantity: string; // decimal string
  calculated_at: string;
}

export interface SquareInventoryCountsResponse {
  counts?: SquareInventoryCount[];
  cursor?: string;
  errors?: SquareError[];
}

export interface SquareError {
  category: string;
  code: string;
  detail?: string;
  field?: string;
}

// --- Output Types (our intermediate format) ---

/**
 * A normalized product record, extracted from Square data.
 * This is the format we store in src/data/ for use at build time.
 */
export interface Product {
  id: string; // Square variation ID
  itemId: string; // Square item ID (for building URLs)
  name: string;
  description: string;
  sku?: string;
  price: number; // cents
  currency: string;
  imageUrl?: string;
  category?: string;
  quantity: number;
  productUrl?: string; // Square Online product page URL (if available)
  permalink?: string; // SEO permalink/slug (if available)
}

/**
 * The complete inventory data file structure.
 */
export interface InventoryData {
  fetchedAt: string;
  products: Product[];
}
