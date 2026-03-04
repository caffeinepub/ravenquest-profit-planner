import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFarming,
  useHerbalism,
  useHusbandry,
  useWoodcutting,
} from "@/hooks/useQueries";
import type { GatheringItem, HusbandryItem, ItemDrop } from "@/lib/api/types";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { cn } from "@/lib/utils";
import type { LandSize } from "@/store/configStore";
import { useConfigStore } from "@/store/configStore";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Grid3X3,
  Home,
  Info,
  Layers,
  Package,
  Sparkles,
  TreePine,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Land Tier Data ────────────────────────────────────────────────────────────

interface LandTier {
  id: LandSize;
  name: string;
  rarityRange: string;
  multiplier: number;
  grid: { w: number; h: number };
  house: { w: number; h: number };
  tradepacks: number;
  discordTitle: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
  emoji: string;
}

const LAND_TIERS: LandTier[] = [
  {
    id: "small",
    name: "Small Estate",
    rarityRange: "Common – Rare",
    multiplier: 1,
    grid: { w: 10, h: 10 },
    house: { w: 8, h: 6 },
    tradepacks: 1,
    discordTitle: "Pilgrim",
    colorClass: "emerald",
    borderClass: "border-emerald-500/60",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    badgeClass:
      "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25",
    emoji: "🌿",
  },
  {
    id: "medium",
    name: "Medium Estate",
    rarityRange: "Uncommon – Mythic",
    multiplier: 2,
    grid: { w: 12, h: 12 },
    house: { w: 8, h: 6 },
    tradepacks: 5,
    discordTitle: "Pioneer",
    colorClass: "blue",
    borderClass: "border-blue-500/60",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-400",
    badgeClass:
      "bg-blue-500/15 text-blue-300 border-blue-500/40 hover:bg-blue-500/25",
    emoji: "🏡",
  },
  {
    id: "large",
    name: "Large Estate",
    rarityRange: "Grand – Legendary",
    multiplier: 4,
    grid: { w: 15, h: 15 },
    house: { w: 10, h: 12 },
    tradepacks: 25,
    discordTitle: "Baron",
    colorClass: "violet",
    borderClass: "border-violet-500/60",
    bgClass: "bg-violet-500/10",
    textClass: "text-violet-400",
    badgeClass:
      "bg-violet-500/15 text-violet-300 border-violet-500/40 hover:bg-violet-500/25",
    emoji: "🏰",
  },
  {
    id: "stronghold",
    name: "Stronghold",
    rarityRange: "Rare – Legendary",
    multiplier: 8,
    grid: { w: 22, h: 22 },
    house: { w: 17, h: 18 },
    tradepacks: 125,
    discordTitle: "Noble",
    colorClass: "amber",
    borderClass: "border-amber-500/60",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    badgeClass:
      "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25",
    emoji: "⚔️",
  },
  {
    id: "fort",
    name: "Fort",
    rarityRange: "Arcane – Legendary",
    multiplier: 20,
    grid: { w: 30, h: 30 },
    house: { w: 24, h: 24 },
    tradepacks: 500,
    discordTitle: "Duke",
    colorClass: "rose",
    borderClass: "border-rose-500/60",
    bgClass: "bg-rose-500/10",
    textClass: "text-rose-400",
    badgeClass:
      "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25",
    emoji: "🏯",
  },
];

// ─── Land Perks Data ───────────────────────────────────────────────────────────

const RARITIES = [
  "Common",
  "Uncommon",
  "Grand",
  "Rare",
  "Arcane",
  "Mythic",
  "Legendary",
] as const;

interface LandPerk {
  name: string;
  category: string;
  description: string;
  values: number[];
  unit: string;
}

