export type ConfidenceLevel = "high" | "medium" | "low";

export interface ProfitResult {
  // Identification
  id: number;
  name: string;
  category?: string;
  skillRequired: number;
  
  // Inputs
  inputCosts: number;
  inputBreakdown: Array<{ itemId: number; itemName: string; amount: number; price: number | null }>;
  
  // Outputs
  outputValue: number;
  outputBreakdown: Array<{ itemId: number; itemName: string; amount: number; price: number | null }>;
  
  // Profit metrics
  profit: number;
  profitMargin: number; // percentage
  profitPerTime?: number; // profit per hour
  profitPerSlot?: number; // profit per land/pen slot
  
  // Metadata
  time?: number; // in seconds
  experience: number;
  confidence: ConfidenceLevel;
  missingPrices: string[]; // item names missing prices
}

export interface GatheringProfitInput {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  growingTime: number; // in seconds
  items: Array<{ itemId: number; min: number; max: number; name: string }>;
  category?: string;
}

export interface HusbandryProfitInput {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  time: { gathering: number; butchering: number };
  items: {
    gathering: Array<{ itemId: number; min: number; max: number; name: string }>;
    butchering: Array<{ itemId: number; min: number; max: number; name: string }>;
  };
  category?: string;
}

export interface CraftingProfitInput {
  itemId: number;
  name: string;
  amount: number;
  category: string;
  experience: number;
  level: number;
  materials: Array<{ itemId: number; amount: number; name: string }>;
  profession?: string;
}
