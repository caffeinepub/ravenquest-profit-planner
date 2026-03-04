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
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAllCrafting, useItemSourceMap } from "@/hooks/useQueries";
import type { ItemSource } from "@/hooks/useQueries";
import type { CraftingRecipe } from "@/lib/api/types";
import {
  type CraftVerdict,
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
  Database,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CraftingSortOption =
  | "profit"
  | "margin"
  | "level"
  | "name"
  | "craftAdvantage";

// ─── Profession Config ────────────────────────────────────────────────────────

const PROFESSIONS = [
  {
    id: "Alchemy",
    label: "Alchemy",
    emoji: "⚗️",
    color: "text-purple-400",
    borderColor: "border-purple-500",
    bgColor: "bg-purple-500/10",
    pillColor:
      "bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25",
    activePillColor: "bg-purple-500/30 text-purple-200 border-purple-500/60",
    sectionBg: "bg-purple-500/5",
    headingColor: "text-purple-300",
  },
  {
    id: "Blacksmithing",
    label: "Blacksmithing",
    emoji: "⚒️",
    color: "text-slate-300",
    borderColor: "border-slate-500",
    bgColor: "bg-slate-500/10",
    pillColor:
      "bg-slate-500/15 text-slate-300 border-slate-500/40 hover:bg-slate-500/25",
    activePillColor: "bg-slate-500/30 text-slate-200 border-slate-500/60",
    sectionBg: "bg-slate-500/5",
    headingColor: "text-slate-300",
  },
  {
    id: "Cooking",
    label: "Cooking",
    emoji: "🍳",
    color: "text-rose-400",
    borderColor: "border-rose-500",
    bgColor: "bg-rose-500/10",
    pillColor:
      "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25",
    activePillColor: "bg-rose-500/30 text-rose-200 border-rose-500/60",
    sectionBg: "bg-rose-500/5",
    headingColor: "text-rose-300",
  },
  {
    id: "Carpentry",
    label: "Carpentry",
    emoji: "🪵",
    color: "text-yellow-500",
    borderColor: "border-yellow-600",
    bgColor: "bg-yellow-600/10",
    pillColor:
      "bg-yellow-600/15 text-yellow-400 border-yellow-600/40 hover:bg-yellow-600/25",
    activePillColor: "bg-yellow-600/30 text-yellow-300 border-yellow-600/60",
    sectionBg: "bg-yellow-600/5",
    headingColor: "text-yellow-400",
  },
  {
    id: "Weaving",
    label: "Weaving",
    emoji: "🧵",
    color: "text-pink-400",
    borderColor: "border-pink-500",
    bgColor: "bg-pink-500/10",
    pillColor:
      "bg-pink-500/15 text-pink-300 border-pink-500/40 hover:bg-pink-500/25",
    activePillColor: "bg-pink-500/30 text-pink-200 border-pink-500/60",
    sectionBg: "bg-pink-500/5",
    headingColor: "text-pink-300",
  },
] as const;

function getProfessionConfig(professionId: string) {
  return (
    PROFESSIONS.find((p) => p.id === professionId) ?? {
      id: "Unknown",
      label: "Unknown",
      emoji: "❓",
      color: "text-muted-foreground",
      borderColor: "border-border",
      bgColor: "bg-muted/5",
      pillColor: "bg-muted/15 text-muted-foreground border-border",
      activePillColor: "bg-muted/25 text-foreground border-border",
      sectionBg: "bg-muted/5",
      headingColor: "text-muted-foreground",
    }
  );
}

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

// ─── Silver Suffix ─────────────────────────────────────────────────────────────

function S() {
  return (
    <span className="ml-0.5 font-mono text-[10px] text-amber-400/70">s</span>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<
  ItemSource,
  { label: string; emoji: string; className: string }
> = {
  farming: {
    label: "Farm",
    emoji: "🌾",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  },
  herbalism: {
    label: "Herb",
    emoji: "🌿",
    className:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
  woodcutting: {
    label: "Wood",
    emoji: "🪵",
    className: "bg-yellow-600/15 text-yellow-400 border border-yellow-600/30",
  },
  husbandry: {
    label: "Husb",
    emoji: "🐄",
    className: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  },
};

function SourceBadge({ source }: { source: ItemSource }) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none shrink-0",
        cfg.className,
      )}
      title={`Price pulled from ${source}`}
    >
      <span className="text-[9px]">{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

// ─── Inline Price Input ───────────────────────────────────────────────────────

function InlinePriceInput({
  itemId,
  itemName,
  placeholder,
  ocid,
  readOnly,
}: {
  itemId: number;
  itemName: string;
  placeholder?: string;
  ocid?: string;
  readOnly?: boolean;
}) {
  const { getPrice, setPrice, hasPrice } = usePriceBookStore();
  const storedPrice = getPrice(itemId);
  const fromStore = hasPrice(itemId);

  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const displayValue = editing
    ? localValue
    : storedPrice !== null
      ? storedPrice.toString()
      : "";

  const handleFocus = useCallback(() => {
    if (readOnly) return;
    setEditing(true);
    setLocalValue(storedPrice !== null ? storedPrice.toString() : "");
  }, [storedPrice, readOnly]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      setLocalValue(e.target.value);
      const parsed = Number.parseFloat(e.target.value);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setPrice(itemId, itemName, parsed);
      }
    },
    [itemId, itemName, setPrice, readOnly],
  );

  const handleBlur = useCallback(() => {
    if (readOnly) return;
    setEditing(false);
    const parsed = Number.parseFloat(localValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(itemId, itemName, parsed);
    }
  }, [itemId, itemName, localValue, setPrice, readOnly]);

  if (readOnly) {
    return (
      <span className="font-mono text-xs tabular-nums text-muted-foreground w-24 text-right block">
        {storedPrice !== null ? storedPrice.toLocaleString() : "—"}
      </span>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      {fromStore && storedPrice !== null && (
        <span
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-background"
          title="Price synced from price book"
        />
      )}
      <Input
        data-ocid={ocid}
        type="number"
        min="0"
        step="1"
        placeholder={placeholder ?? "0"}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "h-7 w-24 bg-surface-2/80 text-right font-mono text-xs tabular-nums",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          "border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20",
          fromStore && storedPrice !== null && "border-emerald-500/30",
        )}
      />
    </div>
  );
}

