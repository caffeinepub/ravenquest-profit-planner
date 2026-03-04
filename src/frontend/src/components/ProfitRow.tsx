import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { GatheringItem, HusbandryItem } from "@/lib/api/types";
import {
  calculateGatheringProfit,
  calculateHusbandryProfit,
} from "@/lib/calculator/profitEngine";
import type { ProfitResult } from "@/lib/calculator/types";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

// ─── Shared helpers ────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatGold(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Confidence Badge ──────────────────────────────────────────────────────

function ConfidencePip({
  confidence,
}: { confidence: "high" | "medium" | "low" }) {
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

// ─── Inline Price Input ────────────────────────────────────────────────────

interface PriceInputProps {
  itemId: number;
  itemName: string;
  index: number;
}

function PriceInput({ itemId, itemName, index }: PriceInputProps) {
  const { getPrice, setPrice } = usePriceBookStore();
  const currentPrice = getPrice(itemId);
  const [localValue, setLocalValue] = useState(
    currentPrice !== null ? currentPrice.toString() : "",
  );

  const handleBlur = useCallback(() => {
    const parsed = Number.parseFloat(localValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(itemId, itemName, parsed);
    } else if (localValue === "") {
      // Clear the price
      setPrice(itemId, itemName, 0);
    }
  }, [localValue, itemId, itemName, setPrice]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      const parsed = Number.parseFloat(e.target.value);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        setPrice(itemId, itemName, parsed);
      }
    },
    [itemId, itemName, setPrice],
  );

  return (
    <Input
      data-ocid={`profit_row.price_input.${index}`}
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

// ─── Quantity Input ────────────────────────────────────────────────────────

interface QuantityInputProps {
  value: number;
  onChange: (v: number) => void;
  index: number;
  label: string;
}

function QuantityInput({ value, onChange, index, label }: QuantityInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Input
        data-ocid={`profit_row.quantity_input.${index}`}
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value);
          if (!Number.isNaN(v) && v >= 1) onChange(v);
        }}
        className="h-7 w-16 bg-surface-2 text-center font-mono text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

// ─── Profit Display ────────────────────────────────────────────────────────

function ProfitDisplay({
  result,
  showPerHour,
}: {
  result: ProfitResult;
  showPerHour?: boolean;
}) {
  if (result.confidence === "low") {
    return (
      <span className="text-xs text-muted-foreground">
        Set prices to calculate
      </span>
    );
  }

  const value = showPerHour ? result.profitPerHour : result.profitPerHarvest;

  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;

  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <span
      className={cn(
        "font-num text-sm font-semibold tabular-nums",
        isPositive && "text-profit glow-gold",
        isNegative && "text-loss",
        !isPositive && !isNegative && "text-muted-foreground",
      )}
    >
      {isPositive ? "+" : ""}
      {formatGold(value)}
      {result.confidence === "medium" && (
        <span className="ml-1 text-xs text-warning">~</span>
      )}
    </span>
  );
}

// ─── Gathering Profit Row ──────────────────────────────────────────────────

interface GatheringProfitRowProps {
  item: GatheringItem;
  rowIndex: number;
  quantityLabel?: string;
}

