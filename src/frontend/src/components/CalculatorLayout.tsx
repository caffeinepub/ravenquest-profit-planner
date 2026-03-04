import type { ReactNode } from "react";

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
      <div className="flex gap-6">
        {/* Left: Filters */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-[108px] rounded-xl border border-border bg-surface-1 p-4 shadow-card">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filters
            </h2>
            {filters}
          </div>
        </aside>

        {/* Center: Results */}
        <main className="min-w-0 flex-1">{results}</main>

        {/* Right: Summary */}
        <aside className="hidden w-60 shrink-0 xl:block">
          <div
            className="sticky top-[108px] rounded-xl border border-border bg-surface-1 p-4 shadow-card overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </h2>
            {summary}
          </div>
        </aside>
      </div>

      {/* Mobile filters toggle at bottom */}
      <div className="mt-6 lg:hidden">
        <details className="rounded-xl border border-border bg-surface-1">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Filters & Settings
          </summary>
          <div className="border-t border-border px-4 py-4">{filters}</div>
        </details>
      </div>
    </div>
  );
}
