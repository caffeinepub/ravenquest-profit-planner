import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useFarming,
  useHerbalism,
  useHusbandry,
  useWoodcutting,
} from "@/hooks/useQueries";
import type { GatheringItem } from "@/lib/api/types";
import {
  type BandKey,
  type BandStats,
  computeBandStats,
  husbandryToGathering,
} from "@/lib/calculator/growTimeBands";
import {
  calculateGatheringProfit,
  computeProfit24h,
} from "@/lib/calculator/profitEngine";
import { useChatHistoryStore } from "@/lib/chatHistory/store";
import { parsePriceInput } from "@/lib/chatPriceParser";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { usePriceHistoryStore } from "@/lib/priceHistory/store";
import { useSnapshotStore } from "@/lib/snapshots/store";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSilver(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

const COLLAPSED_KEY = "rq-chat-bar-collapsed";

// ─── Strategy Summary Types ───────────────────────────────────────────────────

export interface UpdateSummary {
  priceChanges: Array<{
    name: string;
    oldPrice: number | null;
    newPrice: number;
  }>;
  bestBand: BandStats | null;
  top5: Array<{ name: string; profit24h: number; category?: string }>;
  fortTop5: Array<{ name: string; rowProfit24h: number }>;
  overnightTop5: Array<{ name: string; growHours: number }>;
  unrecognized: string[];
}

// ─── Compute Update Summary ───────────────────────────────────────────────────

function computeUpdateSummary(
  priceChanges: Array<{
    name: string;
    oldPrice: number | null;
    newPrice: number;
  }>,
  allItems: GatheringItem[],
  config: {
    landMultiplier: number;
    marketFeePercent: number;
    getPrice: (id: number) => number | null;
  },
  unrecognized: string[],
): UpdateSummary {
  const bandStats = computeBandStats(allItems, config);

  // Best band by avg silver/hour
  const bestBand =
    bandStats
      .filter((b) => b.hasData && b.avgSilverPerHour > 0)
      .sort((a, b) => b.avgSilverPerHour - a.avgSilverPerHour)[0] ?? null;

  // Top 5 items by profit/24h (any band, positive profit only)
  const itemResults = allItems
    .filter((item) => item.growingTime > 0)
    .map((item) => {
      const result = calculateGatheringProfit(item, 1, config);
      const profit24h = computeProfit24h(
        result.profitPerHarvest,
        item.growingTime,
      );
      return { item, result, profit24h };
    })
    .filter((r) => r.result.confidence !== "low" && r.profit24h > 0)
    .sort((a, b) => b.profit24h - a.profit24h);

  const top5 = itemResults.slice(0, 5).map((r) => ({
    name: r.item.name,
    profit24h: r.profit24h,
    category: r.item.category,
  }));

  // Fort top 5 — use fort multiplier (20x), ranked by profit/24h
  const fortConfig = { ...config, landMultiplier: 20 };
  const fortResults = allItems
    .filter((item) => item.growingTime > 0)
    .map((item) => {
      const result = calculateGatheringProfit(item, 1, fortConfig);
      const rowProfit24h = computeProfit24h(
        result.profitPerHarvest,
        item.growingTime,
      );
      return { item, result, rowProfit24h };
    })
    .filter((r) => r.result.confidence !== "low" && r.rowProfit24h > 0)
    .sort((a, b) => b.rowProfit24h - a.rowProfit24h);

  const fortTop5 = fortResults.slice(0, 5).map((r) => ({
    name: r.item.name,
    rowProfit24h: r.rowProfit24h,
  }));

  // Overnight (SLEEP band: 8–16h), ranked by profit/24h
  const overnightResults = allItems
    .filter((item) => {
      const hours = item.growingTime / 3600;
      return hours >= 8 && hours <= 16;
    })
    .map((item) => {
      const result = calculateGatheringProfit(item, 1, config);
      const profit24h = computeProfit24h(
        result.profitPerHarvest,
        item.growingTime,
      );
      return { item, result, profit24h };
    })
    .filter((r) => r.result.confidence !== "low" && r.profit24h > 0)
    .sort((a, b) => b.profit24h - a.profit24h);

  const overnightTop5 = overnightResults.slice(0, 5).map((r) => ({
    name: r.item.name,
    growHours: Math.round(r.item.growingTime / 3600),
  }));

  return {
    priceChanges,
    bestBand,
    top5,
    fortTop5,
    overnightTop5,
    unrecognized,
  };
}

// ─── UpdateSummaryMessage Component ─────────────────────────────────────────

function UpdateSummaryMessage({ summary }: { summary: UpdateSummary }) {
  const bandColors: Record<BandKey, string> = {
    FAST: "text-emerald-400",
    ACTIVE: "text-sky-400",
    MID: "text-violet-400",
    SLEEP: "text-indigo-400",
    AWAY: "text-amber-400",
  };
  const bandBg: Record<BandKey, string> = {
    FAST: "bg-emerald-500/10 border-emerald-500/30",
    ACTIVE: "bg-sky-500/10 border-sky-500/30",
    MID: "bg-violet-500/10 border-violet-500/30",
    SLEEP: "bg-indigo-500/10 border-indigo-500/30",
    AWAY: "bg-amber-500/10 border-amber-500/30",
  };

  const bandKey = summary.bestBand?.band.key as BandKey | undefined;

  return (
    <div className="space-y-3 text-xs">
      {/* Price Changes */}
      {summary.priceChanges.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
            Prices Updated
          </p>
          <div className="space-y-0.5">
            {summary.priceChanges.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <span className="text-foreground font-medium">{c.name}</span>
                {c.oldPrice !== null && c.oldPrice !== c.newPrice ? (
                  <>
                    <span className="text-muted-foreground/60 tabular-nums">
                      {c.oldPrice.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {c.newPrice.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-400 font-bold tabular-nums">
                    {c.newPrice.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Summary */}
      {summary.bestBand ? (
        <>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              bandKey ? bandBg[bandKey] : "bg-surface-2 border-border",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Best Window
            </p>
            <p
              className={cn(
                "font-bold text-sm",
                bandKey ? bandColors[bandKey] : "",
              )}
            >
              {summary.bestBand.band.label}{" "}
              <span className="font-normal text-muted-foreground">
                ({summary.bestBand.band.rangeLabel})
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5">
              Avg{" "}
              <span className="font-bold text-foreground">
                {fmtSilver(summary.bestBand.avgSilverPerHour)}
              </span>{" "}
              silver/hr
            </p>
          </div>

          {summary.top5.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Top 5 (24h profit)
              </p>
              {summary.top5.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-muted-foreground/50 tabular-nums w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="font-bold tabular-nums text-gold shrink-0">
                    ~{fmtSilver(item.profit24h)}/24h
                  </span>
                </div>
              ))}
            </div>
          )}

          {summary.fortTop5.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Best Fort Row (20x) — 24h
              </p>
              {summary.fortTop5.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-muted-foreground/50 tabular-nums w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="font-bold tabular-nums text-amber-400 shrink-0">
                    ~{fmtSilver(item.rowProfit24h)}/24h
                  </span>
                </div>
              ))}
            </div>
          )}

          {summary.overnightTop5.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Best Overnight (8–16h)
              </p>
              {summary.overnightTop5.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-indigo-400">🌙</span>
                  <span className="flex-1 font-medium text-foreground truncate">
                    {item.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {item.growHours}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground italic text-xs">
          Set prices for more items to unlock strategy recommendations.
        </div>
      )}

      {/* Unrecognized */}
      {summary.unrecognized.length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Unrecognized
          </p>
          <div className="flex flex-wrap gap-1">
            {summary.unrecognized.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[11px] text-red-400"
              >
                <XCircle className="h-3 w-3" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GlobalChatBar ────────────────────────────────────────────────────────────

export function GlobalChatBar() {
  // ── Data sources ──
  const farming = useFarming();
  const herbalism = useHerbalism();
  const woodcutting = useWoodcutting();
  const husbandry = useHusbandry();

  // ── Stores ──
  const { setPrice } = usePriceBookStore();
  const { saveSnapshot } = useSnapshotStore();
  const { entries, addEntry } = useChatHistoryStore();
  const { addRecords: addPriceHistoryRecords } = usePriceHistoryStore();
  const config = useConfigStore();

  // ── Summary response (latest /update result) ──
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(
    null,
  );

  // ── Collapse state (persisted in localStorage) ──
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  // ── Input state ──
  const [collapsedInput, setCollapsedInput] = useState("");
  const [expandedInput, setExpandedInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [parsed, setParsed] = useState<{
    matched: Array<{ id: number; name: string; price: number }>;
    unrecognized: string[];
  }>({ matched: [], unrecognized: [] });

  // ── Confirmation state ──
  const [confirmation, setConfirmation] = useState<{
    matchedNames: string[];
    count: number;
  } | null>(null);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Build known items list from all gathering sources ──
  const knownItems = useCallback(() => {
    const seenIds = new Set<number>();
    const result: Array<{ id: number; name: string }> = [];

    const gatheringItems: GatheringItem[] = [];

    for (const item of farming.data ?? []) gatheringItems.push(item);
    for (const item of herbalism.data ?? []) gatheringItems.push(item);
    for (const item of woodcutting.data ?? []) gatheringItems.push(item);
    for (const raw of husbandry.data ?? []) {
      const converted = husbandryToGathering(raw);
      if (converted) gatheringItems.push(converted);
    }

    for (const item of gatheringItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push({ id: item.id, name: item.name });
      }
      for (const drop of item.items) {
        if (!seenIds.has(drop.id)) {
          seenIds.add(drop.id);
          result.push({ id: drop.id, name: drop.name });
        }
      }
    }

    return result;
  }, [farming.data, herbalism.data, woodcutting.data, husbandry.data]);

  // ── All gathering items for strategy calculation ──
  const allGatheringItems = useCallback((): GatheringItem[] => {
    const items: GatheringItem[] = [];
    for (const item of farming.data ?? []) items.push(item);
    for (const item of herbalism.data ?? []) items.push(item);
    for (const item of woodcutting.data ?? []) items.push(item);
    for (const raw of husbandry.data ?? []) {
      const converted = husbandryToGathering(raw);
      if (converted) items.push(converted);
    }
    return items;
  }, [farming.data, herbalism.data, woodcutting.data, husbandry.data]);

  // ── Detect if input is /update command ──
  const isUpdateCommand = useCallback((value: string) => {
    return value.trimStart().toLowerCase().startsWith("/update");
  }, []);

  // ── Parse debounced when expanded input changes (non-update mode) ──
  const doParse = useCallback(
    (value: string) => {
      if (!value.trim() || isUpdateCommand(value)) {
        setParsed({ matched: [], unrecognized: [] });
        return;
      }
      const items = knownItems();
      const result = parsePriceInput(value, items);
      setParsed(result);
    },
    [knownItems, isUpdateCommand],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doParse(expandedInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [expandedInput, doParse]);

  // ── Apply price updates (shared) ──
  const applyPrices = useCallback(
    (
      matches: Array<{ id: number; name: string; price: number }>,
      rawInput: string,
      unrecognized: string[],
    ) => {
      if (matches.length === 0) return;

      for (const item of matches) {
        setPrice(item.id, item.name, item.price);
      }

      // Record price history
      const now = Date.now();
      addPriceHistoryRecords(
        matches.map((m) => ({
          itemId: m.id,
          itemName: m.name,
          price: m.price,
          timestamp: now,
          source: "chat" as const,
          updatedBy: "chat",
        })),
      );

      const label = new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const currentPriceBook = usePriceBookStore.getState().priceBook;
      const latestBandStats =
        useSnapshotStore.getState().getLatest()?.bandStats ?? [];
      saveSnapshot(label, currentPriceBook, latestBandStats);

      addEntry({
        input: rawInput,
        matchedCount: matches.length,
        matchedNames: matches.map((m) => m.name),
        unrecognizedNames: unrecognized,
      });

      // Show inline confirmation
      if (confirmationTimerRef.current)
        clearTimeout(confirmationTimerRef.current);
      setConfirmation({
        matchedNames: matches.map((m) => m.name),
        count: matches.length,
      });
      confirmationTimerRef.current = setTimeout(
        () => setConfirmation(null),
        4000,
      );
    },
    [setPrice, saveSnapshot, addEntry, addPriceHistoryRecords],
  );

  // ── Handle /update command ──
  const handleUpdateCommand = useCallback(
    (rawInput: string) => {
      // Strip /update prefix, then parse the rest
      const body = rawInput.replace(/^\/update\s*/i, "").trim();
      const items = knownItems();
      const result = parsePriceInput(body, items);

      // Collect old prices before applying
      const priceChanges = result.matched.map((m) => ({
        name: m.name,
        oldPrice: usePriceBookStore.getState().priceBook[m.id]?.price ?? null,
        newPrice: m.price,
      }));

      // Apply prices
      for (const item of result.matched) {
        setPrice(item.id, item.name, item.price);
      }

      // Record price history
      const nowTs = Date.now();
      addPriceHistoryRecords(
        result.matched.map((m) => ({
          itemId: m.id,
          itemName: m.name,
          price: m.price,
          timestamp: nowTs,
          source: "chat" as const,
          updatedBy: "chat",
        })),
      );

      // Build updated price getter (post-apply)
      const updatedPriceBook = usePriceBookStore.getState().priceBook;
      const getPriceUpdated = (id: number): number | null => {
        const entry = updatedPriceBook[id];
        return entry ? entry.price : null;
      };

      // Compute strategy summary with current config
      const calcConfig = {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice: getPriceUpdated,
      };

      const allItems = allGatheringItems();
      const summary = computeUpdateSummary(
        priceChanges,
        allItems,
        calcConfig,
        result.unrecognized,
      );

      // Save snapshot labeled "Chat Update"
      const snapshotBandStats = computeBandStats(allItems, calcConfig);
      saveSnapshot("Chat Update", updatedPriceBook, snapshotBandStats);

      // Add to chat history
      addEntry({
        input: rawInput,
        matchedCount: result.matched.length,
        matchedNames: result.matched.map((m) => m.name),
        unrecognizedNames: result.unrecognized,
      });

      setUpdateSummary(summary);

      // Expand panel to show result
      setIsCollapsed(false);
    },
    [
      knownItems,
      allGatheringItems,
      setPrice,
      saveSnapshot,
      addEntry,
      addPriceHistoryRecords,
      config.landMultiplier,
      config.marketFeePercent,
    ],
  );

  // ── Collapsed mode: Enter key submit ──
  const handleCollapsedSubmit = useCallback(() => {
    if (!collapsedInput.trim()) return;
    if (isUpdateCommand(collapsedInput)) {
      handleUpdateCommand(collapsedInput);
      setCollapsedInput("");
      return;
    }
    const items = knownItems();
    const result = parsePriceInput(collapsedInput, items);
    applyPrices(result.matched, collapsedInput, result.unrecognized);
    setCollapsedInput("");
  }, [
    collapsedInput,
    knownItems,
    applyPrices,
    isUpdateCommand,
    handleUpdateCommand,
  ]);

  // ── Expanded mode: Apply / Submit button ──
  const handleExpandedApply = useCallback(() => {
    if (isUpdateCommand(expandedInput)) {
      handleUpdateCommand(expandedInput);
      setExpandedInput("");
      setParsed({ matched: [], unrecognized: [] });
      return;
    }
    if (parsed.matched.length === 0) return;
    applyPrices(parsed.matched, expandedInput, parsed.unrecognized);
    setExpandedInput("");
    setParsed({ matched: [], unrecognized: [] });
  }, [
    parsed,
    expandedInput,
    applyPrices,
    isUpdateCommand,
    handleUpdateCommand,
  ]);

  const handleExpandedClear = () => {
    setExpandedInput("");
    setParsed({ matched: [], unrecognized: [] });
    setConfirmation(null);
    setUpdateSummary(null);
  };

  const inputIsUpdateCmd = isUpdateCommand(expandedInput);
  const matchCount = inputIsUpdateCmd ? 0 : parsed.matched.length;
  const unrecognizedCount = inputIsUpdateCmd ? 0 : parsed.unrecognized.length;

  // Determine if apply button should be enabled
  const canApply = inputIsUpdateCmd || (!inputIsUpdateCmd && matchCount > 0);

  // Button label
  const applyLabel = inputIsUpdateCmd
    ? "Run /update"
    : `Apply ${matchCount > 0 ? `${matchCount} ` : ""}price update${matchCount !== 1 ? "s" : ""}`;

  return (
    <div
      className={cn(
        "border-b border-border bg-surface-1 transition-all duration-200",
      )}
    >
      <div className="container mx-auto px-4">
        {/* ── Collapsed Bar ── */}
        {isCollapsed ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2">
              <MessageSquare className="h-3.5 w-3.5 text-gold" />
            </div>

            <div className="relative flex-1">
              <Input
                data-ocid="global_chat.input"
                value={collapsedInput}
                onChange={(e) => setCollapsedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCollapsedSubmit();
                  }
                }}
                placeholder='Paste market prices or type "/update wheat 1100, corn 1400"'
                className="h-8 bg-surface-2 border-border text-sm placeholder:text-muted-foreground/60 pr-8 focus-visible:ring-gold/40"
              />
            </div>

            {/* Confirmation badge (collapsed) */}
            {confirmation && (
              <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                ✓ {confirmation.count} updated
              </span>
            )}

            <Button
              data-ocid="global_chat.toggle_button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed(false)}
              title="Expand chat panel"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          /* ── Expanded Panel ── */
          <div className="py-3 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2">
                <MessageSquare className="h-3.5 w-3.5 text-gold" />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">
                Market Price Input
              </span>
              {matchCount > 0 && !inputIsUpdateCmd && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                  {matchCount} ready
                </span>
              )}
              {inputIsUpdateCmd && (
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold border border-gold/30">
                  /update ready
                </span>
              )}
              <Button
                data-ocid="global_chat.toggle_button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsCollapsed(true)}
                title="Collapse chat panel"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            {/* Two-column layout: input + response/history */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left: Textarea + actions */}
              <div className="space-y-2">
                <Textarea
                  data-ocid="global_chat.textarea"
                  rows={4}
                  value={expandedInput}
                  onChange={(e) => setExpandedInput(e.target.value)}
                  placeholder={
                    "/update\nwheat 1100\ncorn 1400\negg 1800\n\nOr paste individual prices: Apple 3690"
                  }
                  className="resize-none bg-surface-2 border-border font-mono text-sm placeholder:text-muted-foreground/50 focus-visible:ring-gold/40"
                />

                {/* /update hint */}
                {inputIsUpdateCmd && (
                  <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2">
                    <p className="text-xs font-semibold text-gold">
                      ⚡ /update command
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {expandedInput.trim().length > "/update".length
                        ? "Will update prices, recalculate all strategies, and show a full summary."
                        : "Will show strategy summary based on your current prices."}
                    </p>
                  </div>
                )}

                {/* Parse preview (non-update mode) */}
                {!inputIsUpdateCmd &&
                  (matchCount > 0 || unrecognizedCount > 0) && (
                    <div className="rounded-lg border border-border bg-surface-2 p-2.5 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {matchCount} item{matchCount !== 1 ? "s" : ""} matched
                        {unrecognizedCount > 0 &&
                          `, ${unrecognizedCount} unrecognized`}
                      </p>

                      {matchCount > 0 && (
                        <div className="space-y-0.5 max-h-28 overflow-y-auto">
                          {parsed.matched.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                              <span className="flex-1 font-medium text-foreground truncate">
                                {item.name}
                              </span>
                              <span className="font-mono tabular-nums text-emerald-400 font-bold shrink-0">
                                {item.price.toLocaleString()}s
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {unrecognizedCount > 0 && (
                        <div className="border-t border-border/50 pt-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                            Unrecognized
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {parsed.unrecognized.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[11px] text-red-400"
                              >
                                <XCircle className="h-3 w-3" />
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Confirmation message (non-update mode) */}
                {!inputIsUpdateCmd && confirmation && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-400">
                      ✓ Updated {confirmation.count} price
                      {confirmation.count !== 1 ? "s" : ""}
                    </p>
                    <p className="text-[11px] text-emerald-400/70 mt-0.5 truncate">
                      {confirmation.matchedNames.slice(0, 5).join(", ")}
                      {confirmation.matchedNames.length > 5
                        ? ` +${confirmation.matchedNames.length - 5} more`
                        : ""}
                    </p>
                    <p className="text-[11px] text-emerald-400/60 mt-0.5">
                      Strategy recalculated.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    data-ocid="global_chat.apply_button"
                    size="sm"
                    disabled={!canApply}
                    onClick={handleExpandedApply}
                    className={cn(
                      "gap-1.5 font-semibold disabled:opacity-40",
                      inputIsUpdateCmd
                        ? "bg-gold text-background hover:bg-gold/90"
                        : "bg-gold text-background hover:bg-gold/90",
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {applyLabel}
                  </Button>
                  <Button
                    data-ocid="global_chat.clear_button"
                    variant="ghost"
                    size="sm"
                    onClick={handleExpandedClear}
                    disabled={
                      !expandedInput && matchCount === 0 && !updateSummary
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Right: Strategy summary OR history */}
              <div className="space-y-1.5">
                {updateSummary ? (
                  /* /update summary response */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-gold" />
                        Strategy Update
                      </p>
                      <button
                        type="button"
                        onClick={() => setUpdateSummary(null)}
                        className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
                      >
                        × dismiss
                      </button>
                    </div>
                    <ScrollArea
                      data-ocid="global_chat.update_summary_panel"
                      className="max-h-[280px] rounded-lg border border-gold/20 bg-surface-2/80 p-3"
                    >
                      <UpdateSummaryMessage summary={updateSummary} />
                    </ScrollArea>
                  </div>
                ) : (
                  /* Recent history */
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Recent Updates
                    </p>

                    {entries.length === 0 ? (
                      <div className="rounded-lg border border-border bg-surface-2/50 px-3 py-4 text-center">
                        <p className="text-xs text-muted-foreground">
                          No price updates yet
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          Try:{" "}
                          <span className="font-mono text-gold">
                            /update wheat 1100
                          </span>
                        </p>
                      </div>
                    ) : (
                      <ScrollArea
                        data-ocid="global_chat.history_list"
                        className="h-[168px] rounded-lg border border-border bg-surface-2/50"
                      >
                        <div className="p-2 space-y-1.5">
                          {entries.map((entry, index) => (
                            <div
                              key={entry.id}
                              data-ocid={`global_chat.history_item.${index + 1}`}
                              className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-emerald-400">
                                  ✓ {entry.matchedCount} price
                                  {entry.matchedCount !== 1 ? "s" : ""} updated
                                </span>
                                <span className="text-muted-foreground/60 text-[10px] shrink-0">
                                  {formatTime(entry.timestamp)}
                                </span>
                              </div>
                              {entry.input
                                .toLowerCase()
                                .startsWith("/update") && (
                                <span className="inline-block mb-1 text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5">
                                  /update
                                </span>
                              )}
                              <p className="text-muted-foreground truncate">
                                {entry.matchedNames.slice(0, 4).join(", ")}
                                {entry.matchedNames.length > 4
                                  ? ` +${entry.matchedNames.length - 4} more`
                                  : ""}
                              </p>
                              {entry.unrecognizedNames.length > 0 && (
                                <p className="text-red-400/70 text-[10px] mt-0.5 truncate">
                                  Unrecognized:{" "}
                                  {entry.unrecognizedNames
                                    .slice(0, 3)
                                    .join(", ")}
                                  {entry.unrecognizedNames.length > 3
                                    ? "…"
                                    : ""}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
