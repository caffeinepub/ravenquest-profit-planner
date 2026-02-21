import type {
  ProfitResult,
  GatheringProfitInput,
  HusbandryProfitInput,
  CraftingProfitInput,
  ConfidenceLevel,
} from "./types";

interface CalculationConfig {
  landMultiplier: number;
  marketFeePercent: number;
  craftingFee: number;
  listingFee: number;
  includeOpportunityCost: boolean;
  getPrice: (itemId: number) => number | null;
}

function calculateConfidence(
  hasAllInputPrices: boolean,
  hasAllOutputPrices: boolean,
): ConfidenceLevel {
  if (hasAllInputPrices && hasAllOutputPrices) {
    return "high";
  } else if (hasAllOutputPrices) {
    return "medium";
  } else {
    return "low";
  }
}

export function calculateGatheringProfit(
  input: GatheringProfitInput,
  config: CalculationConfig,
): ProfitResult {
  const { landMultiplier, marketFeePercent, getPrice } = config;

  // Calculate average yield for each output item
  const outputBreakdown = input.items.map((item) => {
    const avgYield = ((item.min + item.max) / 2) * landMultiplier;
    const price = getPrice(item.itemId);
    return {
      itemId: item.itemId,
      itemName: item.name,
      amount: avgYield,
      price,
    };
  });

  // Input cost for gathering is typically 0 (no seed cost in most cases)
  const inputCosts = 0;
  const inputBreakdown: Array<{
    itemId: number;
    itemName: string;
    amount: number;
    price: number | null;
  }> = [];

  // Calculate total output value
  const outputValue = outputBreakdown.reduce((sum, output) => {
    if (output.price !== null) {
      return sum + output.amount * output.price;
    }
    return sum;
  }, 0);

  // Apply market fee
  const netOutputValue = outputValue * (1 - marketFeePercent / 100);

  // Calculate profit
  const profit = netOutputValue - inputCosts;
  const profitMargin =
    outputValue > 0 ? ((profit / outputValue) * 100) : 0;

  // Profit per hour (if time is available)
  const profitPerTime = input.growingTime > 0
    ? (profit / input.growingTime) * 3600
    : undefined;

  // Profit per slot (same as profit per harvest for gathering)
  const profitPerSlot = profit;

  // Confidence
  const hasAllOutputPrices = outputBreakdown.every((o) => o.price !== null);
  const confidence = calculateConfidence(true, hasAllOutputPrices);

  const missingPrices = outputBreakdown
    .filter((o) => o.price === null)
    .map((o) => o.itemName);

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    skillRequired: input.skillRequired,
    inputCosts,
    inputBreakdown,
    outputValue: netOutputValue,
    outputBreakdown,
    profit,
    profitMargin,
    profitPerTime,
    profitPerSlot,
    time: input.growingTime,
    experience: input.experience,
    confidence,
    missingPrices,
  };
}

