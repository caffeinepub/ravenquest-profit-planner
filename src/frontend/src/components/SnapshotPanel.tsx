import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BandStats } from "@/lib/calculator/growTimeBands";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useSnapshotStore } from "@/lib/snapshots/store";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Clock,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SnapshotPanelProps {
  currentBandStats: BandStats[];
}

function fmtRate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}s/h`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function SnapshotPanel({ currentBandStats }: SnapshotPanelProps) {
  const { snapshots, saveSnapshot, removeSnapshot, getLatest } =
    useSnapshotStore();
  const { priceBook } = usePriceBookStore();
  const [open, setOpen] = useState(false);

  const latestSnapshot = getLatest();

  const handleSave = () => {
    const label = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    saveSnapshot(label, priceBook, currentBandStats);
    toast.success("Snapshot saved");
  };

  const handleRemove = (id: string) => {
    removeSnapshot(id);
    toast.success("Snapshot removed");
  };

  // Build band delta table comparing currentBandStats with latestSnapshot
  const bandDeltas = latestSnapshot
    ? currentBandStats.map((cur) => {
        const snap = latestSnapshot.bandStats.find(
          (s) => s.band.key === cur.band.key,
        );
        const snapAvg = snap?.avgSilverPerHour ?? 0;
        const curAvg = cur.avgSilverPerHour;
        const pctChange =
          snapAvg > 0 ? ((curAvg - snapAvg) / snapAvg) * 100 : null;
        return {
          band: cur.band,
          currentAvg: curAvg,
          snapshotAvg: snapAvg,
          pctChange,
          hasData: cur.hasData,
        };
      })
    : [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2">
            <Clock className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="flex-1 text-left font-semibold text-foreground">
            Price Snapshots
          </span>
          {snapshots.length > 0 && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-400 border border-violet-500/30">
              {snapshots.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-xl border border-border bg-surface-1 p-4 space-y-4">
          {/* Save button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Save current prices &amp; band stats as a reference point
            </p>
            <Button
              data-ocid="snapshot.save_button"
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="gap-1.5 bg-surface-2 text-xs shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              Save Snapshot
            </Button>
          </div>

          {/* Snapshot list */}
          {snapshots.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="border-b border-border bg-surface-2 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">
                  Saved snapshots (most recent first)
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="flex-1 text-sm text-foreground">
                      {snap.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(snap.priceBook).length} prices
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(snap.id)}
                      className="rounded p-1 text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 bg-surface-2/30 py-6 text-center">
              <p className="text-xs text-muted-foreground">No snapshots yet</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                Save a snapshot to track price changes over time
              </p>
            </div>
          )}

          {/* Band delta comparison */}
          {latestSnapshot && bandDeltas.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="border-b border-border bg-surface-2 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">
                  Change vs latest snapshot
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Compared to: {latestSnapshot.label}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs py-2">Band</TableHead>
                    <TableHead className="text-xs text-right py-2">
                      Current avg s/h
                    </TableHead>
                    <TableHead className="text-xs text-right py-2">
                      Snapshot avg s/h
                    </TableHead>
                    <TableHead className="text-xs text-right py-2">
                      Change
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bandDeltas.map((delta) => (
                    <TableRow key={delta.band.key} className="border-border">
                      <TableCell className="py-2 text-sm font-bold">
                        <div className="flex items-center gap-1.5">
                          <span>{delta.band.icon}</span>
                          <span className="text-xs">{delta.band.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-xs text-foreground">
                        {delta.hasData ? fmtRate(delta.currentAvg) : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-xs text-muted-foreground">
                        {delta.snapshotAvg > 0
                          ? fmtRate(delta.snapshotAvg)
                          : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums text-xs">
                        {delta.pctChange !== null ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5",
                              delta.pctChange >= 0
                                ? "text-emerald-400"
                                : "text-red-400",
                            )}
                          >
                            {delta.pctChange >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {fmtPct(delta.pctChange)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Clear all */}
          {snapshots.length > 0 && (
            <div className="flex justify-end">
              <Button
                data-ocid="snapshot.clear_button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-red-400 gap-1.5"
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all snapshots? This cannot be undone.",
                    )
                  ) {
                    useSnapshotStore.getState().clearAll();
                    toast.success("All snapshots cleared");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all snapshots
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
