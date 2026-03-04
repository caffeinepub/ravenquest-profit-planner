import { Separator } from "@/components/ui/separator";
import type { ProfitResult } from "@/lib/calculator/types";
import { Award, BarChart3, Database, TrendingUp } from "lucide-react";

interface SummaryPanelProps {
  results: ProfitResult[];
  totalItems: number;
}

function formatGold(num: number): string {
  if (!Number.isFinite(num)) return "—";
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function SummaryPanel({ results, totalItems }: SummaryPanelProps) {
  const pricedResults = results.filter((r) => r.confidence !== "low");
  const positiveResults = pricedResults.filter((r) => r.profitPerHarvest > 0);

  const totalProfit = positiveResults.reduce(
    (sum, r) => sum + r.profitPerHarvest,
    0,
  );

  const bestItem =
    pricedResults.length > 0
      ? pricedResults.reduce((best, r) =>
          r.profitPerHarvest > best.profitPerHarvest ? r : best,
        )
      : null;

  const avgMargin =
    pricedResults.length > 0
      ? pricedResults.reduce((sum, r) => {
          const margin =
            r.totalRevenue > 0
              ? (r.profitPerHarvest / r.totalRevenue) * 100
              : 0;
          return sum + margin;
        }, 0) / pricedResults.length
      : null;

  const pricedCount = results.filter((r) => r.confidence !== "low").length;

  return (
    <div className="space-y-5">
      {/* Prices set */}
      <div className="flex items-start gap-2">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prices Set
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

      {/* Total potential profit */}
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
            {positiveResults.length > 0 ? `+${formatGold(totalProfit)}g` : "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {positiveResults.length} of {results.length} profitable
          </div>
        </div>
      </div>

      <Separator />

      {/* Best item */}
      {bestItem && bestItem.profitPerHarvest > 0 && (
        <>
          <div className="flex items-start gap-2">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Best Item
              </div>
              <div
                className="mt-0.5 truncate text-sm font-medium"
                title={bestItem.name}
              >
                {bestItem.name}
              </div>
              <div className="font-num text-lg font-bold text-profit">
                +{formatGold(bestItem.profitPerHarvest)}g
              </div>
              {bestItem.profitPerHour !== null && (
                <div className="font-num text-xs text-muted-foreground">
                  {formatGold(bestItem.profitPerHour)}g/h
                </div>
              )}
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
            across {pricedResults.length} priced items
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
