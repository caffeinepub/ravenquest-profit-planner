import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BandStats } from "@/lib/calculator/growTimeBands";
import { AlertTriangle } from "lucide-react";

interface MarketFloodWarningProps {
  bestBand: BandStats | null;
  bandStats: BandStats[];
  rowCap: number;
  onRowCapChange: (n: number) => void;
}

export function MarketFloodWarning({
  bestBand,
  bandStats: _bandStats,
  rowCap,
  onRowCapChange,
}: MarketFloodWarningProps) {
  // Show warning when best band has profitable data (flood risk when scaling up)
  if (!bestBand || !bestBand.hasData) return null;

  return (
    <div
      data-ocid="flood_warning.panel"
      className="flex flex-wrap items-start gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Market Flood Risk — {bestBand.band.label} band
          </p>
          <p className="mt-0.5 text-xs text-amber-400/80">
            High profitability detected in {bestBand.band.label} (
            {bestBand.band.rangeLabel}) — market depth may not absorb large
            quantities. Consider limiting rows per crop to avoid flooding the
            market.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <Label className="text-xs font-semibold text-amber-300 whitespace-nowrap">
          Max rows per crop
        </Label>
        <Input
          data-ocid="flood_warning.row_cap_input"
          type="number"
          min={1}
          max={20}
          value={rowCap}
          onChange={(e) => {
            const val = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val >= 1 && val <= 20) {
              onRowCapChange(val);
            }
          }}
          className="h-8 w-16 bg-amber-500/10 border-amber-500/30 text-amber-200 font-mono text-center text-sm focus-visible:ring-amber-400/40"
        />
      </div>
    </div>
  );
}
