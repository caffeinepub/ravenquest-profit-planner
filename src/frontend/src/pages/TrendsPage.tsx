import { SellHoldBadge } from "@/components/SellHoldBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllCrafting,
  useFarming,
  useHerbalism,
  useHusbandry,
  useWoodcutting,
} from "@/hooks/useQueries";
import type { HusbandryItem } from "@/lib/api/types";
import { usePriceBookStore } from "@/lib/priceBook/store";
import {
  type BaselineInfo,
  type LocalPriceRecord,
  usePriceHistoryStore,
} from "@/lib/priceHistory/store";
import { cn } from "@/lib/utils";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = "24h" | "3d" | "7d" | "30d" | "all";

const TIME_RANGE_MS: Record<TimeRange, number | null> = {
  "24h": 24 * 3600 * 1000,
  "3d": 3 * 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "30d": 30 * 24 * 3600 * 1000,
  all: null,
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "24h": "24h",
  "3d": "3d",
  "7d": "7d",
  "30d": "30d",
  all: "All",
};

type ItemCategory =
  | "farming"
  | "herbalism"
  | "woodcutting"
  | "husbandry"
  | "crafting"
  | "other";

interface AllItem {
  itemId: number;
  itemName: string;
  category: ItemCategory;
  hasPrice: boolean;
  hasPriceHistory: boolean;
}

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  farming: "Farming",
  herbalism: "Herbalism",
  woodcutting: "Woodcutting",
  husbandry: "Husbandry",
  crafting: "Crafting",
  other: "Other",
};

