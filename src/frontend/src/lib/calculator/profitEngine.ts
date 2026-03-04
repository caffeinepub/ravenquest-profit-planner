import type {
  CraftingRecipe,
  GatheringItem,
  HusbandryItem,
  ItemDrop,
} from "@/lib/api/types";
import type { ConfidenceLevel, OutputItem, ProfitResult } from "./types";

// ─── Crafting Types ────────────────────────────────────────────────────────────

export interface CraftingCalcConfig {
  marketFeePercent: number;
  craftTaxPercent: number;
  getPrice: (itemId: number) => number | null;
}

export interface CraftingInputItem {
  itemId: number;
  itemName: string;
  amount: number;
  price: number | null;
  totalCost: number;
}

export type CraftVerdict = "craft" | "sell_raw" | "even" | "unknown";

export interface CraftingProfitResult {
  recipeId: number;
  recipeName: string;
  profession: string;
  level: number;
  experience: number;
  outputQty: number;
  outputPrice: number | null;
  outputValue: number;
  inputs: CraftingInputItem[];
  totalInputCost: number;
  craftTax: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  profitPerUnit: number;
  confidence: ConfidenceLevel;
  missingPrices: string[];
  // Sell vs Craft comparison
  sellRawValue: number; // sum of (mat.amount × mat.price × (1 - fee)) for all priced inputs
  craftAdvantage: number; // craft profit - sellRaw profit (positive = craft is better)
  verdict: CraftVerdict; // "unknown" if prices missing
}

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

export function calculateCraftingProfit(
  recipe: CraftingRecipe,
  config: CraftingCalcConfig,
): CraftingProfitResult {
  const { marketFeePercent, craftTaxPercent, getPrice } = config;

  const inputs: CraftingInputItem[] = recipe.materials.map((mat) => {
    const price = getPrice(mat.itemId);
    const totalCost = price !== null ? mat.amount * price : 0;
    return {
      itemId: mat.itemId,
      itemName: mat.name,
      amount: mat.amount,
      price,
      totalCost,
    };
  });

  const outputPrice = getPrice(recipe.itemId);
  const totalInputCost = inputs.reduce((sum, i) => sum + i.totalCost, 0);
  const craftTax = totalInputCost * (craftTaxPercent / 100);
  const totalCost = totalInputCost + craftTax;

  const outputValue =
    outputPrice !== null
      ? recipe.amount * outputPrice * (1 - marketFeePercent / 100)
      : 0;

  const profit = outputValue - totalCost;
  const profitMargin = outputValue > 0 ? (profit / outputValue) * 100 : 0;
  const profitPerUnit = recipe.amount > 0 ? profit / recipe.amount : 0;

  // Determine confidence
  const missingPrices: string[] = [];
  if (outputPrice === null) missingPrices.push(recipe.name);
  for (const inp of inputs) {
    if (inp.price === null) missingPrices.push(inp.itemName);
  }

  let confidence: ConfidenceLevel;
  const totalItems = recipe.materials.length + 1; // +1 for output
  const missingCount = missingPrices.length;
  if (missingCount === 0) {
    confidence = "high";
  } else if (missingCount < totalItems) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // ── Sell vs Craft comparison ─────────────────────────────────────────────
  // sellRawValue: what you'd earn by selling all materials directly on market
  const allMaterialsPriced = inputs.every((i) => i.price !== null);
  const sellRawValue = inputs.reduce((sum, i) => {
    if (i.price === null) return sum;
    return sum + i.amount * i.price * (1 - marketFeePercent / 100);
  }, 0);

  let verdict: CraftVerdict;
  let craftAdvantage: number;

  if (!allMaterialsPriced || outputPrice === null) {
    verdict = "unknown";
    craftAdvantage = 0;
  } else {
    // craft profit = outputValue - totalCost (totalCost includes craft tax)
    const craftProfit = outputValue - totalCost;
    // sellRaw profit = sellRawValue (materials cost 0 since you gathered them)
    craftAdvantage = craftProfit - sellRawValue;

    const NOISE_THRESHOLD = 10;
    if (craftAdvantage > NOISE_THRESHOLD) {
      verdict = "craft";
    } else if (craftAdvantage < -NOISE_THRESHOLD) {
      verdict = "sell_raw";
    } else {
      verdict = "even";
    }
  }

  return {
    recipeId: recipe.itemId,
    recipeName: recipe.name,
    profession: recipe.profession ?? "Unknown",
    level: recipe.level,
    experience: recipe.experience,
    outputQty: recipe.amount,
    outputPrice,
    outputValue,
    inputs,
    totalInputCost,
    craftTax,
    totalCost,
    profit,
    profitMargin,
    profitPerUnit,
    confidence,
    missingPrices,
    sellRawValue,
    craftAdvantage,
    verdict,
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
