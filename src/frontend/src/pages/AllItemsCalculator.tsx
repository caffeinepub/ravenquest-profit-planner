import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { GatheringProfitRow } from "@/components/ProfitRow";
import { SummaryPanel } from "@/components/SummaryPanel";
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
  const [sortBy, setSortBy] = useState<SortOption>("profitPerHour");
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
        return {
          profit: gResult.profitPerHarvest,
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
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredRows.length} items
              {allTaggedItems.length > 0 &&
                filteredRows.length < allTaggedItems.length &&
                ` of ${allTaggedItems.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Sorted by profit/hour · Expand a row to set prices
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
        />
      }
    />
  );
}
