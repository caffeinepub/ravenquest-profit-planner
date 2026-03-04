import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { GatheringProfitRow } from "@/components/ProfitRow";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarming } from "@/hooks/useQueries";
import { calculateGatheringProfit } from "@/lib/calculator/profitEngine";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useConfigStore } from "@/store/configStore";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

export function FarmingCalculator() {
  const { data, isLoading, error, refetch } = useFarming();
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit");
  const [minSkill, setMinSkill] = useState(1);
  const [maxSkill, setMaxSkill] = useState(100);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);

  // Compute results for summary panel (quantity=1 for summary purposes)
  const summaryResults = useMemo(() => {
    if (!data) return [];
    return data.map((item) =>
      calculateGatheringProfit(item, 1, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice,
      }),
    );
  }, [data, config.landMultiplier, config.marketFeePercent, getPrice]);

  const filteredData = useMemo(() => {
    if (!data) return [];

    // Pre-compute for sorting (quantity=1 for comparisons)
    const withResults = data.map((item) => ({
      item,
      result: calculateGatheringProfit(item, 1, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice,
      }),
    }));

    let filtered = withResults.filter(({ item, result }) => {
      if (
        searchTerm &&
        !item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      if (item.skillRequired < minSkill || item.skillRequired > maxSkill)
        return false;
      if (showOnlyPositive && result.profitPerHarvest <= 0) return false;
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "profit":
          return b.result.profitPerHarvest - a.result.profitPerHarvest;
        case "profitPerHour":
          return (b.result.profitPerHour ?? 0) - (a.result.profitPerHour ?? 0);
        case "skill":
          return a.item.skillRequired - b.item.skillRequired;
        case "name":
          return a.item.name.localeCompare(b.item.name);
        default:
          return 0;
      }
    });

    if (topN < 9999) filtered = filtered.slice(0, topN);
    return filtered.map((f) => f.item);
  }, [
    data,
    searchTerm,
    minSkill,
    maxSkill,
    showOnlyPositive,
    sortBy,
    topN,
    config.landMultiplier,
    config.marketFeePercent,
    getPrice,
  ]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-3">
          {/* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loader */}
          {Array.from({ length: 8 }, (_, i) => i).map((i) => (
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
          data-ocid="farming.error_state"
          className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
        >
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold">Failed to load farming data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(error as Error).message}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
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
        <Filters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          minSkill={minSkill}
          maxSkill={maxSkill}
          onSkillRangeChange={(min, max) => {
            setMinSkill(min);
            setMaxSkill(max);
          }}
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
              {filteredData.length} crops
              {data &&
                filteredData.length < data.length &&
                ` of ${data.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Expand a row to set prices and see profit
            </p>
          </div>

          {filteredData.length === 0 ? (
            <div
              data-ocid="farming.empty_state"
              className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <div>
                <p className="font-medium text-muted-foreground">
                  No crops match your filters
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your search or skill range
                </p>
              </div>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <GatheringProfitRow
                key={item.id}
                item={item}
                rowIndex={index + 1}
                quantityLabel="Plots"
              />
            ))
          )}
        </div>
      }
      summary={
        <SummaryPanel
          results={summaryResults.filter((r) => {
            if (
              searchTerm &&
              !r.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
              return false;
            if (r.skillRequired < minSkill || r.skillRequired > maxSkill)
              return false;
            return true;
          })}
          totalItems={data?.length ?? 0}
        />
      }
    />
  );
}
