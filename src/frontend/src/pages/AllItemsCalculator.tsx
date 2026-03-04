import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { GatheringProfitRow } from "@/components/ProfitRow";
import { type BestWindowEntry, SummaryPanel } from "@/components/SummaryPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAllCrafting,
  useFarming,
  useHerbalism,
  useHusbandry,
  useWoodcutting,
} from "@/hooks/useQueries";
import type {
  CraftingRecipe,
  GatheringItem,
  HusbandryItem,
} from "@/lib/api/types";
import {
  calculateCraftingProfit,
  calculateGatheringProfit,
  computeProfit24h,
} from "@/lib/calculator/profitEngine";
import type { CraftingProfitResult } from "@/lib/calculator/profitEngine";
import type { ProfitResult } from "@/lib/calculator/types";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryLabel =
  | "Farming"
  | "Herbalism"
  | "Woodcutting"
  | "Husbandry"
  | "Crafting";

interface TaggedGatheringItem {
  kind: "gathering";
  item: GatheringItem;
  category: CategoryLabel;
}

interface TaggedCraftingItem {
  kind: "crafting";
  recipe: CraftingRecipe;
  category: "Crafting";
}

type TaggedItem = TaggedGatheringItem | TaggedCraftingItem;

const CATEGORY_COLORS: Record<CategoryLabel, string> = {
  Farming: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Herbalism: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  Woodcutting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Husbandry: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Crafting: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

// ─── Helper: convert Husbandry gathering mode to GatheringItem ───────────────

function husbandryToGatheringItem(item: HusbandryItem): GatheringItem | null {
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

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CategoryLabel }) {
  return (
    <Badge
      variant="outline"
      className={`border px-1.5 py-0 text-[10px] font-medium ${CATEGORY_COLORS[category]}`}
    >
      {category}
    </Badge>
  );
}

// ─── Inline Price Input for crafting rows ─────────────────────────────────────