export function calculateHusbandryProfit(
  input: HusbandryProfitInput,
  mode: "gathering" | "butchering",
  config: CalculationConfig,
): ProfitResult {
  const { landMultiplier, marketFeePercent, getPrice } = config;

  const items = mode === "gathering" ? input.items.gathering : input.items.butchering;
  const time = mode === "gathering" ? input.time.gathering : input.time.butchering;

  // Calculate average yield for each output item
  const outputBreakdown = items.map((item) => {
    const avgYield = ((item.min + item.max) / 2) * landMultiplier;
    const price = getPrice(item.itemId);
    return {
      itemId: item.itemId,
      itemName: item.name,
      amount: avgYield,
      price,
    };
  });

  // Input cost for husbandry is typically 0
  const inputCosts = 0;
  const inputBreakdown: Array<{
    itemId: number;
    itemName: string;
    amount: number;
    price: number | null;
  }> = [];

  // Calculate total output value
  const outputValue = outputBreakdown.reduce((sum, output) => {
    if (output.price !== null) {
      return sum + output.amount * output.price;
    }
    return sum;
  }, 0);

  // Apply market fee
  const netOutputValue = outputValue * (1 - marketFeePercent / 100);

  // Calculate profit
  const profit = netOutputValue - inputCosts;
  const profitMargin =
    outputValue > 0 ? ((profit / outputValue) * 100) : 0;

  // Profit per hour
  const profitPerTime = time > 0 ? (profit / time) * 3600 : undefined;

  // Profit per slot
  const profitPerSlot = profit;

  // Confidence
  const hasAllOutputPrices = outputBreakdown.every((o) => o.price !== null);
  const confidence = calculateConfidence(true, hasAllOutputPrices);

  const missingPrices = outputBreakdown
    .filter((o) => o.price === null)
    .map((o) => o.itemName);

  return {
    id: input.id,
    name: `${input.name} (${mode})`,
    category: input.category,
    skillRequired: input.skillRequired,
    inputCosts,
    inputBreakdown,
    outputValue: netOutputValue,
    outputBreakdown,
    profit,
    profitMargin,
    profitPerTime,
    profitPerSlot,
    time,
    experience: input.experience,
    confidence,
    missingPrices,
  };
}

export function calculateCraftingProfit(
  input: CraftingProfitInput,
  config: CalculationConfig,
): ProfitResult {
  const { marketFeePercent, craftingFee, getPrice, includeOpportunityCost } = config;

  // Calculate input costs
  const inputBreakdown = input.materials.map((mat) => {
    const price = getPrice(mat.itemId);
    return {
      itemId: mat.itemId,
      itemName: mat.name,
      amount: mat.amount,
      price,
    };
  });

  const inputCosts = inputBreakdown.reduce((sum, mat) => {
    if (mat.price !== null) {
      return sum + mat.amount * mat.price;
    }
    return sum;
  }, 0) + craftingFee;

  // Calculate output value
  const outputPrice = getPrice(input.itemId);
  const outputBreakdown = [
    {
      itemId: input.itemId,
      itemName: input.name,
      amount: input.amount,
      price: outputPrice,
    },
  ];

  const outputValue = outputPrice !== null
    ? input.amount * outputPrice
    : 0;

  // Apply market fee
  const netOutputValue = outputValue * (1 - marketFeePercent / 100);

  // Opportunity cost adjustment
  let adjustedInputCosts = inputCosts;
  if (includeOpportunityCost) {
    // If materials can be sold, add their sell value as opportunity cost
    const opportunityCost = inputBreakdown.reduce((sum, mat) => {
      if (mat.price !== null) {
        return sum + mat.amount * mat.price * (1 - marketFeePercent / 100);
      }
      return sum;
    }, 0);
    adjustedInputCosts = Math.max(inputCosts, opportunityCost);
  }

  // Calculate profit
  const profit = netOutputValue - adjustedInputCosts;
  const profitMargin =
    netOutputValue > 0 ? ((profit / netOutputValue) * 100) : 0;

  // Confidence
  const hasAllInputPrices = inputBreakdown.every((i) => i.price !== null);
  const hasAllOutputPrices = outputPrice !== null;
  const confidence = calculateConfidence(hasAllInputPrices, hasAllOutputPrices);

  const missingPrices = [
    ...inputBreakdown.filter((i) => i.price === null).map((i) => i.itemName),
    ...(outputPrice === null ? [input.name] : []),
  ];

  return {
    id: input.itemId,
    name: input.name,
    category: input.category,
    skillRequired: input.level,
    inputCosts: adjustedInputCosts,
    inputBreakdown,
    outputValue: netOutputValue,
    outputBreakdown,
    profit,
    profitMargin,
    profitPerTime: undefined,
    profitPerSlot: undefined,
    time: undefined,
    experience: input.experience,
    confidence,
    missingPrices,
  };
}