// ─── Market Price Input (output item) ─────────────────────────────────────────

function MarketPriceInput({
  recipe,
  result,
  rowIndex,
  readOnly,
}: {
  recipe: CraftingRecipe;
  result: CraftingProfitResult;
  rowIndex: number;
  readOnly?: boolean;
}) {
  const { getPrice, setPrice, hasPrice } = usePriceBookStore();
  const { marketFeePercent } = useConfigStore();
  const storedPrice = getPrice(recipe.itemId);
  const fromStore = hasPrice(recipe.itemId);

  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const displayValue = editing
    ? localValue
    : storedPrice !== null
      ? storedPrice.toString()
      : "";

  const handleFocus = useCallback(() => {
    if (readOnly) return;
    setEditing(true);
    setLocalValue(storedPrice !== null ? storedPrice.toString() : "");
  }, [storedPrice, readOnly]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      setLocalValue(e.target.value);
      const parsed = Number.parseFloat(e.target.value);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setPrice(recipe.itemId, recipe.name, parsed);
      }
    },
    [recipe.itemId, recipe.name, setPrice, readOnly],
  );

  const handleBlur = useCallback(() => {
    if (readOnly) return;
    setEditing(false);
    const parsed = Number.parseFloat(localValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(recipe.itemId, recipe.name, parsed);
    }
  }, [recipe.itemId, recipe.name, localValue, setPrice, readOnly]);

  // Compute profit from current display value (stored or local)
  const effectivePrice = editing
    ? localValue
    : storedPrice !== null
      ? storedPrice.toString()
      : "";
  const unitPrice = Number.parseFloat(effectivePrice);
  const hasValidPrice = !Number.isNaN(unitPrice) && unitPrice > 0;
  const outputValue = hasValidPrice
    ? recipe.amount * unitPrice * (1 - marketFeePercent / 100)
    : null;
  const profit =
    outputValue !== null && result.confidence !== "low"
      ? outputValue - result.totalCost
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Market Unit Price
        </span>
        {fromStore && storedPrice !== null && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
            title="Synced from price book"
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {readOnly ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground w-28 text-right block">
            {storedPrice !== null ? storedPrice.toLocaleString() : "—"}
          </span>
        ) : (
          <div className="relative">
            <Input
              data-ocid={`crafting.item.${rowIndex}.input`}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={displayValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={cn(
                "h-7 w-28 bg-surface-2 text-right font-mono text-xs tabular-nums",
                "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                "border-border/50 focus:border-cyan-500/50",
                fromStore && storedPrice !== null && "border-emerald-500/30",
              )}
            />
          </div>
        )}
        <S />
      </div>
      {profit !== null ? (
        <div
          className={cn(
            "font-mono text-xs tabular-nums font-semibold",
            profit > 0
              ? "text-profit"
              : profit < 0
                ? "text-loss"
                : "text-muted-foreground",
          )}
        >
          {profit > 0 ? "+" : ""}
          {formatSilver(profit)}
          <S />{" "}
          <span className="font-normal text-muted-foreground">
            ({profit > 0 ? "+" : ""}
            {outputValue && outputValue > 0
              ? ((profit / outputValue) * 100).toFixed(1)
              : "0.0"}
            %)
          </span>
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground italic">
          {result.confidence === "low" && !hasValidPrice
            ? "Set material + output prices"
            : "Enter price to view profit/loss"}
        </div>
      )}
    </div>
  );
}