function CraftingInlinePriceInput({
  itemId,
  itemName,
  index,
}: {
  itemId: number;
  itemName: string;
  index: number;
}) {
  const { getPrice, setPrice } = usePriceBookStore();
  const currentPrice = getPrice(itemId);
  const [localValue, setLocalValue] = useState(
    currentPrice !== null ? currentPrice.toString() : "",
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    const parsed = Number.parseFloat(e.target.value);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(itemId, itemName, parsed);
    }
  };

  return (
    <Input
      data-ocid={`all_items.price_input.${index}`}
      type="number"
      min="0"
      step="0.01"
      placeholder="Price..."
      value={localValue}
      onChange={handleChange}
      className="h-7 w-24 bg-surface-2 text-right font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function formatSilver(num: number): string {
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Crafting Row (compact, for All Items view) ───────────────────────────────

function AllItemsCraftingRow({
  recipe,
  result,
  rowIndex,
}: {
  recipe: CraftingRecipe;
  result: CraftingProfitResult;
  rowIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { marketFeePercent } = useConfigStore();

  const profitColor =
    result.confidence === "low"
      ? "text-muted-foreground"
      : result.profit > 0
        ? "text-profit"
        : result.profit < 0
          ? "text-loss"
          : "text-muted-foreground";

  return (
    <div className="relative">
      <div
        data-ocid={`all_items.item.${rowIndex}`}
        className="rounded-lg border border-border bg-surface-1 transition-colors hover:border-border/80 hover:bg-surface-2/60"
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{recipe.name}</span>
              <CategoryBadge category="Crafting" />
              <Badge
                variant="outline"
                className="border-border/50 px-1.5 py-0 text-[10px] text-muted-foreground"
              >
                {recipe.profession ?? "Crafting"} · Lvl {recipe.level}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {recipe.materials
                .map((m) => `${m.amount}× ${m.name}`)
                .join(" + ")}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div
              className={cn(
                "font-num text-sm font-bold tabular-nums",
                profitColor,
              )}
            >
              {result.confidence === "low" ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : (
                <>
                  {result.profit > 0 ? (
                    <TrendingUp className="inline mr-1 h-3.5 w-3.5" />
                  ) : result.profit < 0 ? (
                    <TrendingDown className="inline mr-1 h-3.5 w-3.5" />
                  ) : null}
                  {result.profit > 0 ? "+" : ""}
                  {formatSilver(result.profit)}s
                </>
              )}
            </div>
            <div className="font-num text-xs text-muted-foreground">
              <Zap className="inline h-3 w-3 mr-0.5 opacity-30" />—
            </div>
          </div>

          <div className="shrink-0">
            <span
              className={cn(
                "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium",
                result.confidence === "high"
                  ? "bg-profit text-profit-foreground"
                  : result.confidence === "medium"
                    ? "bg-warning text-warning-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {result.confidence === "high"
                ? "Full"
                : result.confidence === "medium"
                  ? "Partial"
                  : "No Prices"}
            </span>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border/50 bg-surface-2/40 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Materials — Set Prices
                </h4>
                <div className="space-y-2">
                  {result.inputs.map((inp, i) => (
                    <div
                      key={inp.itemId}
                      className="flex items-center justify-between gap-2 rounded-md bg-surface-1 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {inp.itemName}
                        </div>
                        <div className="font-num text-xs text-muted-foreground">
                          Qty: {inp.amount}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <CraftingInlinePriceInput
                          itemId={inp.itemId}
                          itemName={inp.itemName}
                          index={rowIndex * 100 + i + 1}
                        />
                        <span
                          className={cn(
                            "font-num w-16 text-right text-xs",
                            inp.price !== null
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {inp.price !== null
                            ? `= ${formatSilver(inp.totalCost)}s`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Output */}
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-cyan-300">
                        {recipe.name}
                      </div>
                      <div className="font-num text-xs text-muted-foreground">
                        Output: {result.outputQty}×
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CraftingInlinePriceInput
                        itemId={recipe.itemId}
                        itemName={recipe.name}
                        index={rowIndex * 100 + recipe.materials.length + 1}
                      />
                      <span
                        className={cn(
                          "font-num w-16 text-right text-xs",
                          result.outputPrice !== null
                            ? "text-cyan-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {result.outputPrice !== null
                          ? `= ${formatSilver(result.outputValue)}s`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Breakdown
                </h4>
                <div className="rounded-md bg-surface-1 px-3 py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="font-num">
                      {result.confidence === "low"
                        ? "—"
                        : `${formatSilver(result.totalCost)}s`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Output Value (after {marketFeePercent}% fee)
                    </span>
                    <span className="font-num text-cyan-300">
                      {result.confidence === "low"
                        ? "—"
                        : `${formatSilver(result.outputValue)}s`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
                    <span>Profit</span>
                    <span
                      className={cn(
                        "font-num",
                        result.profit > 0
                          ? "text-profit"
                          : result.profit < 0
                            ? "text-loss"
                            : "text-muted-foreground",
                      )}
                    >
                      {result.confidence === "low"
                        ? "—"
                        : `${result.profit > 0 ? "+" : ""}${formatSilver(result.profit)}s`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tagged Profit Row (wraps GatheringProfitRow + adds category badge) ───────

function TaggedProfitRow({
  tagged,
  rowIndex,
  craftingResult,
}: {
  tagged: TaggedItem;
  rowIndex: number;
  craftingResult?: CraftingProfitResult;
}) {
  if (tagged.kind === "crafting" && craftingResult) {
    return (
      <AllItemsCraftingRow
        recipe={tagged.recipe}
        result={craftingResult}
        rowIndex={rowIndex}
      />
    );
  }

  if (tagged.kind === "gathering") {
    return (
      <div className="relative">
        <GatheringProfitRow
          item={tagged.item}
          rowIndex={rowIndex}
          quantityLabel="Plots"
          categoryBadge={<CategoryBadge category={tagged.category} />}
        />
      </div>
    );
  }

  return null;
}

// ─── Top 5 per Category · 24h Leaderboard ────────────────────────────────────

interface Top5Item {
  name: string;
  category: Exclude<CategoryLabel, "Crafting">;
  profit24h: number;
  profitPerHour: number;
  profitPerHarvest: number;
  harvestTimeLabel: string;
}

type GatheringCategory = Exclude<CategoryLabel, "Crafting">;

type Top3ByCat = Record<GatheringCategory, Top5Item[]>;

const GATHERING_CATEGORIES: GatheringCategory[] = [
  "Farming",
  "Herbalism",
  "Woodcutting",
  "Husbandry",
];

const RANK_STYLES = [
  // #1 gold
  {
    badge: "bg-gold/20 text-gold border-gold/40 font-bold",
    profit: "text-gold",
    card: "border-gold/30 bg-gold/5",
  },
  // #2 silver
  {
    badge: "bg-slate-400/20 text-slate-300 border-slate-400/30 font-semibold",
    profit: "text-slate-300",
    card: "border-slate-400/20 bg-slate-400/5",
  },
  // #3 bronze
  {
    badge: "bg-amber-700/20 text-amber-600 border-amber-700/30 font-semibold",
    profit: "text-amber-500",
    card: "border-amber-700/20 bg-amber-700/5",
  },
  // #4
  {
    badge: "bg-surface-2 text-muted-foreground border-border/50 font-medium",
    profit: "text-muted-foreground",
    card: "border-border/30 bg-surface-1",
  },
  // #5
  {
    badge: "bg-surface-2 text-muted-foreground border-border/50 font-medium",
    profit: "text-muted-foreground",
    card: "border-border/30 bg-surface-1",
  },
];

// ─── Rank badge tooltip text ──────────────────────────────────────────────────

const RANK_LABEL = ["Best", "2nd", "3rd", "4th", "5th"] as const;

type LeaderboardMode = "24h" | "perHarvest";

function Top5ByCatLeaderboard({ data }: { data: Top3ByCat }) {
  const [mode, setMode] = useState<LeaderboardMode>("24h");
  const anyData = GATHERING_CATEGORIES.some((cat) => data[cat].length > 0);

  // Sort items by selected mode
  const sortedData = useMemo<Top3ByCat>(() => {
    const result = {} as Top3ByCat;
    for (const cat of GATHERING_CATEGORIES) {
      const sorted = [...data[cat]].sort((a, b) =>
        mode === "24h"
          ? b.profit24h - a.profit24h
          : b.profitPerHarvest - a.profitPerHarvest,
      );
      result[cat] = sorted;
    }
    return result;
  }, [data, mode]);

  return (
    <div
      data-ocid="all_items.top3_panel"
      className="mb-4 rounded-xl border border-border bg-surface-1 px-4 py-3"
    >
      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Trophy className="h-4 w-4 text-gold shrink-0" />
        <span className="text-sm font-semibold tracking-tight">
          Top 5 per Category
        </span>
        {/* Mode toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            data-ocid="all_items.top3.mode_24h_toggle"
            onClick={() => setMode("24h")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              mode === "24h"
                ? "bg-gold text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            24h Window
          </button>
          <button
            type="button"
            data-ocid="all_items.top3.mode_harvest_toggle"
            onClick={() => setMode("perHarvest")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              mode === "perHarvest"
                ? "bg-gold text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Per Harvest
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {mode === "24h"
          ? "Ranked by total silver earned over 24h of continuous harvesting"
          : "Ranked by profit from a single harvest — best lump-sum per cycle"}
      </p>

      {!anyData ? (
        <div
          data-ocid="all_items.empty_state"
          className="flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-2/40 py-6 text-center"
        >
          <div>
            <Trophy className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Set item prices to see your top earners
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              Expand any row and enter sell prices to unlock this leaderboard
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {GATHERING_CATEGORIES.map((cat) => {
            const items = sortedData[cat];
            return (
              <div key={cat} className="flex flex-col gap-2">
                {/* Category header */}
                <Badge
                  variant="outline"
                  className={`w-fit border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[cat]}`}
                >
                  {cat}
                </Badge>

                {items.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-surface-2/30 px-3 py-4 text-center">
                    <p className="text-[11px] text-muted-foreground/70">
                      Set prices to unlock
                    </p>
                  </div>
                ) : (
                  items.map((item, idx) => {
                    const styles = RANK_STYLES[idx] ?? RANK_STYLES[2];
                    const primaryValue =
                      mode === "24h" ? item.profit24h : item.profitPerHarvest;
                    const subLabel =
                      mode === "24h"
                        ? `${item.profitPerHour.toLocaleString(undefined, { maximumFractionDigits: 0 })}s/h`
                        : item.harvestTimeLabel;
                    return (
                      <div
                        key={item.name}
                        data-ocid={`all_items.top3.${cat.toLowerCase()}.item.${idx + 1}`}
                        className={cn(
                          "flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors",
                          styles.card,
                        )}
                        title={`${RANK_LABEL[idx]} in ${cat}`}
                      >
                        {/* Rank badge */}
                        <span
                          className={cn(
                            "inline-flex h-5 w-8 items-center justify-center self-start rounded border text-[11px]",
                            styles.badge,
                          )}
                        >
                          #{idx + 1}
                        </span>

                        {/* Item name */}
                        <div
                          className="truncate text-xs font-semibold leading-snug"
                          title={item.name}
                        >
                          {item.name}
                        </div>

                        {/* Primary value (24h or per-harvest) */}
                        <div
                          className={cn(
                            "font-num text-sm font-bold tabular-nums leading-none",
                            styles.profit,
                          )}
                        >
                          +
                          {primaryValue.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                          s
                        </div>

                        {/* Sub-line */}
                        <div className="font-num text-[10px] text-muted-foreground tabular-nums">
                          {subLabel}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AllItemsCalculator() {
  const farming = useFarming();
  const herbalism = useHerbalism();
  const woodcutting = useWoodcutting();
  const husbandry = useHusbandry();
  const crafting = useAllCrafting();
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit24h");
  const [minSkill, setMinSkill] = useState(1);
  const [maxSkill, setMaxSkill] = useState(100);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);
  const [maxHarvestHours, setMaxHarvestHours] = useState(0); // 0 = any
  const [categoryFilter, setCategoryFilter] = useState("all");

  const isLoading =
    farming.isLoading ||
    herbalism.isLoading ||
    woodcutting.isLoading ||
    husbandry.isLoading ||
    crafting.isLoading;

  const hasError =
    farming.error ||
    herbalism.error ||
    woodcutting.error ||
    husbandry.error ||
    crafting.error;

  // Aggregate all items into a single tagged array
  const allTaggedItems = useMemo<TaggedItem[]>(() => {
    const result: TaggedItem[] = [];

    for (const item of farming.data ?? []) {
      result.push({ kind: "gathering", item, category: "Farming" });
    }
    for (const item of herbalism.data ?? []) {
      result.push({ kind: "gathering", item, category: "Herbalism" });
    }
    for (const item of woodcutting.data ?? []) {
      result.push({ kind: "gathering", item, category: "Woodcutting" });
    }
    for (const raw of husbandry.data ?? []) {
      const converted = husbandryToGatheringItem(raw);
      if (converted)
        result.push({
          kind: "gathering",
          item: converted,
          category: "Husbandry",
        });
    }
    for (const recipe of crafting.data ?? []) {
      result.push({ kind: "crafting", recipe, category: "Crafting" });
    }

    return result;
  }, [
    farming.data,
    herbalism.data,
    woodcutting.data,
    husbandry.data,
    crafting.data,
  ]);

  // Pre-compute profit results for all items
  const allRowResults = useMemo(() => {
    return allTaggedItems.map((tagged) => {
      if (tagged.kind === "gathering") {
        const gResult = calculateGatheringProfit(tagged.item, 1, {
          landMultiplier: config.landMultiplier,
          marketFeePercent: config.marketFeePercent,
          getPrice,
        });
        const profit24h = computeProfit24h(
          gResult.profitPerHarvest,
          tagged.item.growingTime,
        );
        return {
          profit: gResult.profitPerHarvest,
          profit24h,
          profitPerHour: gResult.profitPerHour,
          skillRequired: tagged.item.skillRequired,
          name: tagged.item.name,
          harvestTime: tagged.item.growingTime,
          gatheringResult: gResult,
          craftingResult: undefined as CraftingProfitResult | undefined,
        };
      }
      const cResult = calculateCraftingProfit(tagged.recipe, {
        marketFeePercent: config.marketFeePercent,
        craftTaxPercent: config.craftTaxPercent,
        getPrice,
      });
      return {
        profit: cResult.profit,
        profit24h: 0 as number,
        profitPerHour: null as number | null,
        skillRequired: tagged.recipe.level,
        name: tagged.recipe.name,
        harvestTime: 0,
        gatheringResult: undefined as ProfitResult | undefined,
        craftingResult: cResult,
      };
    });
  }, [
    allTaggedItems,
    config.landMultiplier,
    config.marketFeePercent,
    config.craftTaxPercent,
    getPrice,
  ]);

  // Summary results for gathering only (SummaryPanel expects ProfitResult[])
  const summaryResults = useMemo(() => {
    return allRowResults
      .filter((r) => r.gatheringResult !== undefined)
      .map((r) => r.gatheringResult as ProfitResult);
  }, [allRowResults]);

  // Top 3 per category — stores both 24h and per-harvest metrics
  const top3ByCat = useMemo<Top3ByCat>(() => {
    const buckets: Top3ByCat = {
      Farming: [],
      Herbalism: [],
      Woodcutting: [],
      Husbandry: [],
    };

    for (let i = 0; i < allTaggedItems.length; i++) {
      const tagged = allTaggedItems[i];
      const meta = allRowResults[i];
      if (tagged.kind === "crafting") continue;
      if (meta.profitPerHour === null || meta.profitPerHour <= 0) continue;
      const result = meta.gatheringResult;
      if (!result || result.confidence === "low") continue;

      // Format harvest time label (e.g. "2h 30m" or "45m")
      const secs = meta.harvestTime;
      const hrs = Math.floor(secs / 3600);
      const mins = Math.floor((secs % 3600) / 60);
      const harvestTimeLabel =
        hrs > 0
          ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""} cycle`
          : `${mins}m cycle`;

      const cat = (tagged as TaggedGatheringItem).category as GatheringCategory;
      buckets[cat].push({
        name: meta.name,
        category: cat,
        profit24h: meta.profit24h,
        profitPerHour: meta.profitPerHour ?? 0,
        profitPerHarvest: result.profitPerHarvest,
        harvestTimeLabel,
      });
    }

    // Default sort: by 24h (leaderboard sorts again based on toggle)
    for (const cat of GATHERING_CATEGORIES) {
      buckets[cat].sort((a, b) => b.profit24h - a.profit24h);
      buckets[cat] = buckets[cat].slice(0, 5);
    }

    return buckets;
  }, [allTaggedItems, allRowResults]);

  // Overall best 24h item (across all categories) for SummaryPanel
  const overallBest24h = useMemo<Top5Item | null>(() => {
    const allTop = GATHERING_CATEGORIES.flatMap((cat) => top3ByCat[cat]);
    if (allTop.length === 0) return null;
    return allTop.reduce((best, x) =>
      x.profit24h > best.profit24h ? x : best,
    );
  }, [top3ByCat]);

  // Best item per time window (gathering only)
  const TIME_WINDOWS = [2, 4, 6, 8, 12, 24];

  const bestByWindow = useMemo<Record<number, BestWindowEntry | null>>(() => {
    const result: Record<number, BestWindowEntry | null> = {};
    for (const W of TIME_WINDOWS) {
      const windowSecs = W * 3600;
      let best: BestWindowEntry | null = null;
      for (let i = 0; i < allTaggedItems.length; i++) {
        const tagged = allTaggedItems[i];
        const meta = allRowResults[i];
        if (tagged.kind === "crafting") continue;
        if (!meta.gatheringResult || meta.gatheringResult.confidence === "low")
          continue;
        const harvestTime = tagged.item.growingTime;
        if (harvestTime <= 0 || harvestTime > windowSecs) continue;
        const harvests = Math.floor(windowSecs / harvestTime);
        const windowProfit = meta.profit * harvests;
        if (windowProfit <= 0) continue;
        if (!best || windowProfit > best.windowProfit) {
          best = {
            name: meta.name,
            category: tagged.category,
            windowProfit,
            harvests,
            profitPerHarvest: meta.profit,
            harvestTime,
          };
        }
      }
      result[W] = best;
    }
    return result;
  }, [allTaggedItems, allRowResults]);

  const filteredRows = useMemo(() => {
    const withMeta = allTaggedItems.map((tagged, i) => ({
      tagged,
      meta: allRowResults[i],
    }));

    let filtered = withMeta.filter(({ tagged, meta }) => {
      if (
        searchTerm &&
        !meta.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (meta.skillRequired < minSkill || meta.skillRequired > maxSkill)
        return false;

      if (showOnlyPositive && meta.profit <= 0) return false;

      if (categoryFilter !== "all" && tagged.category !== categoryFilter)
        return false;

      // Max harvest time filter (crafting has harvestTime=0, skip filter for crafting if active)
      if (maxHarvestHours > 0) {
        if (tagged.kind === "crafting") {
          // Crafting has no grow time — exclude from time-filtered results
          return false;
        }
        if (meta.harvestTime > maxHarvestHours * 3600) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "profit24h":
          return (b.meta.profit24h ?? 0) - (a.meta.profit24h ?? 0);
        case "profit":
          return b.meta.profit - a.meta.profit;
        case "profitPerHour":
          return (
            (b.meta.profitPerHour ?? Number.NEGATIVE_INFINITY) -
            (a.meta.profitPerHour ?? Number.NEGATIVE_INFINITY)
          );
        case "skill":
          return a.meta.skillRequired - b.meta.skillRequired;
        case "name":
          return a.meta.name.localeCompare(b.meta.name);
        default:
          return 0;
      }
    });

    if (topN < 9999) filtered = filtered.slice(0, topN);
    return filtered;
  }, [
    allTaggedItems,
    allRowResults,
    searchTerm,
    minSkill,
    maxSkill,
    showOnlyPositive,
    sortBy,
    topN,
    maxHarvestHours,
    categoryFilter,
  ]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-3">
          {Array.from({ length: 10 }, (_, i) => i).map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    const retryAll = () => {
      farming.refetch();
      herbalism.refetch();
      woodcutting.refetch();
      husbandry.refetch();
      crafting.refetch();
    };
    return (
      <div className="container mx-auto px-4 py-6">
        <div
          data-ocid="all_items.error_state"
          className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
        >
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold">Failed to load some data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              One or more categories could not be fetched.
            </p>
          </div>
          <Button variant="outline" onClick={retryAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry All
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      filters={
        <Filters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          minSkill={minSkill}
          maxSkill={maxSkill}
          onSkillRangeChange={(min, max) => {
            setMinSkill(min);
            setMaxSkill(max);
          }}
          showOnlyPositive={showOnlyPositive}
          onShowOnlyPositiveChange={setShowOnlyPositive}
          topN={topN}
          onTopNChange={setTopN}
          maxHarvestHours={maxHarvestHours}
          onMaxHarvestHoursChange={setMaxHarvestHours}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
      }
      results={
        <div className="space-y-2">
          {/* Top 5 per Category · 24h Leaderboard */}
          <Top5ByCatLeaderboard data={top3ByCat} />

          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredRows.length} items
              {allTaggedItems.length > 0 &&
                filteredRows.length < allTaggedItems.length &&
                ` of ${allTaggedItems.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Sorted by profit/24h · Expand a row to set prices
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <div
              data-ocid="all_items.empty_state"
              className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <div>
                <p className="font-medium text-muted-foreground">
                  No items match your filters
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your filters or harvest time limit
                </p>
              </div>
            </div>
          ) : (
            filteredRows.map(({ tagged, meta }, index) => (
              <TaggedProfitRow
                key={
                  tagged.kind === "gathering"
                    ? `${tagged.category}-${tagged.item.id}`
                    : `crafting-${tagged.recipe.itemId}`
                }
                tagged={tagged}
                rowIndex={index + 1}
                craftingResult={meta.craftingResult}
              />
            ))
          )}
        </div>
      }
      summary={
        <SummaryPanel
          results={summaryResults.filter((r) => {
            if (
              searchTerm &&
              !r.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
              return false;
            if (r.skillRequired < minSkill || r.skillRequired > maxSkill)
              return false;
            return true;
          })}
          totalItems={allTaggedItems.length}
          top24hItem={overallBest24h}
          bestByWindow={bestByWindow}
        />
      }
    />
  );
}
