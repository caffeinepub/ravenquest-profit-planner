import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { ResultsTable } from "@/components/ResultsTable";
import { Summary } from "@/components/Summary";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EmptyState } from "@/components/EmptyState";
import { useHusbandry } from "@/hooks/useQueries";
import { useConfigStore } from "@/store/configStore";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { calculateHusbandryProfit } from "@/lib/calculator/profitEngine";
import type { ProfitResult } from "@/lib/calculator/types";

export function HusbandryCalculator() {
  const { data, isLoading, error, refetch } = useHusbandry();
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const [mode, setMode] = useState<"gathering" | "butchering">("gathering");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit");
  const [minSkill, setMinSkill] = useState(1);
  const [maxSkill, setMaxSkill] = useState(100);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);

  const results = useMemo<ProfitResult[]>(() => {
    if (!data) return [];

    return data.map((item) =>
      calculateHusbandryProfit(item, mode, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        craftingFee: config.craftingFee,
        listingFee: config.listingFee,
        includeOpportunityCost: config.includeOpportunityCost,
        getPrice,
      }),
    );
  }, [data, mode, config, getPrice]);

  const filteredResults = useMemo(() => {
    let filtered = results.filter((r) => {
      if (
        searchTerm &&
        !r.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (r.skillRequired < minSkill || r.skillRequired > maxSkill) {
        return false;
      }
      if (showOnlyPositive && r.profit <= 0) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "profit":
          return b.profit - a.profit;
        case "margin":
          return b.profitMargin - a.profitMargin;
        case "profitPerTime":
          return (b.profitPerTime ?? 0) - (a.profitPerTime ?? 0);
        case "skill":
          return a.skillRequired - b.skillRequired;
        default:
          return 0;
      }
    });

    if (topN < 9999) {
      filtered = filtered.slice(0, topN);
    }

    return filtered;
  }, [results, searchTerm, minSkill, maxSkill, showOnlyPositive, sortBy, topN]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error as Error} retry={refetch} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No Husbandry Data Available"
        description="Unable to fetch husbandry data from the API. Please try again later."
      />
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "gathering" | "butchering")}>
          <TabsList>
            <TabsTrigger value="gathering">Gathering Mode</TabsTrigger>
            <TabsTrigger value="butchering">Butchering Mode</TabsTrigger>
          </TabsList>
          <TabsContent value="gathering" className="mt-0">
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
              results={<ResultsTable results={filteredResults} />}
              summary={<Summary results={filteredResults} />}
            />
          </TabsContent>
          <TabsContent value="butchering" className="mt-0">
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
              results={<ResultsTable results={filteredResults} />}
              summary={<Summary results={filteredResults} />}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
