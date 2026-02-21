import { TrendingUp, Award, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { ProfitResult } from "@/lib/calculator/types";

interface SummaryProps {
  results: ProfitResult[];
}

export function Summary({ results }: SummaryProps) {
  const totalProfit = results.reduce((sum, r) => sum + r.profit, 0);
  const positiveResults = results.filter((r) => r.profit > 0);
  const bestProfit = results.length > 0
    ? results.reduce((best, r) => (r.profit > best.profit ? r : best))
    : null;

  const confidenceBreakdown = {
    high: results.filter((r) => r.confidence === "high").length,
    medium: results.filter((r) => r.confidence === "medium").length,
    low: results.filter((r) => r.confidence === "low").length,
  };

  return (
    <div className="space-y-4">
      {/* Total Profit */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Total Profit</span>
        </div>
        <p
          className={`mt-1 font-mono text-2xl font-bold ${
            totalProfit > 0
              ? "text-success"
              : totalProfit < 0
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {totalProfit.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          {positiveResults.length} of {results.length} profitable
        </p>
      </div>

      <Separator />

      {/* Best Profit */}
      {bestProfit && bestProfit.profit > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="h-4 w-4" />
            <span>Best Profit</span>
          </div>
          <p className="mt-1 font-medium">{bestProfit.name}</p>
          <p className="font-mono text-lg font-bold text-success">
            +{bestProfit.profit.toFixed(2)}
          </p>
        </div>
      )}

      <Separator />

      {/* Confidence Breakdown */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>Data Confidence</span>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>High</span>
            <Badge variant="default">{confidenceBreakdown.high}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Medium</span>
            <Badge variant="secondary">{confidenceBreakdown.medium}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Low</span>
            <Badge variant="destructive">{confidenceBreakdown.low}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
