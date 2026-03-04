import type { GatheringItem, HusbandryItem, ItemDrop } from "@/lib/api/types";
import type { ConfidenceLevel, OutputItem, ProfitResult } from "./types";

export interface CalculationConfig {
  landMultiplier: number;
  marketFeePercent: number;
  getPrice: (itemId: number) => number | null;
}

function buildOutputItems(
  drops: ItemDrop[],
  landMultiplier: number,
  quantity: number,
  getPrice: (itemId: number) => number | null,
): OutputItem[] {
  return drops.map((drop) => {
    const countMin = drop.count[0];
    const countMax = drop.count[1];
    const avgCount = (countMin + countMax) / 2;
    const yieldPerHarvest = avgCount * landMultiplier * quantity;
    const price = getPrice(drop.id);
    const revenueContribution = price !== null ? yieldPerHarvest * price : 0;
    return {
      itemId: drop.id,
      itemName: drop.name,
      countMin,
      countMax,
      avgCount,
      yieldPerHarvest,
      price,
      revenueContribution,
    };
  });
}

function computeConfidence(outputItems: OutputItem[]): {
  confidence: ConfidenceLevel;
  missingPrices: string[];
} {
  const missing = outputItems
    .filter((o) => o.price === null)
    .map((o) => o.itemName);

  let confidence: ConfidenceLevel;
  if (missing.length === 0) {
    confidence = "high";
  } else if (missing.length < outputItems.length) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { confidence, missingPrices: missing };
}

export function calculateGatheringProfit(
  item: GatheringItem,
  quantity: number,
  config: CalculationConfig,
): ProfitResult {
  const { landMultiplier, marketFeePercent, getPrice } = config;

  const outputItems = buildOutputItems(
    item.items,
    landMultiplier,
    quantity,
    getPrice,
  );

  const totalRevenue = outputItems.reduce(
    (sum, o) => sum + o.revenueContribution,
    0,
  );
  const netRevenue = totalRevenue * (1 - marketFeePercent / 100);

  const profitPerHarvest = netRevenue;
  const profitPerHour =
    item.growingTime > 0 ? (netRevenue / item.growingTime) * 3600 : null;

  const { confidence, missingPrices } = computeConfidence(outputItems);

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    skillRequired: item.skillRequired,
    growingTime: item.growingTime,
    experience: item.experience,
    quantity,
    outputItems,
    totalRevenue,
    netRevenue,
    profitPerHarvest,
    profitPerHour,
    confidence,
    missingPrices,
  };
}

export function calculateHusbandryProfit(
  item: HusbandryItem,
  mode: "gathering" | "butchering",
  quantity: number,
  config: CalculationConfig,
): ProfitResult {
  const { landMultiplier, marketFeePercent, getPrice } = config;

  const drops =
    mode === "gathering" ? item.items.gathering : item.items.butchering;
  const time =
    mode === "gathering" ? item.time.gathering : item.time.butchering;

  const outputItems = buildOutputItems(
    drops ?? [],
    landMultiplier,
    quantity,
    getPrice,
  );

  const totalRevenue = outputItems.reduce(
    (sum, o) => sum + o.revenueContribution,
    0,
  );
  const netRevenue = totalRevenue * (1 - marketFeePercent / 100);
  const profitPerHarvest = netRevenue;
  const profitPerHour = time > 0 ? (netRevenue / time) * 3600 : null;

  const { confidence, missingPrices } = computeConfidence(outputItems);

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    skillRequired: item.skillRequired,
    growingTime: time,
    experience: item.experience ?? 0,
    quantity,
    outputItems,
    totalRevenue,
    netRevenue,
    profitPerHarvest,
    profitPerHour,
    confidence,
    missingPrices,
  };
}
