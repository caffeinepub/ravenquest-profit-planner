import type {
  FarmingItem,
  HerbalismItem,
  WoodcuttingItem,
  HusbandryItem,
  CraftingRecipe,
  Item,
  SwaggerDoc,
} from "./types";

const API_BASE_URL = "https://api.ravendawn.online/v1";
const SWAGGER_URL = "https://api.ravendawn.online/swagger/doc.json";

// Rate limiting: simple in-memory tracker
const rateLimitTracker = {
  requestCount: 0,
  windowStart: Date.now(),
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

function checkRateLimit() {
  const now = Date.now();
  if (now - rateLimitTracker.windowStart > rateLimitTracker.windowMs) {
    // Reset window
    rateLimitTracker.requestCount = 0;
    rateLimitTracker.windowStart = now;
  }

  if (rateLimitTracker.requestCount >= rateLimitTracker.maxRequests) {
    throw new Error("Rate limit exceeded. Please wait a moment.");
  }

  rateLimitTracker.requestCount++;
}

async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  backoff = 1000,
): Promise<T> {
  checkRateLimit();

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded by server. Please wait.");
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry<T>(url, retries - 1, backoff * 2);
    }
    throw error;
  }
}

// Profession endpoints
export async function fetchFarming(): Promise<FarmingItem[]> {
  return fetchWithRetry<FarmingItem[]>(`${API_BASE_URL}/professions/farming`);
}

export async function fetchHerbalism(): Promise<HerbalismItem[]> {
  return fetchWithRetry<HerbalismItem[]>(
    `${API_BASE_URL}/professions/herbalism`,
  );
}

export async function fetchWoodcutting(): Promise<WoodcuttingItem[]> {
  return fetchWithRetry<WoodcuttingItem[]>(
    `${API_BASE_URL}/professions/woodcutting`,
  );
}

export async function fetchHusbandry(): Promise<HusbandryItem[]> {
  return fetchWithRetry<HusbandryItem[]>(
    `${API_BASE_URL}/professions/husbandry`,
  );
}

export async function fetchFishing(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/professions/fishing`);
}

export async function fetchMining(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/professions/mining`);
}

// Crafting professions
export async function fetchAlchemy(): Promise<CraftingRecipe[]> {
  return fetchWithRetry<CraftingRecipe[]>(
    `${API_BASE_URL}/professions/alchemy`,
  );
}

export async function fetchBlacksmithing(): Promise<CraftingRecipe[]> {
  return fetchWithRetry<CraftingRecipe[]>(
    `${API_BASE_URL}/professions/blacksmithing`,
  );
}

export async function fetchCarpentry(): Promise<CraftingRecipe[]> {
  return fetchWithRetry<CraftingRecipe[]>(
    `${API_BASE_URL}/professions/carpentry`,
  );
}

export async function fetchCooking(): Promise<CraftingRecipe[]> {
  return fetchWithRetry<CraftingRecipe[]>(
    `${API_BASE_URL}/professions/cooking`,
  );
}

export async function fetchWeaving(): Promise<CraftingRecipe[]> {
  return fetchWithRetry<CraftingRecipe[]>(
    `${API_BASE_URL}/professions/weaving`,
  );
}

// All crafting professions combined
export async function fetchAllCrafting(): Promise<CraftingRecipe[]> {
  const [alchemy, blacksmithing, carpentry, cooking, weaving] =
    await Promise.all([
      fetchAlchemy(),
      fetchBlacksmithing(),
      fetchCarpentry(),
      fetchCooking(),
      fetchWeaving(),
    ]);

  return [
    ...alchemy.map((r) => ({ ...r, profession: "Alchemy" })),
    ...blacksmithing.map((r) => ({ ...r, profession: "Blacksmithing" })),
    ...carpentry.map((r) => ({ ...r, profession: "Carpentry" })),
    ...cooking.map((r) => ({ ...r, profession: "Cooking" })),
    ...weaving.map((r) => ({ ...r, profession: "Weaving" })),
  ];
}

// Items and consumables
export async function fetchItems(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/items`);
}

export async function fetchCharms(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/items/charms`);
}

export async function fetchTrinkets(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/items/trinkets`);
}

export async function fetchWhetstones(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/items/whetstones`);
}

export async function fetchFoods(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/consumables/foods`);
}

export async function fetchPotions(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/consumables/potions`);
}

export async function fetchRations(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/consumables/rations`);
}

export async function fetchTonics(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/consumables/tonics`);
}

export async function fetchTreats(): Promise<Item[]> {
  return fetchWithRetry<Item[]>(`${API_BASE_URL}/consumables/treats`);
}

// Game data
export async function fetchArchetypes(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/archetypes`);
}

export async function fetchClasses(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/archetypes/classes`);
}

export async function fetchColors(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/archetypes/colors`);
}

export async function fetchRegions(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/regions`);
}

export async function fetchSpells(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells`);
}

export async function fetchCraftingAbilities(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/crafting-abilities`);
}

export async function fetchFishingAbilities(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/fishing-abilities`);
}

export async function fetchLegacySkills(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/legacy-skills`);
}

export async function fetchMountSkills(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/mount-skills`);
}

export async function fetchPassives(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/passives`);
}

export async function fetchWeaponSkills(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/spells/weapon-skills`);
}

export async function fetchCreatures(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/creatures`);
}

export async function fetchRavencards(): Promise<unknown[]> {
  return fetchWithRetry<unknown[]>(`${API_BASE_URL}/ravencards`);
}

// Swagger documentation
export async function fetchSwaggerDoc(): Promise<SwaggerDoc> {
  return fetchWithRetry<SwaggerDoc>(SWAGGER_URL);
}

// Generic endpoint fetcher for API Explorer
export async function fetchEndpoint(path: string): Promise<unknown> {
  const url = path.startsWith("http")
    ? path
    : `https://api.ravendawn.online${path}`;
  return fetchWithRetry<unknown>(url);
}
