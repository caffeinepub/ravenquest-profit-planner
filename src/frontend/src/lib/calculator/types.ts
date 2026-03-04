export type ConfidenceLevel = "high" | "medium" | "low";

export interface OutputItem {
  itemId: number;
  itemName: string;
  countMin: number;
  countMax: number;
  avgCount: number;
  yieldPerHarvest: number; // avgCount * landMultiplier * quantity
  price: number | null;
  revenueContribution: number; // yieldPerHarvest * price (0 if no price)
}

export interface ProfitResult {
  // Identification
  id: number;
  name: string;
  category?: string;
  skillRequired: number;

  // Time
  growingTime: number; // seconds
  experience: number;

  // Quantity
  quantity: number; // number of plots/pens

  // Outputs (with inline price editing support)
  outputItems: OutputItem[];

  // Profit metrics (computed from outputItems)
  totalRevenue: number; // sum of revenueContribution before fee
  netRevenue: number; // totalRevenue * (1 - marketFeePercent/100)
  profitPerHarvest: number; // netRevenue
  profitPerHour: number | null; // netRevenue / (growingTime / 3600), null if no time

  // Confidence
  confidence: ConfidenceLevel;
  missingPrices: string[]; // item names missing prices
}
