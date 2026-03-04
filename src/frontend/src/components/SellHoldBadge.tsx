import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePriceHistoryStore } from "@/lib/priceHistory/store";
import { cn } from "@/lib/utils";
import { Minus, Package, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SellHoldBadgeProps {
  itemId: number;
  currentPrice: number | null;
  showTooltip?: boolean;
  size?: "sm" | "xs";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSilver(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pctDiff(current: number, baseline: number): string {
  if (baseline === 0) return "0%";
  const pct = ((current - baseline) / baseline) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function formatMethod(method: string): string {
  switch (method) {
    case "7d_rolling_avg":
      return "7-day avg";
    case "last_30_avg":
      return "last 30 pts avg";
    case "last_10_avg":
      return "last 10 pts avg";
    default:
      return method;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SellHoldBadge({
  itemId,
  currentPrice,
  showTooltip = true,
  size = "sm",
}: SellHoldBadgeProps) {
  const { getSignal, computeBaseline } = usePriceHistoryStore();

  if (currentPrice === null) return null;

  const signal = getSignal(itemId, currentPrice);
  const baseline = computeBaseline(itemId);

  if (signal === null) return null;

  const isXs = size === "xs";
  const baseClass = cn(
    "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide select-none",
    isXs ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
  );

  const colorClass = {
    SELL: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    HOLD: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    STOCKPILE: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  }[signal];

  const icon = {
    SELL: <TrendingUp className={cn(isXs ? "h-2.5 w-2.5" : "h-3 w-3")} />,
    HOLD: <Minus className={cn(isXs ? "h-2.5 w-2.5" : "h-3 w-3")} />,
    STOCKPILE: <Package className={cn(isXs ? "h-2.5 w-2.5" : "h-3 w-3")} />,
  }[signal];

  const badge = (
    <span
      data-ocid={`sell_hold_badge.${itemId}`}
      className={cn(baseClass, colorClass)}
    >
      {icon}
      {signal}
    </span>
  );

  if (!showTooltip || !baseline) return badge;

  const lowerBand =
    baseline.volatility === 0
      ? baseline.baseline * 0.95
      : baseline.baseline - baseline.volatility;
  const upperBand =
    baseline.volatility === 0
      ? baseline.baseline * 1.05
      : baseline.baseline + baseline.volatility;

  const signalExplanation =
    signal === "SELL"
      ? `Price is ${pctDiff(currentPrice, baseline.baseline)} above normal — good time to sell`
      : signal === "STOCKPILE"
        ? `Price is ${pctDiff(currentPrice, baseline.baseline)} below normal — good to accumulate`
        : "Price is within normal range";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-56 space-y-1.5 rounded-lg border border-border bg-surface-1 p-3 text-xs shadow-lg"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Baseline</span>
              <span className="font-mono font-semibold text-foreground">
                {fmtSilver(baseline.baseline)}s
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {baseline.dataPoints} data points ·{" "}
              {formatMethod(baseline.method)}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current</span>
            <span className="font-mono font-semibold text-foreground">
              {fmtSilver(currentPrice)}s
            </span>
          </div>
          <div className="border-t border-border/50 pt-1.5">
            <p
              className={cn(
                "font-semibold",
                signal === "SELL"
                  ? "text-emerald-400"
                  : signal === "STOCKPILE"
                    ? "text-blue-400"
                    : "text-amber-400",
              )}
            >
              {signal}: {signalExplanation}
            </p>
          </div>
          {baseline.volatility > 0 && (
            <div className="text-[10px] text-muted-foreground/70">
              Volatility: ±{fmtSilver(baseline.volatility)}s · Normal range:{" "}
              {fmtSilver(lowerBand)}s – {fmtSilver(upperBand)}s
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