const LAND_PERKS: LandPerk[] = [
  {
    name: "Angler's Province",
    category: "Fishing",
    description: "Increase experience when Fishing by X%",
    values: [4, 5, 6, 7, 8, 9, 10],
    unit: "%",
  },
  {
    name: "Crop Boon",
    category: "Farming",
    description: "Chance to increase farming material quality by one tier",
    values: [2, 2.5, 3, 3.5, 4, 4.5, 5],
    unit: "%",
  },
  {
    name: "Fishing Ponds",
    category: "Fishing",
    description: "Increase Fish weight by X%",
    values: [5, 6.25, 7.5, 8.75, 10, 11.25, 12.5],
    unit: "%",
  },
  {
    name: "Floral Boon",
    category: "Herbalism",
    description: "Chance to increase herbalism material quality by one tier",
    values: [2, 2.5, 3, 3.5, 4, 4.5, 5],
    unit: "%",
  },
  {
    name: "Forest Fields",
    category: "Woodcutting",
    description: "Increase experience when Woodcutting in Open World by X%",
    values: [4, 5, 6, 7, 8, 9, 10],
    unit: "%",
  },
  {
    name: "Herb Fields",
    category: "Herbalism",
    description: "Increase experience when Gathering Herbs in Open World by X%",
    values: [4, 5, 6, 7, 8, 9, 10],
    unit: "%",
  },
  {
    name: "Livestock Boon",
    category: "Husbandry",
    description: "Chance to increase husbandry material quality by one tier",
    values: [2, 2.5, 3, 3.5, 4, 4.5, 5],
    unit: "%",
  },
  {
    name: "Mixing Grounds",
    category: "Alchemy",
    description: "Increase Alchemy labor per profession level",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "",
  },
  {
    name: "Ore Fields",
    category: "Mining",
    description: "Increase experience when Mining in Open World by X%",
    values: [4, 5, 6, 7, 8, 9, 10],
    unit: "%",
  },
  {
    name: "Prosperous Land",
    category: "Combat",
    description: "Increase Silver dropped from creatures by X%",
    values: [3, 3.75, 4.5, 5.25, 6, 6.75, 7.5],
    unit: "%",
  },
  {
    name: "Sawing Grounds",
    category: "Carpentry",
    description: "Increase Carpentry labor per profession level",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "",
  },
  {
    name: "Seasoning Grounds",
    category: "Cooking",
    description: "Increase Cooking labor per profession level",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "",
  },
  {
    name: "Smithing Grounds",
    category: "Blacksmithing",
    description: "Increase Blacksmithing labor per profession level",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "",
  },
  {
    name: "Threading Grounds",
    category: "Weaving",
    description: "Increase Weaving labor per profession level",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "",
  },
  {
    name: "Timber Boon",
    category: "Woodcutting",
    description: "Chance to increase woodcutting material quality by one tier",
    values: [2, 2.5, 3, 3.5, 4, 4.5, 5],
    unit: "%",
  },
  {
    name: "Treasure Troves",
    category: "Combat",
    description: "Increase drop rate from creatures by X%",
    values: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    unit: "%",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Farming: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Herbalism: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  Woodcutting: "bg-amber-600/15 text-amber-400 border-amber-600/30",
  Husbandry: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Fishing: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Mining: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  Alchemy: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Carpentry: "bg-yellow-600/15 text-yellow-400 border-yellow-600/30",
  Cooking: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Blacksmithing: "bg-slate-300/15 text-slate-200 border-slate-300/30",
  Weaving: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Combat: "bg-red-500/15 text-red-300 border-red-500/30",
};

const RARITY_COLORS = [
  "text-slate-400",
  "text-green-400",
  "text-blue-400",
  "text-violet-400",
  "text-fuchsia-400",
  "text-pink-400",
  "text-amber-400",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTierStats(tier: LandTier) {
  const totalPlots = tier.grid.w * tier.grid.h;
  const housePlots = tier.house.w * tier.house.h;
  const usablePlots = totalPlots - housePlots;
  return { totalPlots, housePlots, usablePlots };
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatSilver(num: number): string {
  if (!Number.isFinite(num)) return "—";
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function S() {
  return (
    <span className="ml-0.5 font-mono text-[10px] text-amber-400/70">s</span>
  );
}

// ─── Mini Grid Visualizer ─────────────────────────────────────────────────────

function GridVisualizer({ tier }: { tier: LandTier }) {
  // Scale down to max 20×20 for Fort
  const scale = Math.min(1, 20 / Math.max(tier.grid.w, tier.grid.h));
  const cols = Math.round(tier.grid.w * scale);
  const rows = Math.round(tier.grid.h * scale);
  const houseCols = Math.round(tier.house.w * scale);
  const houseRows = Math.round(tier.house.h * scale);

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isHouse = r < houseRows && c < houseCols;
      cells.push(
        <div
          key={`${r}-${c}`}
          title={isHouse ? "House" : "Farm plot"}
          className={cn(
            "rounded-[1px]",
            isHouse
              ? "bg-slate-400/30 border border-slate-400/20"
              : `${tier.bgClass.replace("/10", "/20")} border ${tier.borderClass.replace("/60", "/30")}`,
          )}
        />,
      );
    }
  }

  return (
    <div
      className="rounded border border-border/50 p-1.5 bg-background/50"
      title={`${tier.grid.w}×${tier.grid.h} grid — green=farmable, grey=house`}
    >
      <div
        className="gap-px"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          width: "100%",
          aspectRatio: `${cols} / ${rows}`,
        }}
      >
        {cells}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "h-2 w-2 rounded-[1px]",
              tier.bgClass.replace("/10", "/20"),
            )}
          />
          Farm
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[1px] bg-slate-400/30" />
          House
        </span>
      </div>
    </div>
  );
}