// ─── Sell vs Craft Comparison Block ──────────────────────────────────────────

function SellVsCraftBlock({ result }: { result: CraftingProfitResult }) {
  if (result.verdict === "unknown") return null;

  const verdictConfig: Record<
    Exclude<CraftVerdict, "unknown">,
    { label: string; className: string; icon: string }
  > = {
    craft: {
      label: "Crafting is more profitable",
      className: "text-profit",
      icon: "✅",
    },
    sell_raw: {
      label: "Selling raw is more profitable",
      className: "text-warning",
      icon: "📦",
    },
    even: {
      label: "Roughly break-even",
      className: "text-muted-foreground",
      icon: "⚖️",
    },
  };

  const cfg = verdictConfig[result.verdict];
  const diff = Math.abs(result.craftAdvantage);

  return (
    <div className="mt-2 rounded-lg bg-surface-2/60 border border-border/40 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        <span>📊</span>
        <span>Sell vs Craft</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground">Sell raw</div>
          <div className="font-mono tabular-nums font-semibold">
            {formatSilver(result.sellRawValue)}
            <span className="ml-0.5 font-mono text-[10px] text-amber-400/70">
              s
            </span>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground">
            Craft &amp; sell
          </div>
          <div className="font-mono tabular-nums font-semibold">
            {formatSilver(result.outputValue)}
            <span className="ml-0.5 font-mono text-[10px] text-amber-400/70">
              s
            </span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "text-xs font-medium flex items-center gap-1",
          cfg.className,
        )}
      >
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
        {diff > 0 && (
          <span className="font-mono tabular-nums">
            {result.verdict === "craft" ? "+" : "-"}
            {formatSilver(diff)}
            <span className="ml-0.5 font-mono text-[9px] text-amber-400/70">
              s
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Wiki-style Recipe Row ────────────────────────────────────────────────────

function WikiRecipeRow({
  recipe,
  result,
  rowIndex,
  itemSourceMap,
  readOnly,
}: {
  recipe: CraftingRecipe;
  result: CraftingProfitResult;
  rowIndex: number;
  itemSourceMap: Map<number, ItemSource>;
  readOnly?: boolean;
}) {
  const { craftTaxPercent } = useConfigStore();

  // Recompute tax display value from inputs
  const totalInputCost = result.inputs.reduce((sum, i) => sum + i.totalCost, 0);
  const taxAmount = Math.round(totalInputCost * (craftTaxPercent / 100));
  const totalCost = totalInputCost + taxAmount;
  const perUnit = recipe.amount > 0 ? totalCost / recipe.amount : 0;

  const silverPerXp =
    recipe.experience > 0 && totalCost > 0
      ? totalCost / recipe.experience
      : null;

  const hasMaterialPrices = result.inputs.every((i) => i.price !== null);

  return (
    <tr
      data-ocid={`crafting.item.${rowIndex}`}
      className="group border-b border-border/40 hover:bg-surface-2/30 transition-colors"
    >
      {/* ── Item Column ── */}
      <td className="py-3 pl-4 pr-3 align-top">
        <div className="space-y-0.5">
          <div className="inline-flex items-center rounded-sm bg-surface-3/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Level {recipe.level}
          </div>
          <div className="font-semibold text-sm leading-snug">
            {recipe.name}
          </div>
          {recipe.amount > 1 && (
            <div className="text-xs text-muted-foreground">
              × {recipe.amount}
            </div>
          )}
        </div>
      </td>

      {/* ── Materials Column ── */}
      <td className="py-3 px-3 align-top">
        <div className="space-y-1 min-w-[260px]">
          {result.inputs.map((inp) => {
            const source = itemSourceMap.get(inp.itemId);
            return (
              <div key={inp.itemId} className="flex items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-muted-foreground w-5 text-right shrink-0">
                  {inp.amount}
                </span>
                <span className="text-muted-foreground text-xs shrink-0">
                  ×
                </span>
                <span
                  className="text-xs flex-1 min-w-0 truncate"
                  title={inp.itemName}
                >
                  {inp.itemName}
                </span>
                {source && <SourceBadge source={source} />}
                <InlinePriceInput
                  itemId={inp.itemId}
                  itemName={inp.itemName}
                  placeholder="0"
                  ocid={`crafting.item.${rowIndex}.input`}
                  readOnly={readOnly}
                />
                <S />
              </div>
            );
          })}

          {/* Tax row */}
          {craftTaxPercent > 0 && (
            <div className="flex items-center gap-2 border-t border-border/30 pt-1 mt-1">
              <span className="w-5 shrink-0" />
              <span className="w-3 shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Tax</span>
              <span className="font-mono text-xs tabular-nums text-loss w-24 text-right">
                {hasMaterialPrices ? formatSilver(taxAmount) : "—"}
              </span>
              <S />
            </div>
          )}

          {/* Total Cost */}
          <div className="flex items-center gap-2 border-t border-border/30 pt-1">
            <span className="w-5 shrink-0" />
            <span className="w-3 shrink-0" />
            <span className="text-xs font-medium flex-1">Total Cost</span>
            <span className="font-mono text-xs tabular-nums font-semibold w-24 text-right">
              {hasMaterialPrices ? formatSilver(totalCost) : "—"}
            </span>
            <S />
          </div>
          {hasMaterialPrices && perUnit > 0 && (
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums">
                {formatSilver(perUnit)}
              </span>
              <S />
              <span>/unit</span>
            </div>
          )}

          {/* Sell vs Craft comparison */}
          <SellVsCraftBlock result={result} />
        </div>
      </td>

      {/* ── Craft Cost / Market Price Column ── */}
      <td className="py-3 px-3 align-top min-w-[160px]">
        <MarketPriceInput
          recipe={recipe}
          result={result}
          rowIndex={rowIndex}
          readOnly={readOnly}
        />
      </td>

      {/* ── Exp Column ── */}
      <td className="py-3 px-3 align-top text-right">
        <div className="space-y-1">
          <div className="font-mono text-xs tabular-nums">
            <span className="text-foreground">
              {recipe.experience.toLocaleString()}
            </span>
            <span className="text-muted-foreground">xp</span>
          </div>
          {silverPerXp !== null && (
            <div className="flex items-center justify-end gap-0.5 text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums">
                {silverPerXp.toFixed(2)}
              </span>
              <S />
              <span>/xp</span>
            </div>
          )}
        </div>
      </td>

      {/* ── Progress Column ── */}
      <td className="py-3 px-3 align-top text-right">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {recipe.progress ?? "—"}
        </span>
      </td>

      {/* ── Quality Column ── */}
      <td className="py-3 px-3 align-top text-right">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {recipe.quality ?? "—"}
        </span>
      </td>

      {/* ── Durability Column ── */}
      <td className="py-3 pr-4 pl-3 align-top text-right">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {recipe.durability ?? "—"}
        </span>
      </td>
    </tr>
  );
}

// ─── Category Table ───────────────────────────────────────────────────────────

function CategoryTable({
  categoryName,
  recipes,
  results,
  rowOffset,
  itemSourceMap,
  readOnly,
}: {
  categoryName: string;
  recipes: CraftingRecipe[];
  results: Map<number, CraftingProfitResult>;
  rowOffset: number;
  itemSourceMap: Map<number, ItemSource>;
  readOnly?: boolean;
}) {
  return (
    <div className="mb-4">
      {/* Sub-section heading */}
      <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {categoryName}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-surface-1">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-surface-2/60">
              <th className="py-2 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">
                Item
              </th>
              <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Materials
              </th>
              <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[180px]">
                Craft Cost
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[90px]">
                Exp
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[80px]">
                Progress
              </th>
              <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[80px]">
                Quality
              </th>
              <th className="py-2 pr-4 pl-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[90px]">
                Durability
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe, i) => {
              const result = results.get(recipe.itemId);
              if (!result) return null;
              return (
                <WikiRecipeRow
                  key={recipe.itemId}
                  recipe={recipe}
                  result={result}
                  rowIndex={rowOffset + i + 1}
                  itemSourceMap={itemSourceMap}
                  readOnly={readOnly}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Profession Section ───────────────────────────────────────────────────────

function ProfessionSection({
  professionId,
  recipes,
  results,
  rowOffset,
  itemSourceMap,
  readOnly,
}: {
  professionId: string;
  recipes: CraftingRecipe[];
  results: Map<number, CraftingProfitResult>;
  rowOffset: number;
  itemSourceMap: Map<number, ItemSource>;
  readOnly?: boolean;
}) {
  const profConfig = getProfessionConfig(professionId);

  // Group by category
  const categories = useMemo(() => {
    const map = new Map<string, CraftingRecipe[]>();
    for (const r of recipes) {
      const cat = r.category || "General";
      const fullCat = `${professionId} - ${cat}`;
      const arr = map.get(fullCat) ?? [];
      arr.push(r);
      map.set(fullCat, arr);
    }
    return map;
  }, [recipes, professionId]);

  let localOffset = rowOffset;

  return (
    <section id={`profession-${professionId.toLowerCase()}`} className="mb-8">
      {/* Profession heading */}
      <div
        className={cn(
          "mb-4 flex items-center gap-2.5 border-l-[3px] pl-3 py-1",
          profConfig.borderColor,
        )}
      >
        <span className="text-xl leading-none">{profConfig.emoji}</span>
        <h2 className={cn("text-lg font-bold", profConfig.headingColor)}>
          {profConfig.label}
        </h2>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto border px-2 py-0 text-xs",
            profConfig.pillColor,
          )}
        >
          {recipes.length} recipes
        </Badge>
      </div>

      {/* Categories */}
      {Array.from(categories.entries()).map(([catName, catRecipes]) => {
        const offset = localOffset;
        localOffset += catRecipes.length;
        return (
          <CategoryTable
            key={catName}
            categoryName={catName}
            recipes={catRecipes}
            results={results}
            rowOffset={offset}
            itemSourceMap={itemSourceMap}
            readOnly={readOnly}
          />
        );
      })}
    </section>
  );
}

// ─── Profession Nav Pills ─────────────────────────────────────────────────────

function ProfessionNavPills({
  availableProfessions,
  activeProfession,
}: {
  availableProfessions: string[];
  activeProfession: string;
}) {
  const handleScrollTo = (profId: string) => {
    const el = document.getElementById(`profession-${profId.toLowerCase()}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          activeProfession === "all"
            ? "bg-foreground/10 text-foreground border-foreground/30"
            : "bg-surface-2/50 text-muted-foreground border-border hover:bg-surface-2 hover:text-foreground",
        )}
        data-ocid="crafting.tab"
      >
        🗂️ All
      </button>
      {PROFESSIONS.filter((p) => availableProfessions.includes(p.id)).map(
        (p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleScrollTo(p.id)}
            data-ocid={`crafting.${p.id.toLowerCase()}.tab`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeProfession === p.id ? p.activePillColor : p.pillColor,
            )}
          >
            <span>{p.emoji}</span>
            <span>{p.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

// ─── Crafting Filters ─────────────────────────────────────────────────────────

function CraftingFilters({
  searchTerm,
  onSearchChange,
  professionFilter,
  onProfessionFilterChange,
  maxLevel,
  onMaxLevelChange,
  sortBy,
  onSortChange,
  showOnlyPositive,
  onShowOnlyPositiveChange,
  topN,
  onTopNChange,
}: {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  professionFilter: string;
  onProfessionFilterChange: (v: string) => void;
  maxLevel: number;
  onMaxLevelChange: (v: number) => void;
  sortBy: CraftingSortOption;
  onSortChange: (v: CraftingSortOption) => void;
  showOnlyPositive: boolean;
  onShowOnlyPositiveChange: (v: boolean) => void;
  topN: number;
  onTopNChange: (v: number) => void;
}) {
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

      {/* Max Level */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Max Level
        </Label>
        <Input
          data-ocid="crafting.filters.maxlevel_input"
          type="number"
          min="1"
          max="100"
          placeholder="100"
          value={maxLevel >= 100 ? "" : maxLevel.toString()}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value);
            onMaxLevelChange(Number.isNaN(v) ? 100 : Math.max(1, v));
          }}
          className="bg-surface-2 text-sm"
        />
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
            {PROFESSIONS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.emoji} {p.label}
              </SelectItem>
            ))}
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
            <SelectItem value="level">Level (asc)</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="margin">Margin %</SelectItem>
            <SelectItem value="craftAdvantage">
              Craft Advantage (best to craft)
            </SelectItem>
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
            <SelectItem value="25">25 per section</SelectItem>
            <SelectItem value="50">50 per section</SelectItem>
            <SelectItem value="100">100 per section</SelectItem>
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

  // Sell vs Craft stats
  const craftBetterCount = results.filter((r) => r.verdict === "craft").length;
  const sellRawBetterCount = results.filter(
    (r) => r.verdict === "sell_raw",
  ).length;
  const bestCraftAdvantage =
    results.filter((r) => r.verdict === "craft").length > 0
      ? results
          .filter((r) => r.verdict === "craft")
          .reduce((best, r) =>
            r.craftAdvantage > best.craftAdvantage ? r : best,
          )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Priced Recipes
          </div>
          <div className="font-num mt-0.5 text-xl font-bold">
            {pricedResults.length}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {totalItems}
            </span>
          </div>
        </div>
      </div>

      <Separator />

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

      <Separator />

      {/* Sell vs Craft summary */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sell vs Craft
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-profit/10 border border-profit/20 p-2 text-center">
            <div className="font-num text-xl font-bold text-profit">
              {craftBetterCount}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              better to craft
            </div>
          </div>
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-2 text-center">
            <div className="font-num text-xl font-bold text-warning">
              {sellRawBetterCount}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              sell raw instead
            </div>
          </div>
        </div>

        {bestCraftAdvantage && (
          <div className="rounded-lg bg-surface-2 p-2.5 space-y-0.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Best Craft Advantage
            </div>
            <div
              className="text-xs font-medium truncate"
              title={bestCraftAdvantage.recipeName}
            >
              {bestCraftAdvantage.recipeName}
            </div>
            <div className="font-num text-sm font-bold text-profit">
              +{formatLarge(bestCraftAdvantage.craftAdvantage)}s vs selling raw
            </div>
          </div>
        )}
      </div>

      <Separator />

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

      {/* Price sync tip */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-medium text-emerald-300">Price Sync</span>
        </div>
        Prices set in Farming, Herbalism, or other tabs automatically appear in
        crafting material inputs.
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CraftingCalculator() {
  const { data: recipes, isLoading, error, refetch } = useAllCrafting();
  const config = useConfigStore();
  const { getPrice, guildMode } = usePriceBookStore();
  const { isAdmin } = useIsAdmin();
  const isReadOnly = guildMode && !isAdmin;
  const itemSourceMap = useItemSourceMap();

  const [searchTerm, setSearchTerm] = useState("");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [maxLevel, setMaxLevel] = useState(100);
  const [sortBy, setSortBy] = useState<CraftingSortOption>("level");
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(9999);

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

  // Build result map for quick lookup
  const resultMap = useMemo(() => {
    const map = new Map<number, CraftingProfitResult>();
    for (const r of allResults) map.set(r.recipeId, r);
    return map;
  }, [allResults]);

  // Available professions
  const availableProfessions = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes ?? []) set.add(r.profession ?? "Unknown");
    return Array.from(set);
  }, [recipes]);

  // Filtered recipes grouped by profession → category
  const filteredAndGrouped = useMemo(() => {
    if (!recipes) return new Map<string, CraftingRecipe[]>();

    const filtered = recipes.filter((recipe) => {
      if (
        searchTerm &&
        !recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      if (
        professionFilter !== "all" &&
        (recipe.profession ?? "Unknown") !== professionFilter
      )
        return false;
      if (recipe.level > maxLevel) return false;
      if (showOnlyPositive) {
        const result = resultMap.get(recipe.itemId);
        if (!result || result.profit <= 0) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "profit": {
          const ra = resultMap.get(a.itemId);
          const rb = resultMap.get(b.itemId);
          return (rb?.profit ?? 0) - (ra?.profit ?? 0);
        }
        case "margin": {
          const ra = resultMap.get(a.itemId);
          const rb = resultMap.get(b.itemId);
          return (rb?.profitMargin ?? 0) - (ra?.profitMargin ?? 0);
        }
        case "craftAdvantage": {
          const ra = resultMap.get(a.itemId);
          const rb = resultMap.get(b.itemId);
          // "craft" verdict items come first, then by craftAdvantage descending
          const verdictOrder = (v: string | undefined) =>
            v === "craft" ? 0 : v === "even" ? 1 : v === "sell_raw" ? 2 : 3;
          const vA = verdictOrder(ra?.verdict);
          const vB = verdictOrder(rb?.verdict);
          if (vA !== vB) return vA - vB;
          return (rb?.craftAdvantage ?? 0) - (ra?.craftAdvantage ?? 0);
        }
        case "level":
          return a.level - b.level;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    // Group by profession
    const grouped = new Map<string, CraftingRecipe[]>();
    for (const recipe of filtered) {
      const prof = recipe.profession ?? "Unknown";
      const arr = grouped.get(prof) ?? [];
      arr.push(recipe);
      grouped.set(prof, arr);
    }

    // Apply topN per profession/section
    if (topN < 9999) {
      for (const [prof, arr] of grouped) {
        grouped.set(prof, arr.slice(0, topN));
      }
    }

    return grouped;
  }, [
    recipes,
    searchTerm,
    professionFilter,
    maxLevel,
    showOnlyPositive,
    sortBy,
    topN,
    resultMap,
  ]);

  const totalFiltered = useMemo(() => {
    let count = 0;
    for (const arr of filteredAndGrouped.values()) count += arr.length;
    return count;
  }, [filteredAndGrouped]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => i).map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
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

  // Determine profession render order
  const professionOrder: string[] = PROFESSIONS.map(
    (p) => p.id as string,
  ).filter((id) => filteredAndGrouped.has(id));
  // Add any extra professions not in our known list
  for (const prof of filteredAndGrouped.keys()) {
    if (!professionOrder.includes(prof)) professionOrder.push(prof);
  }

  let globalRowOffset = 0;

  return (
    <CalculatorLayout
      filters={
        <CraftingFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          professionFilter={professionFilter}
          onProfessionFilterChange={setProfessionFilter}
          maxLevel={maxLevel}
          onMaxLevelChange={setMaxLevel}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showOnlyPositive={showOnlyPositive}
          onShowOnlyPositiveChange={setShowOnlyPositive}
          topN={topN}
          onTopNChange={setTopN}
        />
      }
      results={
        <div>
          {/* Top profession nav pills — scroll-only, no filtering */}
          <ProfessionNavPills
            availableProfessions={availableProfessions}
            activeProfession={professionFilter}
          />

          {/* Count */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {totalFiltered}
              </span>{" "}
              recipes
              {(recipes?.length ?? 0) > totalFiltered && (
                <span className="text-muted-foreground">
                  {" "}
                  of {recipes?.length}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1 align-middle" />
              Green dot = price synced from another tab
            </p>
          </div>

          {/* Empty state */}
          {totalFiltered === 0 ? (
            <div
              data-ocid="crafting.empty_state"
              className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <div>
                <p className="font-medium text-muted-foreground">
                  No recipes match your filters
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting profession or level filter
                </p>
              </div>
            </div>
          ) : (
            professionOrder.map((profId) => {
              const profRecipes = filteredAndGrouped.get(profId);
              if (!profRecipes || profRecipes.length === 0) return null;
              const offset = globalRowOffset;
              globalRowOffset += profRecipes.length;
              return (
                <ProfessionSection
                  key={profId}
                  professionId={profId}
                  recipes={profRecipes}
                  results={resultMap}
                  rowOffset={offset}
                  itemSourceMap={itemSourceMap}
                  readOnly={isReadOnly}
                />
              );
            })
          )}
        </div>
      }
      summary={
        <CraftingSummaryPanel
          results={allResults.filter((r) => {
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
