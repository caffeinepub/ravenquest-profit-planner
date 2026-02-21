// API Response Types based on Ravendawn API schema

export interface ItemDrop {
  itemId: number;
  min: number;
  max: number;
  name: string;
}

export interface FarmingItem {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  growingTime: number; // in seconds
  items: ItemDrop[];
  category?: string;
}

export interface HerbalismItem {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  growingTime: number; // in seconds
  items: ItemDrop[];
  category?: string;
}

export interface WoodcuttingItem {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  growingTime: number; // in seconds
  items: ItemDrop[];
  category?: string;
}

export interface HusbandryTime {
  gathering: number;
  butchering: number;
}

export interface HusbandryItems {
  gathering: ItemDrop[];
  butchering: ItemDrop[];
}

export interface HusbandryItem {
  id: number;
  name: string;
  skillRequired: number;
  experience: number;
  time: HusbandryTime;
  items: HusbandryItems;
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