export function GatheringProfitRow({
  item,
  rowIndex,
  quantityLabel = "Plots",
}: GatheringProfitRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { getPrice } = usePriceBookStore();
  const { landMultiplier, marketFeePercent } = useConfigStore();

  const result = calculateGatheringProfit(item, quantity, {
    landMultiplier,
    marketFeePercent,
    getPrice,
  });

  const profitColor =
    result.confidence === "low"
      ? "text-muted-foreground"
      : result.profitPerHarvest > 0
        ? "text-profit"
        : result.profitPerHarvest < 0
          ? "text-loss"
          : "text-muted-foreground";

  return (
    <div
      data-ocid={`profit_row.item.${rowIndex}`}
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
            <span className="font-medium">{item.name}</span>
            <Badge
              variant="outline"
              className="border-border/50 px-1.5 py-0 text-[10px] text-muted-foreground"
            >
              Lvl {item.skillRequired}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(item.growingTime)}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.items.map((drop) => drop.name).join(" · ")}
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="hidden shrink-0 items-center gap-4 sm:flex"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            index={rowIndex}
            label={quantityLabel}
          />
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
                {result.profitPerHarvest > 0 ? (
                  <TrendingUp className="inline h-3.5 w-3.5 mr-1" />
                ) : result.profitPerHarvest < 0 ? (
                  <TrendingDown className="inline h-3.5 w-3.5 mr-1" />
                ) : null}
                {formatGold(result.profitPerHarvest)}g
              </>
            )}
          </div>
          {result.profitPerHour !== null && result.confidence !== "low" && (
            <div className="font-num text-xs text-muted-foreground">
              <Zap className="inline h-3 w-3 mr-0.5" />
              {formatGold(result.profitPerHour)}/h
            </div>
          )}
        </div>

        <div className="shrink-0">
          <ConfidencePip confidence={result.confidence} />
        </div>
      </button>

      {/* ── Mobile Quantity ── */}
      <div
        className="flex items-center px-4 pb-2 sm:hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <QuantityInput
          value={quantity}
          onChange={setQuantity}
          index={rowIndex}
          label={quantityLabel}
        />
      </div>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <div className="border-t border-border/50 bg-surface-2/40 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Output items with inline price inputs */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Output Items — Set Market Prices
              </h4>
              <div className="space-y-2">
                {result.outputItems.map((output, i) => (
                  <div
                    key={output.itemId}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-1 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {output.itemName}
                      </div>
                      <div className="font-num text-xs text-muted-foreground">
                        Drop: {output.countMin}–{output.countMax} ×{" "}
                        {landMultiplier}x × {quantity} ={" "}
                        <span className="text-foreground/70">
                          ~
                          {output.yieldPerHarvest.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriceInput
                        itemId={output.itemId}
                        itemName={output.itemName}
                        index={rowIndex * 10 + i + 1}
                      />
                      <span className="font-num text-xs text-muted-foreground">
                        ea
                      </span>
                      <span
                        className={cn(
                          "font-num w-20 text-right text-xs",
                          output.price !== null
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {output.price !== null
                          ? `= ${formatGold(output.revenueContribution)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
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
                    <span className="text-muted-foreground">Gross Revenue</span>
                    <span className="font-num">
                      {result.confidence === "low"
                        ? "—"
                        : `${formatGold(result.totalRevenue)}g`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Market Fee ({marketFeePercent}%)
                    </span>
                    <span className="font-num text-loss">
                      {result.confidence === "low"
                        ? "—"
                        : `−${formatGold(result.totalRevenue - result.netRevenue)}g`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
                    <span>Net Per Harvest</span>
                    <ProfitDisplay result={result} />
                  </div>
                  {result.profitPerHour !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per Hour</span>
                      <ProfitDisplay result={result} showPerHour />
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP / Harvest</span>
                    <span className="font-num">
                      {item.experience.toLocaleString()}
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

// ─── Husbandry Profit Row ──────────────────────────────────────────────────

interface HusbandryProfitRowProps {
  item: HusbandryItem;
  rowIndex: number;
  mode: "gathering" | "butchering";
}

export function HusbandryProfitRow({
  item,
  rowIndex,
  mode,
}: HusbandryProfitRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { getPrice } = usePriceBookStore();
  const { landMultiplier, marketFeePercent } = useConfigStore();

  // Check if mode is available
  const drops =
    mode === "gathering" ? item.items.gathering : item.items.butchering;
  const time =
    mode === "gathering" ? item.time.gathering : item.time.butchering;
  const isAvailable = time > 0 && drops !== null && drops.length > 0;

  if (!isAvailable) {
    return (
      <div
        data-ocid={`profit_row.item.${rowIndex}`}
        className="rounded-lg border border-border/40 bg-surface-1/50 px-4 py-3 opacity-50"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">{item.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {mode === "gathering" ? "No Gathering" : "No Butchering"}
          </Badge>
        </div>
      </div>
    );
  }

  const result = calculateHusbandryProfit(item, mode, quantity, {
    landMultiplier,
    marketFeePercent,
    getPrice,
  });

  const profitColor =
    result.confidence === "low"
      ? "text-muted-foreground"
      : result.profitPerHarvest > 0
        ? "text-profit"
        : result.profitPerHarvest < 0
          ? "text-loss"
          : "text-muted-foreground";

  return (
    <div
      data-ocid={`profit_row.item.${rowIndex}`}
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
            <span className="font-medium">{item.name}</span>
            <Badge
              variant="outline"
              className="border-border/50 px-1.5 py-0 text-[10px] text-muted-foreground"
            >
              Lvl {item.skillRequired}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(time)}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {(drops ?? []).map((d) => d.name).join(" · ")}
          </div>
        </div>

        <div
          className="hidden shrink-0 items-center gap-4 sm:flex"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            index={rowIndex}
            label="Pens"
          />
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
                {result.profitPerHarvest > 0 ? (
                  <TrendingUp className="inline h-3.5 w-3.5 mr-1" />
                ) : null}
                {formatGold(result.profitPerHarvest)}g
              </>
            )}
          </div>
          {result.profitPerHour !== null && result.confidence !== "low" && (
            <div className="font-num text-xs text-muted-foreground">
              <Zap className="inline h-3 w-3 mr-0.5" />
              {formatGold(result.profitPerHour)}/h
            </div>
          )}
        </div>

        <div className="shrink-0">
          <ConfidencePip confidence={result.confidence} />
        </div>
      </button>

      <div
        className="flex items-center px-4 pb-2 sm:hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <QuantityInput
          value={quantity}
          onChange={setQuantity}
          index={rowIndex}
          label="Pens"
        />
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-surface-2/40 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Output Items — Set Market Prices
              </h4>
              <div className="space-y-2">
                {result.outputItems.map((output, i) => (
                  <div
                    key={output.itemId}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-1 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {output.itemName}
                      </div>
                      <div className="font-num text-xs text-muted-foreground">
                        Drop: {output.countMin}–{output.countMax} ×{" "}
                        {landMultiplier}x × {quantity} ={" "}
                        <span className="text-foreground/70">
                          ~
                          {output.yieldPerHarvest.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriceInput
                        itemId={output.itemId}
                        itemName={output.itemName}
                        index={rowIndex * 10 + i + 1}
                      />
                      <span className="font-num text-xs text-muted-foreground">
                        ea
                      </span>
                      <span
                        className={cn(
                          "font-num w-20 text-right text-xs",
                          output.price !== null
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {output.price !== null
                          ? `= ${formatGold(output.revenueContribution)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Profit Breakdown
              </h4>
              <div className="rounded-md bg-surface-1 px-3 py-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Revenue</span>
                    <span className="font-num">
                      {result.confidence === "low"
                        ? "—"
                        : `${formatGold(result.totalRevenue)}g`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Market Fee ({marketFeePercent}%)
                    </span>
                    <span className="font-num text-loss">
                      {result.confidence === "low"
                        ? "—"
                        : `−${formatGold(result.totalRevenue - result.netRevenue)}g`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
                    <span>Net Per Harvest</span>
                    <ProfitDisplay result={result} />
                  </div>
                  {result.profitPerHour !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Per Hour</span>
                      <ProfitDisplay result={result} showPerHour />
                    </div>
                  )}
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
