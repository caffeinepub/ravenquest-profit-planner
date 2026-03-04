import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ProfitResult } from "@/lib/calculator/types";
import {
  Award,
  BarChart3,
  Clock,
  Database,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface Top24hItem {
  name: string;
  profit24h: number;
  profitPerHour: number;
  category: string;
}

export interface BestWindowEntry {
  name: string;
  category: string;
  windowProfit: number;
  harvests: number;
  profitPerHarvest: number;
  harvestTime: number;
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  Farming: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Herbalism: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  Woodcutting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Husbandry: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Crafting: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

interface SummaryPanelProps {
  results: ProfitResult[];
  totalItems: number;
  top24hItem?: Top24hItem | null;
  bestByWindow?: Record<number, BestWindowEntry | null>;
}

function formatGold(num: number): string {
  if (!Number.isFinite(num)) return "—";
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function SummaryPanel({
  results,
  totalItems,
  top24hItem,
  bestByWindow,
}: SummaryPanelProps) {
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
            {positiveResults.length > 0 ? `+${formatGold(totalProfit)}s` : "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {positiveResults.length} of {results.length} profitable
          </div>
        </div>
      </div>

      <Separator />

      {/* Best 24h Earner */}
      {top24hItem ? (
        <>
          <div className="flex items-start gap-2">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Best 24h Earner
              </div>
              <div
                className="mt-0.5 truncate text-sm font-medium"
                title={top24hItem.name}
              >
                {top24hItem.name}
              </div>
              <Badge
                variant="outline"
                className="mt-0.5 px-1 py-0 text-[9px] font-medium border-border/50 text-muted-foreground"
              >
                {top24hItem.category}
              </Badge>
              <div className="font-num mt-1 text-lg font-bold text-gold glow-gold">
                +
                {top24hItem.profit24h.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                s
              </div>
              <div className="font-num flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {top24hItem.profitPerHour.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                s/h
              </div>
            </div>
          </div>

          <Separator />
        </>
      ) : null}

      {/* Best per Time Window */}
      {(() => {
        const TIME_WINDOWS = [2, 4, 6, 8, 12, 24];
        const hasAnyEntry =
          bestByWindow && TIME_WINDOWS.some((w) => bestByWindow[w] != null);
        const hasNoData = !bestByWindow || !hasAnyEntry;

        return (
          <>
            <div className="rounded-lg bg-surface-2 p-3">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Best per Time Window
                </span>
              </div>

              {hasNoData ? (
                <p className="text-xs text-muted-foreground/70 italic">
                  Set item prices to unlock
                </p>
              ) : (
                <div className="divide-y divide-border/20">
                  {TIME_WINDOWS.map((W) => {
                    const entry = bestByWindow?.[W] ?? null;
                    return (
                      <div
                        key={W}
                        className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
                      >
                        {/* Window label */}
                        <span className="font-mono w-7 shrink-0 text-[11px] text-muted-foreground">
                          {W}h
                        </span>

                        {entry ? (
                          <>
                            {/* Item name + category */}
                            <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
                              <span
                                className="truncate text-xs font-medium leading-tight"
                                title={entry.name}
                              >
                                {entry.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`shrink-0 border px-1 py-0 text-[9px] font-medium leading-tight ${CATEGORY_BADGE_COLORS[entry.category] ?? "bg-surface-3 text-muted-foreground border-border"}`}
                              >
                                {entry.category}
                              </Badge>
                            </div>

                            {/* Profit + harvests */}
                            <div className="shrink-0 text-right">
                              <div className="font-mono text-[11px] font-semibold tabular-nums text-profit leading-tight">
                                +
                                {entry.windowProfit.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                                s
                              </div>
                              <div className="font-mono text-[9px] text-muted-foreground tabular-nums leading-tight">
                                ×{entry.harvests} harvests
                              </div>
                            </div>
                          </>
                        ) : (
                          <span className="flex-1 text-xs text-muted-foreground/40">
                            —
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />
          </>
        );
      })()}

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
                +{formatGold(bestItem.profitPerHarvest)}s
              </div>
              {bestItem.profitPerHour !== null && (
                <div className="font-num text-xs text-muted-foreground">
                  {formatGold(bestItem.profitPerHour)}s/h
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
