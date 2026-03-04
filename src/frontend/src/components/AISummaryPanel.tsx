import type { BandStats } from "@/lib/calculator/growTimeBands";
import { cn } from "@/lib/utils";

interface LiquidityWarning {
  itemName: string;
  bandKey: string;
  profitPerHour: number;
}

interface AISummaryPanelProps {
  bandStats: BandStats[];
  latestSnapshotBandStats: BandStats[] | null;
  liquidityWarnings: LiquidityWarning[];
  bestBand: BandStats | null;
}

function fmtRate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}s/h`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function Arrow({ val }: { val: number }) {
  if (val > 0) return <span className="text-emerald-400">▲</span>;
  if (val < 0) return <span className="text-red-400">▼</span>;
  return <span className="text-muted-foreground">─</span>;
}

export function AISummaryPanel({
  bandStats,
  latestSnapshotBandStats,
  liquidityWarnings,
  bestBand,
}: AISummaryPanelProps) {
  const ranked = [...bandStats]
    .filter((b) => b.hasData)
    .sort((a, b) => b.avgSilverPerHour - a.avgSilverPerHour)
    .slice(0, 5);

  const hasAnyData = ranked.length > 0;

  // Build snapshot deltas
  const snapshotDeltas: Array<{
    key: string;
    label: string;
    pctChange: number;
  }> = [];
  if (latestSnapshotBandStats) {
    for (const cur of bandStats) {
      if (!cur.hasData) continue;
      const snap = latestSnapshotBandStats.find(
        (s) => s.band.key === cur.band.key,
      );
      if (!snap || snap.avgSilverPerHour === 0) continue;
      const pct =
        ((cur.avgSilverPerHour - snap.avgSilverPerHour) /
          snap.avgSilverPerHour) *
        100;
      snapshotDeltas.push({
        key: cur.band.key,
        label: cur.band.label,
        pctChange: pct,
      });
    }
  }

  return (
    <div
      data-ocid="ai_summary.panel"
      className="rounded-xl border border-border bg-surface-2/80 p-4 font-mono text-sm space-y-1 overflow-x-auto"
    >
      {!hasAnyData ? (
        <p className="text-muted-foreground">
          {"> "}No price data available.{"\n"}Set prices in the Price Book to
          generate a strategy summary.
        </p>
      ) : (
        <>
          {/* Best window */}
          <div className="space-y-0.5">
            <p className="text-muted-foreground/70 text-xs">
              ── Strategy Summary ──────────────────────────────────
            </p>
            {bestBand ? (
              <p>
                <span className="text-muted-foreground">
                  Best grow-time window right now:{" "}
                </span>
                <span className="text-gold font-bold">
                  {bestBand.band.label} ({bestBand.band.rangeLabel})
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Best grow-time window: insufficient data
              </p>
            )}
          </div>

          {/* Top bands ranking */}
          {ranked.length > 0 && (
            <div className="pt-1 space-y-0.5">
              <p className="text-muted-foreground text-xs">
                Top 5 bands by silver/hour:
              </p>
              {ranked.map((b, i) => {
                const isFirst = i === 0;
                return (
                  <p key={b.band.key} className="pl-2">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    <span
                      className={cn(
                        "font-bold",
                        isFirst ? "text-gold" : "text-foreground",
                      )}
                    >
                      {b.band.label.padEnd(8, " ")}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        isFirst
                          ? "text-emerald-400 font-bold"
                          : "text-foreground",
                      )}
                    >
                      {" "}
                      {fmtRate(b.avgSilverPerHour)}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {/* Suggested timer */}
          {bestBand && (
            <p className="pt-1">
              <span className="text-muted-foreground">Suggested timer: </span>
              <span className="text-sky-400 font-semibold">
                {bestBand.band.rangeLabel}
              </span>
            </p>
          )}

          {/* Snapshot deltas */}
          {snapshotDeltas.length > 0 && (
            <div className="pt-1 space-y-0.5">
              <p className="text-muted-foreground text-xs">
                Change since last snapshot:
              </p>
              {snapshotDeltas.map((d) => (
                <p key={d.key} className="pl-2">
                  <span className="text-foreground">
                    {d.label.padEnd(8, " ")}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums font-bold",
                      d.pctChange >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {" "}
                    {fmtPct(d.pctChange)}
                  </span>
                  <span className="ml-1.5">
                    <Arrow val={d.pctChange} />
                  </span>
                </p>
              ))}
            </div>
          )}

          {/* Liquidity warnings */}
          {liquidityWarnings.length > 0 && (
            <div className="pt-1 space-y-0.5">
              <p className="text-muted-foreground text-xs">
                Liquidity warnings:
              </p>
              {liquidityWarnings.slice(0, 5).map((w) => (
                <p
                  key={`${w.itemName}-${w.bandKey}`}
                  className="pl-2 text-amber-400"
                >
                  <span className="text-amber-500">⚠ </span>
                  <span className="font-semibold">{w.itemName}</span>
                  <span className="text-amber-500/80">
                    {" "}
                    ({w.bandKey}): high profit, low market depth
                  </span>
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
