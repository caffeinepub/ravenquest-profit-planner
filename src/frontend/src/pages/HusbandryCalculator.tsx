import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { HusbandryProfitRow } from "@/components/ProfitRow";
import { SummaryPanel } from "@/components/SummaryPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useHusbandry } from "@/hooks/useQueries";
import {
  calculateHusbandryProfit,
  computeProfit24h,
} from "@/lib/calculator/profitEngine";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useConfigStore } from "@/store/configStore";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

type HusbandryMode = "gathering" | "butchering";

function HusbandryContent({
  mode,
  searchTerm,
  sortBy,
  minSkill,
  maxSkill,
  showOnlyPositive,
  topN,
  onSearchChange,
  onSortChange,
  onSkillRangeChange,
  onShowOnlyPositiveChange,
  onTopNChange,
}: {
  mode: HusbandryMode;
  searchTerm: string;
  sortBy: SortOption;
  minSkill: number;
  maxSkill: number;
  showOnlyPositive: boolean;
  topN: number;
  onSearchChange: (v: string) => void;
  onSortChange: (v: SortOption) => void;
  onSkillRangeChange: (min: number, max: number) => void;
  onShowOnlyPositiveChange: (v: boolean) => void;
  onTopNChange: (v: number) => void;
}) {
  const { data, isLoading, error, refetch } = useHusbandry();
  const config = useConfigStore();
  const { getPrice, guildMode } = usePriceBookStore();
  const { isAdmin } = useIsAdmin();
  const isReadOnly = guildMode && !isAdmin;

  const summaryResults = useMemo(() => {
    if (!data) return [];
    return data
      .filter((item) => {
        const drops =
          mode === "gathering" ? item.items.gathering : item.items.butchering;
        const time =
          mode === "gathering" ? item.time.gathering : item.time.butchering;
        return time > 0 && drops !== null && drops.length > 0;
      })
      .map((item) =>
        calculateHusbandryProfit(item, mode, 1, {
          landMultiplier: config.landMultiplier,
          marketFeePercent: config.marketFeePercent,
          getPrice,
        }),
      );
  }, [data, mode, config.landMultiplier, config.marketFeePercent, getPrice]);

  const filteredData = useMemo(() => {
    if (!data) return [];

    const available = data.filter((item) => {
      const drops =
        mode === "gathering" ? item.items.gathering : item.items.butchering;
      const time =
        mode === "gathering" ? item.time.gathering : item.time.butchering;
      return time > 0 && drops !== null && drops.length > 0;
    });

    const withResults = available.map((item) => {
      const result = calculateHusbandryProfit(item, mode, 1, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice,
      });
      const harvestTime =
        mode === "gathering" ? item.time.gathering : item.time.butchering;
      const profit24h = computeProfit24h(result.profitPerHarvest, harvestTime);
      return { item, result, profit24h };
    });

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
        case "profit24h":
          return b.profit24h - a.profit24h;
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
    mode,
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
      <div className="space-y-3 pt-4">
        {/* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loader */}
        {Array.from({ length: 8 }, (_, i) => i).map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-ocid="husbandry.error_state"
        className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center"
      >
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold">Failed to load husbandry data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(error as Error).message}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <CalculatorLayout
      filters={
        <Filters
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          minSkill={minSkill}
          maxSkill={maxSkill}
          onSkillRangeChange={onSkillRangeChange}
          showOnlyPositive={showOnlyPositive}
          onShowOnlyPositiveChange={onShowOnlyPositiveChange}
          topN={topN}
          onTopNChange={onTopNChange}
        />
      }
      results={
        <div className="space-y-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredData.length} animals
              {data &&
                filteredData.length < data.length &&
                ` of ${data.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Expand a row to set prices
            </p>
          </div>
          {filteredData.length === 0 ? (
            <div
              data-ocid="husbandry.empty_state"
              className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-center"
            >
              <p className="font-medium text-muted-foreground">
                No animals match your filters
              </p>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <HusbandryProfitRow
                key={`${item.id}-${mode}`}
                item={item}
                rowIndex={index + 1}
                mode={mode}
                readOnly={isReadOnly}
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

export function HusbandryCalculator() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit24h");
  const [minSkill, setMinSkill] = useState(1);
  const [maxSkill, setMaxSkill] = useState(100);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);

  const sharedProps = {
    searchTerm,
    sortBy,
    minSkill,
    maxSkill,
    showOnlyPositive,
    topN,
    onSearchChange: setSearchTerm,
    onSortChange: setSortBy,
    onSkillRangeChange: (min: number, max: number) => {
      setMinSkill(min);
      setMaxSkill(max);
    },
    onShowOnlyPositiveChange: setShowOnlyPositive,
    onTopNChange: setTopN,
  };

  return (
    <div>
      <div className="container mx-auto px-4 pt-4">
        <Tabs defaultValue="gathering">
          <TabsList className="bg-surface-2">
            <TabsTrigger data-ocid="husbandry.gathering.tab" value="gathering">
              🥚 Gathering
            </TabsTrigger>
            <TabsTrigger
              data-ocid="husbandry.butchering.tab"
              value="butchering"
            >
              🥩 Butchering
            </TabsTrigger>
          </TabsList>
          <TabsContent value="gathering" className="mt-0 pt-2">
            <HusbandryContent mode="gathering" {...sharedProps} />
          </TabsContent>
          <TabsContent value="butchering" className="mt-0 pt-2">
            <HusbandryContent mode="butchering" {...sharedProps} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
