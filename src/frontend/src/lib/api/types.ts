// API Response Types based on actual Ravendawn API responses

export interface ItemDrop {
  id: number;
  name: string;
  count: [number, number]; // [min, max]
}

export interface GatheringItem {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  growingTime: number; // seconds
  items: ItemDrop[];
  category?: string;
}

// Aliases for each gathering type
export type FarmingItem = GatheringItem;
export type HerbalismItem = GatheringItem;
export type WoodcuttingItem = GatheringItem;

export interface HusbandryTime {
  gathering: number; // seconds (0 means mode not available)
  butchering: number; // seconds (0 means mode not available)
}

export interface HusbandryItem {
  id: number;
  name: string;
  skillRequired: number;
  experience?: number;
  time: HusbandryTime;
  items: {
    gathering: ItemDrop[] | null;
    butchering: ItemDrop[] | null;
  };
  category?: string;
}

export interface CraftingMaterial {
  itemId: number;
  amount: number;
  name: string;
}

export interface CraftingRecipe {
  itemId: number;
  name: string;
  amount: number;
  category: string;
  description: string;
  durability?: number;
  experience: number;
  level: number;
  materials: CraftingMaterial[];
  progress?: number;
  quality?: string;
  profession?: string;
}

export interface Item {
  id: number;
  name: string;
  description?: string;
  category?: string;
  rarity?: string;
  [key: string]: unknown;
}

export interface ApiEndpoint {
  path: string;
  method: string;
  category: string;
  description: string;
}

// Swagger documentation structure
export interface SwaggerPath {
  get?: {
    tags?: string[];
    summary?: string;
    description?: string;
    responses?: Record<string, unknown>;
  };
  post?: {
    tags?: string[];
    summary?: string;
    description?: string;
    responses?: Record<string, unknown>;
  };
}

export interface SwaggerDoc {
  paths: Record<string, SwaggerPath>;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
}