// ─── Land Tier Card ───────────────────────────────────────────────────────────

function LandTierCard({
  tier,
  isActive,
  onClick,
}: {
  tier: LandTier;
  isActive: boolean;
  onClick: () => void;
}) {
  const { totalPlots, housePlots, usablePlots } = getTierStats(tier);

  return (
    <button
      type="button"
      data-ocid={`land.${tier.id}.card`}
      onClick={onClick}
      className={cn(
        "text-left w-full rounded-xl border-2 p-4 transition-all duration-200",
        "hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? `${tier.borderClass} ${tier.bgClass} shadow-lg`
          : "border-border bg-surface-1 hover:border-border/80 hover:bg-surface-2",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{tier.emoji}</span>
            <span
              className={cn(
                "font-display font-bold text-base",
                isActive ? tier.textClass : "text-foreground",
              )}
            >
              {tier.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tier.rarityRange}
          </p>
        </div>
        <Badge
          className={cn(
            "shrink-0 border font-mono text-sm font-bold px-2.5 py-0.5",
            isActive
              ? `${tier.badgeClass} border`
              : "bg-surface-2 text-muted-foreground border-border",
          )}
        >
          {tier.multiplier}×
        </Badge>
      </div>

      <GridVisualizer tier={tier} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Grid3X3 className="h-3 w-3" />
            <span>
              {tier.grid.w}×{tier.grid.h} = {totalPlots} plots
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Home className="h-3 w-3" />
            <span>
              {tier.house.w}×{tier.house.h} = {housePlots} house
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <div
            className={cn(
              "flex items-center gap-1.5 font-semibold",
              isActive ? tier.textClass : "text-foreground",
            )}
          >
            <TreePine className="h-3 w-3" />
            <span>{usablePlots} usable</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>{tier.tradepacks.toLocaleString()} packs/wk</span>
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Discord:{" "}
          <span
            className={cn(
              "font-medium",
              isActive ? tier.textClass : "text-foreground",
            )}
          >
            {tier.discordTitle}
          </span>
        </span>
        {isActive && (
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              tier.textClass,
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            Active
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Unified Item Type ─────────────────────────────────────────────────────────

interface UnifiedItem {
  id: number;
  name: string;
  category: string;
  growingTime: number;
  drops: ItemDrop[];
  skillRequired: number;
}

// ─── Plot Calculator ───────────────────────────────────────────────────────────

function PlotCalculator() {
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const { data: farmingData } = useFarming();
  const { data: herbalismData } = useHerbalism();
  const { data: woodcuttingData } = useWoodcutting();
  const { data: husbandryData } = useHusbandry();

  const [selectedItemKey, setSelectedItemKey] = useState("");
  const [plots, setPlots] = useState(1);

  // Build unified item list
  const allItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];

    for (const item of farmingData ?? []) {
      items.push({
        id: item.id,
        name: item.name,
        category: "Farming",
        growingTime: item.growingTime,
        drops: item.items,
        skillRequired: item.skillRequired,
      });
    }
    for (const item of herbalismData ?? []) {
      items.push({
        id: item.id,
        name: item.name,
        category: "Herbalism",
        growingTime: item.growingTime,
        drops: item.items,
        skillRequired: item.skillRequired,
      });
    }
    for (const item of woodcuttingData ?? []) {
      items.push({
        id: item.id,
        name: item.name,
        category: "Woodcutting",
        growingTime: item.growingTime,
        drops: item.items,
        skillRequired: item.skillRequired,
      });
    }
    for (const husb of husbandryData ?? []) {
      const drops = husb.items.gathering ?? [];
      const time = husb.time.gathering;
      if (drops.length > 0) {
        items.push({
          id: husb.id,
          name: husb.name,
          category: "Husbandry",
          growingTime: time,
          drops,
          skillRequired: husb.skillRequired,
        });
      }
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [farmingData, herbalismData, woodcuttingData, husbandryData]);

  const activeTier =
    LAND_TIERS.find((t) => t.id === config.landSize) ?? LAND_TIERS[1];
  const { usablePlots } = getTierStats(activeTier);

  const selectedItem = useMemo(() => {
    if (!selectedItemKey) return null;
    return (
      allItems.find((i) => `${i.category}-${i.id}` === selectedItemKey) ?? null
    );
  }, [selectedItemKey, allItems]);

  const clampedPlots = Math.min(Math.max(1, plots), usablePlots);

  // Compute outputs
  const outputs = useMemo(() => {
    if (!selectedItem) return null;

    const harvestsIn24h =
      selectedItem.growingTime > 0
        ? Math.floor(86400 / selectedItem.growingTime)
        : 0;

    const dropCalcs = selectedItem.drops.map((drop) => {
      const avgYield = (drop.count[0] + drop.count[1]) / 2;
      const yieldPerHarvest = avgYield * activeTier.multiplier * clampedPlots;
      const yield24h = yieldPerHarvest * harvestsIn24h;
      const price = getPrice(drop.id);
      const revenue24h =
        price !== null
          ? yield24h * price * (1 - config.marketFeePercent / 100)
          : null;
      return {
        itemId: drop.id,
        itemName: drop.name,
        yieldPerHarvest,
        yield24h,
        price,
        revenue24h,
      };
    });

    const totalProfit24h = dropCalcs.every((d) => d.revenue24h !== null)
      ? dropCalcs.reduce((sum, d) => sum + (d.revenue24h ?? 0), 0)
      : dropCalcs.some((d) => d.revenue24h !== null)
        ? dropCalcs.reduce((sum, d) => sum + (d.revenue24h ?? 0), 0)
        : null;

    const pricedCount = dropCalcs.filter((d) => d.price !== null).length;
    const confidence =
      pricedCount === 0
        ? "low"
        : pricedCount < dropCalcs.length
          ? "medium"
          : "high";

    const silverPerPlot24h =
      totalProfit24h !== null && clampedPlots > 0
        ? totalProfit24h / clampedPlots
        : null;

    return {
      harvestsIn24h,
      dropCalcs,
      totalProfit24h,
      silverPerPlot24h,
      confidence,
    };
  }, [
    selectedItem,
    activeTier.multiplier,
    clampedPlots,
    getPrice,
    config.marketFeePercent,
  ]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, UnifiedItem[]>();
    for (const item of allItems) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [allItems]);

  const confidenceBg = {
    high: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    medium: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    low: "bg-muted border-border text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-2/50 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-teal-400" />
        <h2 className="font-display font-bold text-base text-foreground">
          Plot Calculator
        </h2>
        <span className="text-xs text-muted-foreground ml-1">
          — configure land, item & plots to see 24h yield
        </span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left — Controls */}
          <div className="space-y-4">
            {/* Land Tier */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Land Tier
              </Label>
              <Select
                value={config.landSize}
                onValueChange={(v) => config.setLandSize(v as LandSize)}
              >
                <SelectTrigger
                  data-ocid="land.calculator.select"
                  className="bg-surface-2 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAND_TIERS.map((t) => {
                    const { usablePlots: up } = getTierStats(t);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {t.emoji} {t.name} ({t.multiplier}× · {up} usable plots)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {activeTier.name} — {usablePlots} usable farm plots
              </p>
            </div>

            {/* Item Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Crop / Item
              </Label>
              <Select
                value={selectedItemKey}
                onValueChange={setSelectedItemKey}
              >
                <SelectTrigger
                  data-ocid="land.calculator.item_select"
                  className="bg-surface-2 text-sm"
                >
                  <SelectValue placeholder="Select an item…" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(groupedByCategory.entries()).map(
                    ([cat, items]) => (
                      <SelectGroup key={cat}>
                        <SelectLabel>{cat}</SelectLabel>
                        {items.map((item) => (
                          <SelectItem
                            key={`${item.category}-${item.id}`}
                            value={`${item.category}-${item.id}`}
                          >
                            {item.name}
                            {item.skillRequired > 1 && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                (Lv {item.skillRequired})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Plots */}
            <div className="space-y-1.5">
              <Label
                htmlFor="plot-count"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Number of Plots
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="plot-count"
                  data-ocid="land.calculator.input"
                  type="number"
                  min="1"
                  max={usablePlots}
                  value={plots}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value);
                    if (!Number.isNaN(v)) setPlots(v);
                  }}
                  className="bg-surface-2 text-sm w-28"
                />
                <span className="text-sm text-muted-foreground">
                  of {usablePlots} usable
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    activeTier.bgClass.replace("/10", "/40"),
                  )}
                  style={{ width: `${(clampedPlots / usablePlots) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {((clampedPlots / usablePlots) * 100).toFixed(0)}% of available
                plots allocated
              </p>
            </div>
          </div>

          {/* Right — Results */}
          <div>
            {!selectedItem ? (
              <div
                data-ocid="land.calculator.empty_state"
                className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border text-center p-6"
              >
                <div>
                  <Layers className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Select a crop or item above
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    24h yield, harvest info, and profit will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {selectedItem.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedItem.category} · Lv {selectedItem.skillRequired}
                    </div>
                  </div>
                  {outputs && (
                    <Badge
                      className={cn(
                        "border text-xs shrink-0",
                        confidenceBg[outputs.confidence],
                      )}
                    >
                      {outputs.confidence === "high"
                        ? "✓ Priced"
                        : outputs.confidence === "medium"
                          ? "⚠ Partial"
                          : "○ No prices"}
                    </Badge>
                  )}
                </div>

                {/* Harvest info */}
                {outputs && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-surface-2 p-2.5 space-y-0.5">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Harvest Cycle</span>
                      </div>
                      <div className="font-mono font-semibold">
                        {formatTime(selectedItem.growingTime)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface-2 p-2.5 space-y-0.5">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>Harvests / 24h</span>
                      </div>
                      <div className="font-mono font-semibold">
                        {outputs.harvestsIn24h > 0
                          ? `${outputs.harvestsIn24h}×`
                          : "< 1"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Output drops */}
                {outputs && (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 bg-surface-2/60">
                          <th className="py-1.5 pl-3 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Output
                          </th>
                          <th className="py-1.5 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Yield/harvest
                          </th>
                          <th className="py-1.5 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            24h yield
                          </th>
                          <th className="py-1.5 pr-3 pl-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {outputs.dropCalcs.map((drop) => (
                          <tr
                            key={drop.itemId}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="py-2 pl-3 pr-2">
                              <div className="font-medium">{drop.itemName}</div>
                              {drop.price === null && (
                                <div className="text-[10px] text-amber-400/70 flex items-center gap-0.5">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  Set price in Price Book
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums">
                              {drop.yieldPerHarvest.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums">
                              {drop.yield24h.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                            </td>
                            <td className="py-2 pr-3 pl-2 text-right">
                              {drop.revenue24h !== null ? (
                                <span
                                  className={cn(
                                    "font-mono tabular-nums font-semibold",
                                    drop.revenue24h > 0
                                      ? "text-profit"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {formatSilver(drop.revenue24h)}
                                  <S />
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Total Profit */}
                {outputs && (
                  <div className="rounded-lg bg-surface-2 p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        24h Profit
                        {outputs.confidence !== "high" && (
                          <span className="text-amber-400/70">(partial)</span>
                        )}
                      </div>
                      {outputs.totalProfit24h !== null ? (
                        <div
                          className={cn(
                            "font-mono text-2xl font-bold tabular-nums",
                            outputs.totalProfit24h > 0
                              ? "text-profit"
                              : "text-muted-foreground",
                          )}
                        >
                          {outputs.totalProfit24h > 0 ? "+" : ""}
                          {formatSilver(outputs.totalProfit24h)}
                          <S />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Set prices to see profit
                        </div>
                      )}
                    </div>
                    {outputs.silverPerPlot24h !== null && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Per plot / 24h
                        </div>
                        <div className="font-mono text-sm font-semibold tabular-nums text-gold">
                          {formatSilver(outputs.silverPerPlot24h)}
                          <S />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Land size comparison */}
                {outputs && outputs.totalProfit24h !== null && (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-surface-2/50 border-b border-border/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Profit Scaling by Land Size
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 bg-surface-2/30">
                          <th className="py-1.5 pl-3 pr-2 text-left text-[10px] text-muted-foreground">
                            Tier
                          </th>
                          <th className="py-1.5 px-2 text-right text-[10px] text-muted-foreground">
                            Mult
                          </th>
                          <th className="py-1.5 px-2 text-right text-[10px] text-muted-foreground">
                            24h yield
                          </th>
                          <th className="py-1.5 pr-3 pl-2 text-right text-[10px] text-muted-foreground">
                            24h profit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {LAND_TIERS.map((t) => {
                          const isActiveTier = t.id === config.landSize;
                          // Scale profit proportionally to multiplier
                          const scaledProfit =
                            outputs.totalProfit24h !== null
                              ? (outputs.totalProfit24h /
                                  activeTier.multiplier) *
                                t.multiplier
                              : null;
                          const totalYieldScaled = outputs.dropCalcs.reduce(
                            (sum, d) => sum + d.yield24h,
                            0,
                          );
                          const scaledYield =
                            totalYieldScaled > 0
                              ? (totalYieldScaled / activeTier.multiplier) *
                                t.multiplier
                              : 0;
                          return (
                            <tr
                              key={t.id}
                              className={cn(
                                "border-b border-border/20 last:border-0",
                                isActiveTier
                                  ? `${t.bgClass} ${t.borderClass} border-l-2`
                                  : "hover:bg-surface-2/30",
                              )}
                            >
                              <td
                                className={cn(
                                  "py-1.5 pl-3 pr-2 font-medium",
                                  isActiveTier
                                    ? t.textClass
                                    : "text-muted-foreground",
                                )}
                              >
                                {t.emoji} {t.name}
                              </td>
                              <td
                                className={cn(
                                  "py-1.5 px-2 text-right font-mono tabular-nums",
                                  isActiveTier
                                    ? t.textClass
                                    : "text-muted-foreground",
                                )}
                              >
                                {t.multiplier}×
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted-foreground">
                                {scaledYield.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                              <td className="py-1.5 pr-3 pl-2 text-right">
                                {scaledProfit !== null ? (
                                  <span
                                    className={cn(
                                      "font-mono tabular-nums font-semibold",
                                      isActiveTier
                                        ? t.textClass
                                        : "text-muted-foreground",
                                      scaledProfit > 0 &&
                                        !isActiveTier &&
                                        "text-foreground",
                                    )}
                                  >
                                    {formatSilver(scaledProfit)}
                                    <S />
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Land Perk Card ───────────────────────────────────────────────────────────

function LandPerkCard({ perk }: { perk: LandPerk }) {
  const catColor =
    CATEGORY_COLORS[perk.category] ??
    "bg-muted/15 text-muted-foreground border-border";
  const maxVal = perk.values[perk.values.length - 1];

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="font-display font-semibold text-sm text-foreground">
            {perk.name}
          </span>
          <Badge className={cn("border text-[10px] shrink-0", catColor)}>
            {perk.category}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{perk.description}</p>
      </div>

      {/* Rarity value bar */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-7 gap-0.5">
          {RARITIES.map((rarity, i) => (
            <div key={rarity} className="space-y-1">
              <div
                className={cn(
                  "h-4 rounded-[3px] flex items-center justify-center text-[8px] font-bold",
                  i === RARITIES.length - 1
                    ? "bg-amber-400/20 border border-amber-400/40"
                    : "bg-surface-3",
                )}
                title={`${rarity}: ${perk.values[i]}${perk.unit}`}
              >
                <span
                  className={cn("tabular-nums font-mono", RARITY_COLORS[i])}
                >
                  {perk.values[i]}
                  {perk.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] text-slate-500">Common</span>
          <span className="text-[9px] text-amber-400 font-medium">
            Legendary: {maxVal}
            {perk.unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LandPlanner() {
  const config = useConfigStore();

  const activeTier =
    LAND_TIERS.find((t) => t.id === config.landSize) ?? LAND_TIERS[1];

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      {/* ── Section 1: Land Tiers ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-teal-400" />
          <h2 className="font-display text-lg font-bold">Land Tiers</h2>
          <span className="ml-1 text-xs text-muted-foreground">
            Click a tier to set it as active land size
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {LAND_TIERS.map((tier) => (
            <LandTierCard
              key={tier.id}
              tier={tier}
              isActive={activeTier.id === tier.id}
              onClick={() => config.setLandSize(tier.id)}
            />
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-1">
          <table className="w-full min-w-[600px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-2/60">
                <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tier
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Multiplier
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Grid
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Plots
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  House
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-bold">
                  Usable
                </th>
                <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tradepacks/wk
                </th>
                <th className="py-2.5 pr-4 pl-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Discord
                </th>
              </tr>
            </thead>
            <tbody>
              {LAND_TIERS.map((tier) => {
                const { totalPlots, housePlots, usablePlots } =
                  getTierStats(tier);
                const isActive = tier.id === activeTier.id;
                return (
                  <tr
                    key={tier.id}
                    data-ocid="land.tier_table.row"
                    tabIndex={0}
                    className={cn(
                      "border-b border-border/40 last:border-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      isActive
                        ? `${tier.bgClass} ${tier.borderClass} border-l-2`
                        : "hover:bg-surface-2/30",
                    )}
                    onClick={() => config.setLandSize(tier.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        config.setLandSize(tier.id);
                      }
                    }}
                  >
                    <td
                      className={cn(
                        "py-2.5 pl-4 pr-3 font-medium",
                        isActive ? tier.textClass : "text-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {tier.emoji} {tier.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {tier.multiplier}×
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {tier.grid.w}×{tier.grid.h}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {totalPlots}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {housePlots}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-mono tabular-nums font-bold",
                        isActive ? tier.textClass : "text-foreground",
                      )}
                    >
                      {usablePlots}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {tier.tradepacks.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 pl-3 text-right text-muted-foreground text-xs">
                      {tier.discordTitle}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: Plot Calculator ── */}
      <section>
        <PlotCalculator />
      </section>

      {/* ── Section 3: Land Perks ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-teal-400" />
          <h2 className="font-display text-lg font-bold">
            Land Perks Reference
          </h2>
          <span className="ml-1 text-xs text-muted-foreground">
            Values scale from Common to Legendary rarity
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {LAND_PERKS.map((perk) => (
            <LandPerkCard key={perk.name} perk={perk} />
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
            <span>
              Land perks are passive bonuses applied to your estate. The value
              shown scales from Common (lowest rarity) to Legendary (highest).
              Perks like <span className="text-foreground">Crop Boon</span>,{" "}
              <span className="text-foreground">Floral Boon</span>, and{" "}
              <span className="text-foreground">Livestock Boon</span> add a
              chance to upgrade harvest quality — directly increasing market
              value of your drops.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
