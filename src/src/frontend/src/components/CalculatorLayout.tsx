import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CalculatorLayoutProps {
  filters: ReactNode;
  results: ReactNode;
  summary: ReactNode;
}

export function CalculatorLayout({
  filters,
  results,
  summary,
}: CalculatorLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-24 rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">Filters</h2>
            {filters}
          </div>
        </aside>

        {/* Results */}
        <main className="lg:col-span-6">
          <ScrollArea className="h-full">{results}</ScrollArea>
        </main>

        {/* Summary Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-24 rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-lg font-semibold">Summary</h2>
            {summary}
          </div>
        </aside>
      </div>
    </div>
  );
}
