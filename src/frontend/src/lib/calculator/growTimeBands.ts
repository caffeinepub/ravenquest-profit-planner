import type { GatheringItem, HusbandryItem } from "@/lib/api/types";
import {
  type CalculationConfig,
  calculateGatheringProfit,
} from "@/lib/calculator/profitEngine";

export type BandKey = "FAST" | "ACTIVE" | "MID" | "SLEEP" | "AWAY";
export type PlayerStatus = "active" | "sleeping" | "away";

export interface GrowTimeBand {
  key: BandKey;
  label: string;
  minHours: number;
  maxHours: number | null;
  description: string;
  playerStatus: PlayerStatus;
  /** Tailwind color name used for accent styling */
  color: string;
  /** Emoji icon for visual identity */
  icon: string;
  /** Human-readable time range label */
  rangeLabel: string;
}

export const GROW_TIME_BANDS: GrowTimeBand[] = [
  {
    key: "FAST",
    label: "FAST",
    minHours: 0,
    maxHours: 2,
    description: "Quick turnaround, plant & harvest rapidly",
    playerStatus: "active",
    color: "emerald",
    icon: "⚡",
    rangeLabel: "1–2h",
  },
  {
    key: "ACTIVE",
    label: "ACTIVE",
    minHours: 2,
    maxHours: 6,
    description: "Best while you're at your desk playing",
    playerStatus: "active",
    color: "sky",
    icon: "🎯",
    rangeLabel: "2–6h",
  },
  {
    key: "MID",
    label: "MID",
    minHours: 6,
    maxHours: 8,
    description: "Half-day cycles, check in twice a day",
    playerStatus: "active",
    color: "violet",
    icon: "🌤",
    rangeLabel: "6–8h",
  },
  {
    key: "SLEEP",
    label: "SLEEP",
    minHours: 8,
    maxHours: 16,
    description: "Plant before bed, harvest when you wake",
    playerStatus: "sleeping",
    color: "indigo",
    icon: "🌙",
    rangeLabel: "8–16h",
  },
  {
    key: "AWAY",
    label: "AWAY",
    minHours: 16,
    maxHours: null,
    description: "Long sessions away, maximise idle time",
    playerStatus: "away",
    color: "amber",
    icon: "🚀",
    rangeLabel: "16h+",
  },
];

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  sleeping: "Sleeping",
  away: "Away",
};

export const PLAYER_STATUS_BAND: Record<PlayerStatus, BandKey> = {
  active: "ACTIVE",
  sleeping: "SLEEP",
  away: "AWAY",
};

export interface BandStats {
  band: GrowTimeBand;
  avgSilverPerHour: number;
  topSilverPerHour: number;
  totalPotentialSilver: number;
  itemCount: number;
  pricedItemCount: number;
  hasData: boolean;
}

export function getBandForItem(growingTimeSecs: number): BandKey {
  const hours = growingTimeSecs / 3600;
  if (hours <= 2) return "FAST";
  if (hours <= 6) return "ACTIVE";
  if (hours <= 8) return "MID";
  if (hours <= 16) return "SLEEP";
  return "AWAY";
}

/**
 * Convert a HusbandryItem gathering mode to a GatheringItem-compatible shape.
 */
export function husbandryToGathering(
  item: HusbandryItem,
): GatheringItem | null {
  const drops = item.items.gathering;
  const time = item.time.gathering;
  if (!drops || drops.length === 0 || time <= 0) return null;
  return {
    id: item.id,
    name: item.name,
    skillRequired: item.skillRequired,
    experience: item.experience ?? 0,
    growingTime: time,
    items: drops,
    category: item.category,
  };
}

export function computeBandStats(
  allItems: GatheringItem[],
  config: CalculationConfig,
): BandStats[] {
  // Group items by band
  const grouped: Record<BandKey, GatheringItem[]> = {
    FAST: [],
    ACTIVE: [],
    MID: [],
    SLEEP: [],
    AWAY: [],
  };

  for (const item of allItems) {
    if (item.growingTime <= 0) continue;
    const key = getBandForItem(item.growingTime);
    grouped[key].push(item);
  }

  return GROW_TIME_BANDS.map((band) => {
    const items = grouped[band.key];
    const results = items.map((item) =>
      calculateGatheringProfit(item, 1, config),
    );

    const priced = results.filter(
      (r) =>
        r.confidence !== "low" &&
        r.profitPerHour !== null &&
        r.profitPerHour > 0,
    );

    const avgSilverPerHour =
      priced.length > 0
        ? priced.reduce((s, r) => s + (r.profitPerHour ?? 0), 0) / priced.length
        : 0;

    const topSilverPerHour =
      priced.length > 0
        ? Math.max(...priced.map((r) => r.profitPerHour ?? 0))
        : 0;

    const totalPotentialSilver = priced.reduce(
      (s, r) => s + r.profitPerHarvest,
      0,
    );

    return {
      band,
      avgSilverPerHour,
      topSilverPerHour,
      totalPotentialSilver,
      itemCount: items.length,
      pricedItemCount: priced.length,
      hasData: priced.length > 0,
    };
  });
}
