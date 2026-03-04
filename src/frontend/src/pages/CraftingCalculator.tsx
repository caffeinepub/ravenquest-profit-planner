import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAllCrafting } from "@/hooks/useQueries";
import type { CraftingRecipe } from "@/lib/api/types";
import {
  type CraftingProfitResult,
  calculateCraftingProfit,
} from "@/lib/calculator/profitEngine";
import type { ConfidenceLevel } from "@/lib/calculator/types";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  AlertCircle,
  Award,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Database,
  Minus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CraftingSortOption = "profit" | "margin" | "level" | "name";

const PROFESSION_COLORS: Record<string, string> = {
  Alchemy: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Blacksmithing: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  Carpentry: "bg-yellow-700/15 text-yellow-600 border-yellow-700/30",
  Cooking: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  Weaving: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Unknown: "bg-muted/15 text-muted-foreground border-muted/30",
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatSilver(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatLarge(num: number): string {
  if (!Number.isFinite(num)) return "—";
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidencePip({ confidence }: { confidence: ConfidenceLevel }) {
  const colors = {
    high: "bg-profit text-profit-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-muted text-muted-foreground",
  };
  const labels = { high: "Full", medium: "Partial", low: "No Prices" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium",
        colors[confidence],
      )}
    >
      {labels[confidence]}
    </span>
  );
}

// ─── Profession Badge ─────────────────────────────────────────────────────────

function ProfessionBadge({ profession }: { profession: string }) {
  const colorClass = PROFESSION_COLORS[profession] ?? PROFESSION_COLORS.Unknown;
  return (
    <Badge
      variant="outline"
      className={`border px-1.5 py-0 text-[10px] font-medium ${colorClass}`}
    >
      {profession}
    </Badge>
  );
}

// ─── Inline Price Input ───────────────────────────────────────────────────────

function PriceInput({
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

  const handleBlur = () => {
    const parsed = Number.parseFloat(localValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(itemId, itemName, parsed);
    } else if (localValue === "") {
      setLocalValue("");
    }
  };

  return (
    <Input
      data-ocid={`crafting.price_input.${index}`}
      type="number"
      min="0"
      step="0.01"
      placeholder="Set price..."
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className="h-7 w-28 bg-surface-2 text-right font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

// ─── Crafting Profit Row ──────────────────────────────────────────────────────

function CraftingProfitRow({
  recipe,
  result,
  rowIndex,
}: {
  recipe: CraftingRecipe;
  result: CraftingProfitResult;
  rowIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { marketFeePercent, craftTaxPercent } = useConfigStore();

  const profitColor =
    result.confidence === "low"
      ? "text-muted-foreground"
      : result.profit > 0
        ? "text-profit"
        : result.profit < 0
          ? "text-loss"
          : "text-muted-foreground";

  return (
    <div
      data-ocid={`crafting.item.${rowIndex}`}
      className="rounded-lg border border-border bg-surface-1 transition-colors hover:border-border/80 hover:bg-surface-2/60"
    >
      {/* ── Header Row ── */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {/* Chevron */}
        <span className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recipe.name}</span>
            <ProfessionBadge profession={result.profession} />
            <Badge
              variant="outline"
              className="border-border/50 px-1.5 py-0 text-[10px] text-muted-foreground"
            >
              Lvl {recipe.level}
            </Badge>
            {result.outputQty > 1 && (
              <span className="text-xs text-muted-foreground">
                → {result.outputQty}×
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {recipe.materials.map((m) => `${m.amount}× ${m.name}`).join(" + ")}
          </div>
        </div>

        {/* Profit */}
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
          {result.confidence !== "low" && (
            <div className="font-num text-xs text-muted-foreground">
              {result.profitMargin.toFixed(1)}% margin
            </div>
          )}
        </div>

        <div className="shrink-0">
          <ConfidencePip confidence={result.confidence} />
        </div>
      </button>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <div className="border-t border-border/50 bg-surface-2/40 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Input materials */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Input Materials — Set Prices
              </h4>
              <div className="space-y-2">
                {result.inputs.map((inp, i) => (
                  <div
                    key={inp.itemId}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-1 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{inp.itemName}</div>
                      <div className="font-num text-xs text-muted-foreground">
                        Qty: {inp.amount}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriceInput
                        itemId={inp.itemId}
                        itemName={inp.itemName}
                        index={rowIndex * 100 + i + 1}
                      />
                      <span className="font-num text-xs text-muted-foreground">
                        ea
                      </span>
                      <span
                        className={cn(
                          "font-num w-20 text-right text-xs",
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

                {/* Output item price */}
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
                    <PriceInput
                      itemId={recipe.itemId}
                      itemName={recipe.name}
                      index={rowIndex * 100 + recipe.materials.length + 1}
                    />
                    <span className="font-num text-xs text-muted-foreground">
                      ea
                    </span>
                    <span
                      className={cn(
                        "font-num w-20 text-right text-xs",
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

            {/* Profit breakdown */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Profit Breakdown
              </h4>
              <div className="rounded-md bg-surface-1 px-3 py-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Input Cost
                    </span>
                    <span className="font-num">
                      {result.confidence === "low"
                        ? "—"
                        : `${formatSilver(result.totalInputCost)}s`}
                    </span>
                  </div>
                  {craftTaxPercent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Craft Tax ({craftTaxPercent}%)
                      </span>
                      <span className="font-num text-loss">
                        {result.confidence === "low"
                          ? "—"
                          : `−${formatSilver(result.craftTax)}s`}
                      </span>
                    </div>
                  )}
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
                    <span>Net Profit</span>
                    <span
                      className={cn(
                        "font-num",
                        result.confidence === "low"
                          ? "text-muted-foreground"
                          : result.profit > 0
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
                  {result.confidence !== "low" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin</span>
                      <span className="font-num">
                        {result.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {result.outputQty > 1 && result.confidence !== "low" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per Unit</span>
                      <span
                        className={cn(
                          "font-num",
                          result.profitPerUnit > 0
                            ? "text-profit"
                            : result.profitPerUnit < 0
                              ? "text-loss"
                              : "text-muted-foreground",
                        )}
                      >
                        {result.profitPerUnit > 0 ? "+" : ""}
                        {formatSilver(result.profitPerUnit)}s
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP per Craft</span>
                    <span className="font-num">
                      {recipe.experience.toLocaleString()}
                    </span>
                  </div>
                </div>

                {result.missingPrices.length > 0 && (
                  <div className="mt-3 rounded bg-warning/10 px-2 py-1.5 text-xs text-warning">
                    Missing prices: {result.missingPrices.join(", ")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crafting Filters ─────────────────────────────────────────────────────────

interface CraftingFiltersProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  professionFilter: string;
  onProfessionFilterChange: (v: string) => void;
  minLevel: number;
  maxLevel: number;
  onLevelRangeChange: (min: number, max: number) => void;
  sortBy: CraftingSortOption;
  onSortChange: (v: CraftingSortOption) => void;
  showOnlyPositive: boolean;
  onShowOnlyPositiveChange: (v: boolean) => void;
  topN: number;
  onTopNChange: (v: number) => void;
}

function CraftingFilters({
  searchTerm,
  onSearchChange,
  professionFilter,
  onProfessionFilterChange,
  sortBy,
  onSortChange,
  showOnlyPositive,
  onShowOnlyPositiveChange,
  topN,
  onTopNChange,
}: CraftingFiltersProps) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-ocid="crafting.filters.search_input"
            type="text"
            placeholder="Recipe name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-surface-2 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Profession filter */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Profession
        </Label>
        <Select
          value={professionFilter}
          onValueChange={onProfessionFilterChange}
        >
          <SelectTrigger
            data-ocid="crafting.filters.profession_select"
            className="bg-surface-2 text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Professions</SelectItem>
            <SelectItem value="Alchemy">Alchemy</SelectItem>
            <SelectItem value="Blacksmithing">Blacksmithing</SelectItem>
            <SelectItem value="Carpentry">Carpentry</SelectItem>
            <SelectItem value="Cooking">Cooking</SelectItem>
            <SelectItem value="Weaving">Weaving</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort By */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort By
        </Label>
        <Select
          value={sortBy}
          onValueChange={(v) => onSortChange(v as CraftingSortOption)}
        >
          <SelectTrigger
            data-ocid="crafting.filters.sort_select"
            className="bg-surface-2 text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="margin">Margin %</SelectItem>
            <SelectItem value="level">Level</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Only Positive */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="crafting-only-positive"
          className="cursor-pointer text-sm"
        >
          Only Positive
        </Label>
        <Switch
          data-ocid="crafting.filters.positive_only_toggle"
          id="crafting-only-positive"
          checked={showOnlyPositive}
          onCheckedChange={onShowOnlyPositiveChange}
        />
      </div>

      {/* Show Top N */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Show
        </Label>
        <Select
          value={topN.toString()}
          onValueChange={(v) => onTopNChange(Number.parseInt(v))}
        >
          <SelectTrigger className="bg-surface-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 results</SelectItem>
            <SelectItem value="50">50 results</SelectItem>
            <SelectItem value="100">100 results</SelectItem>
            <SelectItem value="9999">All results</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Crafting Summary Panel ───────────────────────────────────────────────────

function CraftingSummaryPanel({
  results,
  totalItems,
}: {
  results: CraftingProfitResult[];
  totalItems: number;
}) {
  const pricedResults = results.filter((r) => r.confidence !== "low");
  const positiveResults = pricedResults.filter((r) => r.profit > 0);

  const totalProfit = positiveResults.reduce((sum, r) => sum + r.profit, 0);
  const bestItem =
    pricedResults.length > 0
      ? pricedResults.reduce((best, r) => (r.profit > best.profit ? r : best))
      : null;

  const avgMargin =
    pricedResults.length > 0
      ? pricedResults.reduce((sum, r) => sum + r.profitMargin, 0) /
        pricedResults.length
      : null;

  const pricedCount = pricedResults.length;

  return (
    <div className="space-y-5">
      {/* Prices set */}
      <div className="flex items-start gap-2">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Priced Recipes
          </div>
          <div className="font-num mt-0.5 text-xl font-bold">
            {pricedCount}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {totalItems}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Total profit */}
      <div className="flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Profit
          </div>
          <div
            className={`font-num mt-0.5 text-2xl font-bold ${
              totalProfit > 0 ? "text-profit" : "text-muted-foreground"
            }`}
          >
            {positiveResults.length > 0 ? `+${formatLarge(totalProfit)}s` : "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {positiveResults.length} of {results.length} profitable
          </div>
        </div>
      </div>

      <Separator />

      {/* Best craft */}
      {bestItem && bestItem.profit > 0 && (
        <>
          <div className="flex items-start gap-2">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Best Recipe
              </div>
              <div
                className="mt-0.5 truncate text-sm font-medium"
                title={bestItem.recipeName}
              >
                {bestItem.recipeName}
              </div>
              <div className="font-num text-lg font-bold text-profit">
                +{formatLarge(bestItem.profit)}s
              </div>
              <div className="font-num text-xs text-muted-foreground">
                {bestItem.profitMargin.toFixed(1)}% margin
              </div>
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Avg margin */}
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avg Margin
          </div>
          <div
            className={`font-num mt-0.5 text-xl font-bold ${
              avgMargin !== null && avgMargin > 0
                ? "text-profit"
                : "text-muted-foreground"
            }`}
          >
            {avgMargin !== null ? `${avgMargin.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            across {pricedResults.length} priced recipes
          </div>
        </div>
      </div>

      {/* Confidence breakdown */}
      <div className="rounded-lg bg-surface-2 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confidence
        </div>
        <div className="space-y-1.5">
          {(["high", "medium", "low"] as const).map((level) => {
            const count = results.filter((r) => r.confidence === level).length;
            const pct = results.length > 0 ? (count / results.length) * 100 : 0;
            const color =
              level === "high"
                ? "bg-profit"
                : level === "medium"
                  ? "bg-warning"
                  : "bg-muted-foreground/30";
            const label = { high: "Full", medium: "Partial", low: "None" }[
              level
            ];
            return (
              <div key={level} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-num w-6 text-right text-xs text-muted-foreground">
                  {count}
                </span>
                <span className="w-14 text-xs text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CraftingCalculator() {
  const { data: recipes, isLoading, error, refetch } = useAllCrafting();
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(100);
  const [sortBy, setSortBy] = useState<CraftingSortOption>("profit");
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);

  // Compute all results
  const allResults = useMemo(() => {
    if (!recipes) return [];
    return recipes.map((recipe) =>
      calculateCraftingProfit(recipe, {
        marketFeePercent: config.marketFeePercent,
        craftTaxPercent: config.craftTaxPercent,
        getPrice,
      }),
    );
  }, [recipes, config.marketFeePercent, config.craftTaxPercent, getPrice]);

  // Summary results (unfiltered)
  const summaryResults = allResults;

  // Filtered + sorted results
  const filteredResults = useMemo(() => {
    let filtered = allResults.filter((r, i) => {
      const recipe = recipes?.[i];
      if (!recipe) return false;

      if (
        searchTerm &&
        !r.recipeName.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (professionFilter !== "all" && r.profession !== professionFilter)
        return false;

      if (recipe.level < minLevel || recipe.level > maxLevel) return false;
      if (showOnlyPositive && r.profit <= 0) return false;

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "profit":
          return b.profit - a.profit;
        case "margin":
          return b.profitMargin - a.profitMargin;
        case "level": {
          const recipeA = recipes?.find((r) => r.itemId === a.recipeId);
          const recipeB = recipes?.find((r) => r.itemId === b.recipeId);
          return (recipeA?.level ?? 0) - (recipeB?.level ?? 0);
        }
        case "name":
          return a.recipeName.localeCompare(b.recipeName);
        default:
          return 0;
      }
    });

    if (topN < 9999) filtered = filtered.slice(0, topN);
    return filtered;
  }, [
    allResults,
    recipes,
    searchTerm,
    professionFilter,
    minLevel,
    maxLevel,
    showOnlyPositive,
    sortBy,
    topN,
  ]);

  // Build recipe map for quick lookup
  const recipeMap = useMemo(() => {
    const map = new Map<number, CraftingRecipe>();
    for (const r of recipes ?? []) {
      map.set(r.itemId, r);
    }
    return map;
  }, [recipes]);

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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div
          data-ocid="crafting.error_state"
          className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
        >
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold">Failed to load crafting recipes</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Could not fetch from the Ravendawn API.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      filters={
        <CraftingFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          professionFilter={professionFilter}
          onProfessionFilterChange={setProfessionFilter}
          minLevel={minLevel}
          maxLevel={maxLevel}
          onLevelRangeChange={(min, max) => {
            setMinLevel(min);
            setMaxLevel(max);
          }}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showOnlyPositive={showOnlyPositive}
          onShowOnlyPositiveChange={setShowOnlyPositive}
          topN={topN}
          onTopNChange={setTopN}
        />
      }
      results={
        <div className="space-y-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredResults.length} recipes
              {(recipes?.length ?? 0) > 0 &&
                filteredResults.length < (recipes?.length ?? 0) &&
                ` of ${recipes?.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Sorted by {sortBy} · Expand a row to set prices
            </p>
          </div>

          {filteredResults.length === 0 ? (
            <div
              data-ocid="crafting.empty_state"
              className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <div>
                <p className="font-medium text-muted-foreground">
                  No recipes match your filters
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your profession or search
                </p>
              </div>
            </div>
          ) : (
            filteredResults.map((result, index) => {
              const recipe = recipeMap.get(result.recipeId);
              if (!recipe) return null;
              return (
                <CraftingProfitRow
                  key={result.recipeId}
                  recipe={recipe}
                  result={result}
                  rowIndex={index + 1}
                />
              );
            })
          )}
        </div>
      }
      summary={
        <CraftingSummaryPanel
          results={summaryResults.filter((r) => {
            if (
              searchTerm &&
              !r.recipeName.toLowerCase().includes(searchTerm.toLowerCase())
            )
              return false;
            return true;
          })}
          totalItems={recipes?.length ?? 0}
        />
      }
    />
  );
}
