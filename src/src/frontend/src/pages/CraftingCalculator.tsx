import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Filters, type SortOption } from "@/components/Filters";
import { ResultsTable } from "@/components/ResultsTable";
import { Summary } from "@/components/Summary";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EmptyState } from "@/components/EmptyState";
import { useAllCrafting } from "@/hooks/useQueries";
import { useConfigStore } from "@/store/configStore";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { calculateCraftingProfit } from "@/lib/calculator/profitEngine";
import type { ProfitResult } from "@/lib/calculator/types";

export function CraftingCalculator() {
  const { data, isLoading, error, refetch } = useAllCrafting();
  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit");
  const [minSkill, setMinSkill] = useState(1);
  const [maxSkill, setMaxSkill] = useState(100);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [topN, setTopN] = useState(50);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.map((r) => r.profession || "Unknown"));
    return Array.from(cats).sort();
  }, [data]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const results = useMemo<ProfitResult[]>(() => {
    if (!data) return [];

    return data.map((item) =>
      calculateCraftingProfit(item, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        craftingFee: config.craftingFee,
        listingFee: config.listingFee,
        includeOpportunityCost: config.includeOpportunityCost,
        getPrice,
      }),
    );
  }, [data, config, getPrice]);

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
      if (
        selectedCategories.length > 0 &&
        r.category &&
        !selectedCategories.includes(r.category)
      ) {
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
  }, [
    results,
    searchTerm,
    minSkill,
    maxSkill,
    showOnlyPositive,
    sortBy,
    topN,
    selectedCategories,
  ]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

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
        title="No Crafting Data Available"
        description="Unable to fetch crafting data from the API. Please try again later."
      />
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
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
        />
      }
      results={<ResultsTable results={filteredResults} />}
      summary={<Summary results={filteredResults} />}
    />
  );
}
