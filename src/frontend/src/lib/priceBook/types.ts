export interface PriceEntry {
  itemId: number;
  itemName: string;
  price: number;
  lastUpdated: number; // timestamp
}

export interface PriceBook {
  [itemId: number]: PriceEntry;
}

export type PricingMode = "live" | "manual";