const CATEGORY_BADGE_COLORS: Record<ItemCategory, string> = {
  farming: "text-emerald-400",
  herbalism: "text-green-300",
  woodcutting: "text-amber-500",
  husbandry: "text-orange-400",
  crafting: "text-cyan-400",
  other: "text-muted-foreground",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSilver(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function filterByRange(
  records: LocalPriceRecord[],
  range: TimeRange,
): LocalPriceRecord[] {
  const maxMs = TIME_RANGE_MS[range];
  if (maxMs === null) return records;
  const cutoff = Date.now() - maxMs;
  return records.filter((r) => r.timestamp >= cutoff);
}

function formatTimestamp(ts: number, range: TimeRange): string {
  const date = new Date(ts);
  if (range === "24h") {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (range === "3d" || range === "7d") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMethod(method: string): string {
  switch (method) {
    case "7d_rolling_avg":
      return "7-day avg";
    case "last_30_avg":
      return "last 30 pts";
    case "last_10_avg":
      return "last 10 pts";
    default:
      return method;
  }
}

// ─── Hook: build the full allItems list from all API sources ──────────────────

function useAllItems(): { items: AllItem[]; isLoading: boolean } {
  const { priceBook } = usePriceBookStore();
  const { getHistory } = usePriceHistoryStore();

  const { data: farmingData, isLoading: farmingLoading } = useFarming();
  const { data: herbalismData, isLoading: herbalismLoading } = useHerbalism();
  const { data: woodcuttingData, isLoading: woodcuttingLoading } =
    useWoodcutting();
  const { data: husbandryData, isLoading: husbandryLoading } = useHusbandry();
  const { data: craftingData, isLoading: craftingLoading } = useAllCrafting();

  const isLoading =
    farmingLoading ||
    herbalismLoading ||
    woodcuttingLoading ||
    husbandryLoading ||
    craftingLoading;

  const items = useMemo(() => {
    const map = new Map<number, AllItem>();

    const addItem = (id: number, name: string, category: ItemCategory) => {
      if (!map.has(id)) {
        map.set(id, {
          itemId: id,
          itemName: name,
          category,
          hasPrice: id in priceBook,
          hasPriceHistory: getHistory(id).length > 0,
        });
      }
    };

    // Farming drops
    for (const item of farmingData ?? []) {
      for (const drop of item.items) {
        addItem(drop.id, drop.name, "farming");
      }
    }

    // Herbalism drops
    for (const item of herbalismData ?? []) {
      for (const drop of item.items) {
        addItem(drop.id, drop.name, "herbalism");
      }
    }

    // Woodcutting drops
    for (const item of woodcuttingData ?? []) {
      for (const drop of item.items) {
        addItem(drop.id, drop.name, "woodcutting");
      }
    }

    // Husbandry drops (gathering + butchering)
    for (const item of (husbandryData ?? []) as HusbandryItem[]) {
      for (const drop of item.items.gathering ?? []) {
        addItem(drop.id, drop.name, "husbandry");
      }
      for (const drop of item.items.butchering ?? []) {
        addItem(drop.id, drop.name, "husbandry");
      }
    }

    // Crafting recipes (output items)
    for (const recipe of craftingData ?? []) {
      addItem(recipe.itemId, recipe.name, "crafting");
    }

    // Also include any priceBook entries not yet in the map (e.g. manually added)
    for (const entry of Object.values(priceBook)) {
      if (!map.has(entry.itemId)) {
        addItem(entry.itemId, entry.itemName, "other");
      }
    }

    const all = Array.from(map.values());

    // Sort: history first, then has price, then rest — all alphabetically within
    all.sort((a, b) => {
      const aScore = a.hasPriceHistory ? 2 : a.hasPrice ? 1 : 0;
      const bScore = b.hasPriceHistory ? 2 : b.hasPrice ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.itemName.localeCompare(b.itemName);
    });

    return all;
  }, [
    farmingData,
    herbalismData,
    woodcuttingData,
    husbandryData,
    craftingData,
    priceBook,
    getHistory,
  ]);

  return { items, isLoading };
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-2.5 text-xs shadow-lg">
      <p className="mb-1.5 text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-foreground font-medium">{p.name}:</span>
          <span className="font-mono text-foreground">
            {fmtSilver(p.value)}s
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Item chart colors ────────────────────────────────────────────────────────

const COMPARE_COLORS = ["#F59E0B", "#60A5FA", "#34D399", "#F472B6", "#A78BFA"];

// ─── Grouped dropdown content ─────────────────────────────────────────────────

function GroupedSelectContent({
  allItems,
  isLoading,
}: {
  allItems: AllItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <SelectContent className="bg-surface-1 border-border max-h-72">
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading items…
        </div>
      </SelectContent>
    );
  }

  // Split into two groups: has history / no history yet
  const withHistory = allItems.filter((i) => i.hasPriceHistory);
  const withoutHistory = allItems.filter((i) => !i.hasPriceHistory);

  // Within the no-history group, further split: has price vs not
  const withPrice = withoutHistory.filter((i) => i.hasPrice);
  const withNeither = withoutHistory.filter((i) => !i.hasPrice);

  return (
    <SelectContent className="bg-surface-1 border-border max-h-72">
      {withHistory.length > 0 && (
        <SelectGroup>
          <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-gold/80 px-2 py-1">
            ● Has Price History
          </SelectLabel>
          {withHistory.map((item) => (
            <SelectItem
              key={item.itemId}
              value={String(item.itemId)}
              className="text-sm"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{item.itemName}</span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-medium",
                    CATEGORY_BADGE_COLORS[item.category],
                  )}
                >
                  ({CATEGORY_LABELS[item.category]})
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      )}

      {withPrice.length > 0 && (
        <>
          {withHistory.length > 0 && <SelectSeparator />}
          <SelectGroup>
            <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
              Has Price — No History Yet
            </SelectLabel>
            {withPrice.map((item) => (
              <SelectItem
                key={item.itemId}
                value={String(item.itemId)}
                className="text-sm"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{item.itemName}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium",
                      CATEGORY_BADGE_COLORS[item.category],
                    )}
                  >
                    ({CATEGORY_LABELS[item.category]})
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      )}

      {withNeither.length > 0 && (
        <>
          {(withHistory.length > 0 || withPrice.length > 0) && (
            <SelectSeparator />
          )}
          <SelectGroup>
            <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-1">
              All Items — No Price Yet
            </SelectLabel>
            {withNeither.map((item) => (
              <SelectItem
                key={item.itemId}
                value={String(item.itemId)}
                className="text-sm opacity-60"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{item.itemName}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium",
                      CATEGORY_BADGE_COLORS[item.category],
                    )}
                  >
                    ({CATEGORY_LABELS[item.category]})
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      )}

      {allItems.length === 0 && (
        <div className="py-4 px-2 text-center text-xs text-muted-foreground">
          No items found
        </div>
      )}
    </SelectContent>
  );
}

// ─── Single Item Chart Panel ──────────────────────────────────────────────────

function SingleItemChart() {
  const { priceBook } = usePriceBookStore();
  const { getHistory, computeBaseline } = usePriceHistoryStore();
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const { items: allItems, isLoading } = useAllItems();

  const itemIdNum = selectedItemId ? Number(selectedItemId) : null;
  const currentPrice =
    itemIdNum !== null ? (priceBook[itemIdNum]?.price ?? null) : null;

  // Resolve the item name from allItems list (covers items not in priceBook)
  const selectedItemName = useMemo(() => {
    if (itemIdNum === null) return null;
    const found = allItems.find((i) => i.itemId === itemIdNum);
    return found?.itemName ?? priceBook[itemIdNum]?.itemName ?? null;
  }, [itemIdNum, allItems, priceBook]);

  const history = useMemo(() => {
    if (itemIdNum === null) return [];
    return getHistory(itemIdNum);
  }, [itemIdNum, getHistory]);

  const filteredHistory = useMemo(
    () => filterByRange(history, timeRange),
    [history, timeRange],
  );

  const baseline: BaselineInfo | null = useMemo(() => {
    if (itemIdNum === null) return null;
    return computeBaseline(itemIdNum);
  }, [itemIdNum, computeBaseline]);

  const chartData = useMemo(() => {
    const sorted = [...filteredHistory].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    return sorted.map((r) => ({
      time: formatTimestamp(r.timestamp, timeRange),
      price: r.price,
      ts: r.timestamp,
    }));
  }, [filteredHistory, timeRange]);

  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    const prices = filteredHistory.map((r) => r.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const oldest = filteredHistory.reduce((a, b) =>
      a.timestamp < b.timestamp ? a : b,
    );
    const pctChange =
      oldest.price > 0 && currentPrice !== null
        ? ((currentPrice - oldest.price) / oldest.price) * 100
        : null;
    return { min, max, pctChange };
  }, [filteredHistory, currentPrice]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
          <SelectTrigger
            data-ocid="trends.item_select"
            className="w-60 bg-surface-2 border-border text-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              <SelectValue placeholder="Select an item…" />
            )}
          </SelectTrigger>
          <GroupedSelectContent allItems={allItems} isLoading={isLoading} />
        </Select>

        {/* Time range tabs */}
        <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5">
          {(["24h", "3d", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              data-ocid="trends.time_range.tab"
              onClick={() => setTimeRange(range)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                timeRange === range
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {!selectedItemId ? (
        <div
          data-ocid="trends.chart_point"
          className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-2/50 text-sm text-muted-foreground"
        >
          Select an item to view its price history
        </div>
      ) : chartData.length === 0 ? (
        <div
          data-ocid="trends.chart_point"
          className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-surface-2/50 text-center text-sm text-muted-foreground"
        >
          <p>No price history yet for {selectedItemName ?? "this item"}.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Update prices a few times using the chat bar to build trend data.
          </p>
        </div>
      ) : (
        <div
          data-ocid="trends.chart_point"
          className="rounded-xl border border-border bg-surface-1 p-4"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtSilver(v as number)}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              {baseline && (
                <>
                  <ReferenceLine
                    y={baseline.baseline}
                    stroke="#F59E0B"
                    strokeDasharray="5 3"
                    strokeOpacity={0.8}
                    label={{
                      value: `Baseline ${fmtSilver(baseline.baseline)}s`,
                      fill: "#F59E0B",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  {baseline.volatility > 0 && (
                    <>
                      <ReferenceLine
                        y={baseline.baseline + baseline.volatility}
                        stroke="#34D399"
                        strokeDasharray="3 3"
                        strokeOpacity={0.4}
                      />
                      <ReferenceLine
                        y={baseline.baseline - baseline.volatility}
                        stroke="#60A5FA"
                        strokeDasharray="3 3"
                        strokeOpacity={0.4}
                      />
                    </>
                  )}
                </>
              )}
              <Area
                type="monotone"
                dataKey="price"
                name="Price"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#F59E0B" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary stats */}
      {selectedItemId && itemIdNum !== null && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Price
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {currentPrice !== null ? `${fmtSilver(currentPrice)}s` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Baseline
            </p>
            <p className="font-mono text-sm font-bold text-gold">
              {baseline ? `${fmtSilver(baseline.baseline)}s` : "—"}
            </p>
            {baseline && (
              <p className="text-[10px] text-muted-foreground/70">
                {formatMethod(baseline.method)} · {baseline.dataPoints} pts
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Range ({TIME_RANGE_LABELS[timeRange]})
            </p>
            <p className="font-mono text-xs text-foreground">
              {stats ? (
                <>
                  {fmtSilver(stats.min)}s – {fmtSilver(stats.max)}s
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Change
            </p>
            <div className="flex items-center gap-1.5">
              {stats?.pctChange !== null && stats?.pctChange !== undefined ? (
                <>
                  {stats.pctChange > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  ) : stats.pctChange < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-sm font-bold",
                      stats.pctChange > 0
                        ? "text-emerald-400"
                        : stats.pctChange < 0
                          ? "text-red-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {stats.pctChange > 0 ? "+" : ""}
                    {stats.pctChange.toFixed(1)}%
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="mt-1">
              {currentPrice !== null && (
                <SellHoldBadge
                  itemId={itemIdNum}
                  currentPrice={currentPrice}
                  size="xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-Item Compare ───────────────────────────────────────────────────────

function MultiItemCompare() {
  const { priceBook } = usePriceBookStore();
  const { getHistory } = usePriceHistoryStore();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [filterQuery, setFilterQuery] = useState("");

  const { items: allItems, isLoading } = useAllItems();

  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return allItems;
    const q = filterQuery.toLowerCase();
    return allItems.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [allItems, filterQuery]);

  const toggleItem = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, id];
    });
  };

  // Build name lookup from allItems + priceBook
  const itemNameMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const item of allItems) {
      m.set(item.itemId, item.itemName);
    }
    for (const entry of Object.values(priceBook)) {
      if (!m.has(entry.itemId)) m.set(entry.itemId, entry.itemName);
    }
    return m;
  }, [allItems, priceBook]);

  const chartData = useMemo(() => {
    if (selectedIds.length === 0) return [];

    // Collect all timestamps from all selected items
    const allRecords: Map<number, LocalPriceRecord[]> = new Map();
    for (const id of selectedIds) {
      const hist = filterByRange(getHistory(id), timeRange);
      allRecords.set(
        id,
        hist.sort((a, b) => a.timestamp - b.timestamp),
      );
    }

    // Build a unified timeline of all unique timestamps
    const allTimestamps = new Set<number>();
    for (const recs of allRecords.values()) {
      for (const r of recs) allTimestamps.add(r.timestamp);
    }

    const sorted = [...allTimestamps].sort((a, b) => a - b);

    return sorted.map((ts) => {
      const point: Record<string, number | string> = {
        time: formatTimestamp(ts, timeRange),
      };
      for (const id of selectedIds) {
        const recs = allRecords.get(id) ?? [];
        const rec = recs.find((r) => r.timestamp === ts);
        if (rec) {
          const name = itemNameMap.get(id) ?? String(id);
          point[name] = rec.price;
        }
      }
      return point;
    });
  }, [selectedIds, timeRange, getHistory, itemNameMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Compare up to 5 items
        </h3>
        <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5">
          {(["24h", "3d", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                timeRange === range
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Search filter */}
      <div className="relative">
        <input
          type="text"
          data-ocid="trends.search_input"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Search items to compare…"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
        />
      </div>

      {/* Item chips */}
      <div
        data-ocid="trends.compare_item_select"
        className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-2/30 p-2"
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading all items…
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.itemId);
              const colorIdx = selectedIds.indexOf(item.itemId);
              return (
                <button
                  key={item.itemId}
                  type="button"
                  onClick={() => toggleItem(item.itemId)}
                  title={`${item.itemName} (${CATEGORY_LABELS[item.category]})`}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    isSelected
                      ? "border-transparent text-background"
                      : item.hasPriceHistory
                        ? "border-gold/30 text-foreground hover:border-gold/60"
                        : item.hasPrice
                          ? "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                          : "border-border/50 text-muted-foreground/50 hover:text-muted-foreground hover:border-border",
                  )}
                  style={
                    isSelected
                      ? { backgroundColor: COMPARE_COLORS[colorIdx] }
                      : undefined
                  }
                  disabled={!isSelected && selectedIds.length >= 5}
                >
                  {item.itemName}
                  <span
                    className={cn(
                      "ml-1 text-[9px]",
                      isSelected
                        ? "opacity-70"
                        : CATEGORY_BADGE_COLORS[item.category],
                    )}
                  >
                    ({CATEGORY_LABELS[item.category].slice(0, 4)})
                  </span>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 px-1">
                No items match "{filterQuery}"
              </p>
            )}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {selectedIds.length}/5 selected
          {selectedIds.length >= 5 && " (max reached)"}
        </p>
      )}

      {/* Compare chart */}
      {selectedIds.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface-2/50 text-sm text-muted-foreground">
          Select items above to compare price trends
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface-2/50 text-sm text-muted-foreground">
          No history in this range for selected items
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtSilver(v as number)}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                }}
              />
              {selectedIds.map((id, i) => {
                const name = itemNameMap.get(id) ?? String(id);
                return (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={name}
                    stroke={COMPARE_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Top Movers Panel ─────────────────────────────────────────────────────────

function TopMovers() {
  const { priceBook } = usePriceBookStore();
  const { getHistory } = usePriceHistoryStore();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const movers = useMemo(() => {
    const results: Array<{
      itemId: number;
      itemName: string;
      currentPrice: number;
      oldPrice: number;
      pctChange: number;
    }> = [];

    for (const entry of Object.values(priceBook)) {
      const hist = filterByRange(getHistory(entry.itemId), timeRange);
      if (hist.length < 2) continue;

      const oldest = hist.reduce((a, b) => (a.timestamp < b.timestamp ? a : b));
      if (oldest.price <= 0) continue;

      const pctChange = ((entry.price - oldest.price) / oldest.price) * 100;
      results.push({
        itemId: entry.itemId,
        itemName: entry.itemName,
        currentPrice: entry.price,
        oldPrice: oldest.price,
        pctChange,
      });
    }

    return results.sort((a, b) => b.pctChange - a.pctChange);
  }, [priceBook, timeRange, getHistory]);

  const topGainers = movers.slice(0, 10);
  const topLosers = [...movers].reverse().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Top Movers</h3>
        <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5">
          {(["24h", "3d", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                timeRange === range
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {movers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-2/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No price history yet. Update prices a few times to see movers.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Gainers */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Top Gainers
            </h4>
            {topGainers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No gainers</p>
            ) : (
              <div className="space-y-1.5">
                {topGainers.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {item.itemName}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fmtSilver(item.oldPrice)}s →{" "}
                        {fmtSilver(item.currentPrice)}s
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        +{item.pctChange.toFixed(1)}%
                      </span>
                      <SellHoldBadge
                        itemId={item.itemId}
                        currentPrice={item.currentPrice}
                        size="xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Losers */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />
              Top Losers
            </h4>
            {topLosers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No losers</p>
            ) : (
              <div className="space-y-1.5">
                {topLosers.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {item.itemName}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fmtSilver(item.oldPrice)}s →{" "}
                        {fmtSilver(item.currentPrice)}s
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-xs font-bold text-red-400">
                        {item.pctChange.toFixed(1)}%
                      </span>
                      <SellHoldBadge
                        itemId={item.itemId}
                        currentPrice={item.currentPrice}
                        size="xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TrendsPage ───────────────────────────────────────────────────────────────

export function TrendsPage() {
  const { priceBook } = usePriceBookStore();
  const { items: allItems, isLoading } = useAllItems();

  const totalPriced = Object.keys(priceBook).length;
  const totalItems = allItems.length;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-gold">
          Price Trends
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
              Loading item catalogue…
            </span>
          ) : totalPriced > 0 ? (
            <>
              Tracking {totalPriced} priced item
              {totalPriced !== 1 ? "s" : ""} out of {totalItems} total. Update
              prices via the chat bar to build history.
            </>
          ) : (
            <>
              {totalItems} items available across all categories. Use the chat
              bar to start adding prices and build trend data.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: single item chart */}
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Item Price History
            </h3>
            <SingleItemChart />
          </section>

          <section className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Multi-Item Compare
            </h3>
            <MultiItemCompare />
          </section>
        </div>

        {/* Right column: top movers */}
        <div>
          <section className="rounded-xl border border-border bg-surface-1 p-4">
            <TopMovers />
          </section>
        </div>
      </div>
    </div>
  );
}
