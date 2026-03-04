import { AISummaryPanel } from "@/components/AISummaryPanel";
import { MarketFloodWarning } from "@/components/MarketFloodWarning";
import { ScreenshotImport } from "@/components/ScreenshotImport";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  GROW_TIME_BANDS,
  PLAYER_STATUS_BAND,
  type PlayerStatus,
  computeBandStats,
  getBandForItem,
  husbandryToGathering,
} from "@/lib/calculator/growTimeBands";
import {
  calculateGatheringProfit,
  computeProfit24h,
} from "@/lib/calculator/profitEngine";
import {
  type LandSlot,
  type LandType,
  type PlotType,
  useLandInventoryStore,
} from "@/lib/landInventory/store";
import { useMarketDepthStore } from "@/lib/marketDepth/store";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useSnapshotStore } from "@/lib/snapshots/store";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtRate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}s/h`;
}

// ─── Band color maps ──────────────────────────────────────────────────────────

const BAND_BORDER: Record<string, string> = {
  emerald: "border-emerald-500/40",
  sky: "border-sky-500/40",
  violet: "border-violet-500/40",
  indigo: "border-indigo-500/40",
  amber: "border-amber-500/40",
};

const BAND_GLOW: Record<string, string> = {
  emerald: "shadow-[0_0_24px_rgba(52,211,153,0.12)]",
  sky: "shadow-[0_0_24px_rgba(56,189,248,0.12)]",
  violet: "shadow-[0_0_24px_rgba(167,139,250,0.12)]",
  indigo: "shadow-[0_0_24px_rgba(129,140,248,0.12)]",
  amber: "shadow-[0_0_24px_rgba(251,191,36,0.12)]",
};

const BAND_BG: Record<string, string> = {
  emerald: "bg-emerald-500/5",
  sky: "bg-sky-500/5",
  violet: "bg-violet-500/5",
  indigo: "bg-indigo-500/5",
  amber: "bg-amber-500/5",
};

const BAND_TEXT: Record<string, string> = {
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  violet: "text-violet-400",
  indigo: "text-indigo-400",
  amber: "text-amber-400",
};

const BAND_ICON_BG: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20",
  sky: "bg-sky-500/10 border-sky-500/20",
  violet: "bg-violet-500/10 border-violet-500/20",
  indigo: "bg-indigo-500/10 border-indigo-500/20",
  amber: "bg-amber-500/10 border-amber-500/20",
};

const BAND_HIGHLIGHT_BORDER: Record<string, string> = {
  emerald: "border-emerald-400/70",
  sky: "border-sky-400/70",
  violet: "border-violet-400/70",
  indigo: "border-indigo-400/70",
  amber: "border-amber-400/70",
};

const STATUS_PILL_ACTIVE: Record<PlayerStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  sleeping: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  away: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

const STATUS_PILL_INACTIVE =
  "bg-surface-2 text-muted-foreground border-border hover:bg-surface-3 hover:text-foreground";

// ─── Player Status Selector ───────────────────────────────────────────────────

interface PlayerStatusSelectorProps {
  status: PlayerStatus;
  onChange: (s: PlayerStatus) => void;
}

function PlayerStatusSelector({ status, onChange }: PlayerStatusSelectorProps) {
  const statuses: { key: PlayerStatus; label: string; icon: string }[] = [
    { key: "active", label: "Active", icon: "🎮" },
    { key: "sleeping", label: "Sleeping", icon: "😴" },
    { key: "away", label: "Away", icon: "✈️" },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Player Status
      </span>
      <div className="flex items-center gap-1.5">
        {statuses.map((s) => (
          <button
            key={s.key}
            type="button"
            data-ocid={`strategy.player_status.${s.key}_button`}
            onClick={() => onChange(s.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
              status === s.key
                ? STATUS_PILL_ACTIVE[s.key]
                : STATUS_PILL_INACTIVE,
            )}
          >
            <span className="text-base leading-none">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Land Multiplier Quick Select ─────────────────────────────────────────────

interface LandMultiplierSelectProps {
  currentSize: string;
  onSelect: (size: "large" | "fort") => void;
}

function LandMultiplierSelect({
  currentSize,
  onSelect,
}: LandMultiplierSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Land Type
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-ocid="strategy.land_multiplier.large_button"
          onClick={() => onSelect("large")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
            currentSize === "large"
              ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
              : "bg-surface-2 text-muted-foreground border-border hover:bg-surface-3 hover:text-foreground",
          )}
        >
          <span className="text-base leading-none">🏘</span>
          <span>Large Land</span>
          <Badge
            variant="outline"
            className="border-teal-500/30 px-1 py-0 text-[10px] text-teal-400"
          >
            4×
          </Badge>
        </button>
        <button
          type="button"
          data-ocid="strategy.land_multiplier.fort_button"
          onClick={() => onSelect("fort")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
            currentSize === "fort"
              ? "bg-gold/20 text-gold border-gold/40"
              : "bg-surface-2 text-muted-foreground border-border hover:bg-surface-3 hover:text-foreground",
          )}
        >
          <span className="text-base leading-none">🏰</span>
          <span>Fort</span>
          <Badge
            variant="outline"
            className="border-gold/30 px-1 py-0 text-[10px] text-gold"
          >
            20×
          </Badge>
        </button>
      </div>
    </div>
  );
}

// ─── Quick Indicator Banner ───────────────────────────────────────────────────

interface QuickIndicatorProps {
  bestBand: BandStats | null;
  playerStatus: PlayerStatus;
}

function QuickIndicator({ bestBand, playerStatus }: QuickIndicatorProps) {
  const preferredBandKey = PLAYER_STATUS_BAND[playerStatus];

  if (!bestBand) {
    return (
      <div
        data-ocid="strategy.quick_indicator.panel"
        className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-5 py-4"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            No price data yet
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set item sell prices in the Price Book to see which grow-time window
            is currently most profitable.
          </p>
        </div>
      </div>
    );
  }

  const isSameAsPreferred = bestBand.band.key === preferredBandKey;
  const color = bestBand.band.color;

  return (
    <div
      data-ocid="strategy.quick_indicator.panel"
      className={cn(
        "relative overflow-hidden rounded-xl border px-5 py-4 transition-all",
        BAND_BORDER[color],
        BAND_BG[color],
        BAND_GLOW[color],
      )}
    >
      {/* Decorative gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl",
            `bg-${color}-500`,
          )}
        />
      </div>

      <div className="relative flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xl",
            BAND_ICON_BG[color],
          )}
        >
          {bestBand.band.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className={cn("h-4 w-4 shrink-0", BAND_TEXT[color])} />
            <p className="text-sm font-bold text-foreground">
              Best current grow-time window:
            </p>
          </div>
          <p className={cn("mt-0.5 text-base font-bold", BAND_TEXT[color])}>
            {bestBand.band.label} ({bestBand.band.rangeLabel}) crops are
            currently the most profitable.
          </p>
          {!isSameAsPreferred && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your preferred window as a{" "}
              <span className="font-semibold capitalize">{playerStatus}</span>{" "}
              player is{" "}
              {
                GROW_TIME_BANDS.find((b) => b.key === preferredBandKey)
                  ?.rangeLabel
              }{" "}
              — but{" "}
              <span className={cn("font-semibold", BAND_TEXT[color])}>
                {bestBand.band.rangeLabel}
              </span>{" "}
              offers better returns right now.
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              BAND_TEXT[color],
            )}
          >
            {fmtRate(bestBand.avgSilverPerHour)}
          </div>
          <div className="text-xs text-muted-foreground">avg/hour</div>
        </div>
      </div>
    </div>
  );
}

// ─── Band Card ────────────────────────────────────────────────────────────────

interface BandCardProps {
  stats: BandStats;
  isBest: boolean;
  isPreferred: boolean;
  isSelectedWindow?: boolean;
}

const BAND_KEY_TO_OCID: Record<BandKey, string> = {
  FAST: "strategy.band_card.fast",
  ACTIVE: "strategy.band_card.active",
  MID: "strategy.band_card.mid",
  SLEEP: "strategy.band_card.sleep",
  AWAY: "strategy.band_card.away",
};

function BandCard({
  stats,
  isBest,
  isPreferred,
  isSelectedWindow,
}: BandCardProps) {
  const { band, avgSilverPerHour, topSilverPerHour, totalPotentialSilver } =
    stats;
  const color = band.color;
  const ocid = BAND_KEY_TO_OCID[band.key];

  const borderClass = isBest
    ? "border-gold/60 shadow-gold-glow"
    : isSelectedWindow
      ? "border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.15)]"
      : isPreferred
        ? BAND_HIGHLIGHT_BORDER[color]
        : "border-border";

  const bgClass = isBest
    ? "bg-gold/5"
    : isSelectedWindow
      ? "bg-amber-500/5"
      : isPreferred
        ? BAND_BG[color]
        : "bg-surface-1";

  return (
    <div
      data-ocid={ocid}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4 transition-all",
        borderClass,
        bgClass,
        stats.hasData ? "" : "opacity-60",
      )}
    >
      {/* Top badges */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border px-2 py-1.5 text-lg",
            BAND_ICON_BG[color],
          )}
        >
          {band.icon}
        </div>

        <div className="flex flex-col items-end gap-1">
          {isBest && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold border border-gold/30">
              <TrendingUp className="h-3 w-3" />
              BEST
            </span>
          )}
          {isSelectedWindow && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/40">
              <Zap className="h-3 w-3" />
              Selected Window
            </span>
          )}
          {isPreferred && !isSelectedWindow && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                BAND_ICON_BG[color],
                BAND_TEXT[color],
              )}
            >
              <Zap className="h-3 w-3" />
              Your window
            </span>
          )}
        </div>
      </div>

      {/* Band name + range */}
      <div>
        <div
          className={cn("text-lg font-black tracking-wide", BAND_TEXT[color])}
        >
          {band.label}
        </div>
        <div className="text-xs text-muted-foreground">{band.rangeLabel}</div>
      </div>

      {/* Stats */}
      {stats.hasData ? (
        <div className="space-y-2">
          {/* Avg silver/hour — primary stat */}
          <div
            className={cn("rounded-lg border px-3 py-2", BAND_ICON_BG[color])}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Avg silver/hour
            </div>
            <div
              className={cn(
                "font-mono text-xl font-bold tabular-nums",
                BAND_TEXT[color],
              )}
            >
              {fmtRate(avgSilverPerHour)}
            </div>
          </div>

          {/* Top + Total */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-surface-2 px-2 py-2">
              <div className="text-[10px] text-muted-foreground">
                Top silver/h
              </div>
              <div className="font-mono text-sm font-bold tabular-nums text-foreground">
                {fmtRate(topSilverPerHour)}
              </div>
            </div>
            <div className="rounded-md bg-surface-2 px-2 py-2">
              <div className="text-[10px] text-muted-foreground">
                Total potential
              </div>
              <div className="font-mono text-sm font-bold tabular-nums text-foreground">
                {fmt(totalPotentialSilver)}s
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-surface-2/30 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">No priced items</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">
            Set prices in the Price Book
          </p>
        </div>
      )}

      {/* Item count footer */}
      <div className="border-t border-border/30 pt-2">
        <p className="text-[11px] text-muted-foreground">
          {stats.itemCount} items
          {stats.pricedItemCount > 0 && (
            <span className={cn("ml-1 font-semibold", BAND_TEXT[color])}>
              · {stats.pricedItemCount} priced
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          {band.description}
        </p>
      </div>
    </div>
  );
}

// ─── Time-window to band mapping ──────────────────────────────────────────────

const TIME_WINDOW_OPTIONS = [2, 6, 8, 12, 16, 24] as const;

function getWindowTolerance(windowHours: number): {
  minHours: number;
  maxHours: number;
} {
  if (windowHours === 2) return { minHours: 1, maxHours: 2 };
  if (windowHours === 6) return { minHours: 4, maxHours: 6 };
  if (windowHours === 8) return { minHours: 6, maxHours: 8 };
  if (windowHours === 12) return { minHours: 8, maxHours: 12 };
  if (windowHours === 16) return { minHours: 12, maxHours: 16 };
  if (windowHours === 24) return { minHours: 16, maxHours: 24 };
  // Custom: ±20%
  return {
    minHours: windowHours * 0.8,
    maxHours: windowHours * 1.2,
  };
}

function getWindowBandKey(windowHours: number): BandKey {
  if (windowHours <= 2) return "FAST";
  if (windowHours <= 6) return "ACTIVE";
  if (windowHours <= 8) return "MID";
  if (windowHours <= 16) return "SLEEP";
  return "AWAY";
}

// ─── Grow Time Window Dropdown ────────────────────────────────────────────────

interface GrowTimeWindowDropdownProps {
  value: number | null;
  onChange: (hours: number | null) => void;
}

function GrowTimeWindowDropdown({
  value,
  onChange,
}: GrowTimeWindowDropdownProps) {
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handleSelectChange = (v: string) => {
    if (v === "all") {
      setShowCustom(false);
      onChange(null);
    } else if (v === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(Number(v));
    }
  };

  const handleCustomApply = () => {
    const parsed = Number.parseFloat(customInput);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const selectValue =
    value === null
      ? "all"
      : showCustom
        ? "custom"
        : TIME_WINDOW_OPTIONS.includes(
              value as (typeof TIME_WINDOW_OPTIONS)[number],
            )
          ? value.toString()
          : "custom";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Best For Time Window
      </span>
      <div className="flex items-center gap-1.5">
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger
            data-ocid="strategy.time_window.select"
            className="h-9 w-[160px] bg-surface-2 border-border text-sm"
          >
            <SelectValue placeholder="All windows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All windows</SelectItem>
            {TIME_WINDOW_OPTIONS.map((h) => (
              <SelectItem key={h} value={h.toString()}>
                {h}h window
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {showCustom && (
          <div className="flex items-center gap-1">
            <Input
              data-ocid="strategy.time_window.custom_input"
              type="number"
              min="0.5"
              step="0.5"
              placeholder="Hours"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomApply();
              }}
              className="h-9 w-20 bg-surface-2 border-border text-sm font-mono text-center"
            />
            <button
              type="button"
              data-ocid="strategy.time_window.custom_apply_button"
              onClick={handleCustomApply}
              className="h-9 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Apply
            </button>
          </div>
        )}
        {value !== null && (
          <button
            type="button"
            data-ocid="strategy.time_window.clear_button"
            onClick={() => {
              setShowCustom(false);
              setCustomInput("");
              onChange(null);
            }}
            className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ×
          </button>
        )}
      </div>
      {value !== null && (
        <p className="text-[11px] text-amber-400/80">
          Showing items with {getWindowTolerance(value).minHours.toFixed(1)}h–
          {getWindowTolerance(value).maxHours.toFixed(1)}h grow time
        </p>
      )}
    </div>
  );
}

// ─── Top 5 Items For Selected Window ─────────────────────────────────────────

interface Top5WindowItem {
  name: string;
  category: string;
  growHours: number;
  profit24h: number;
  profitPerHarvest: number;
  profitPerHour: number;
}

interface Top5ForWindowProps {
  windowHours: number;
  items: GatheringItem[];
  config: {
    landMultiplier: number;
    marketFeePercent: number;
    getPrice: (id: number) => number | null;
  };
}

function Top5ForWindow({ windowHours, items, config }: Top5ForWindowProps) {
  const { minHours, maxHours } = getWindowTolerance(windowHours);

  const ranked = useMemo<Top5WindowItem[]>(() => {
    const results: Top5WindowItem[] = [];
    for (const item of items) {
      const growHours = item.growingTime / 3600;
      if (growHours < minHours || growHours > maxHours) continue;
      const result = calculateGatheringProfit(item, 1, config);
      if (result.confidence === "low") continue;
      const profit24h = computeProfit24h(
        result.profitPerHarvest,
        item.growingTime,
      );
      if (profit24h <= 0) continue;
      results.push({
        name: item.name,
        category: item.category ?? "Gathering",
        growHours,
        profit24h,
        profitPerHarvest: result.profitPerHarvest,
        profitPerHour: result.profitPerHour ?? 0,
      });
    }
    return results.sort((a, b) => b.profit24h - a.profit24h).slice(0, 5);
  }, [items, minHours, maxHours, config]);

  const fmtS = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const CATEGORY_COLORS: Record<string, string> = {
    Farming: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    Herbalism: "bg-lime-500/15 text-lime-400 border-lime-500/30",
    Woodcutting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Husbandry: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };

  return (
    <section
      data-ocid="strategy.top5_window.section"
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden"
    >
      <div className="border-b border-amber-500/20 px-4 py-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-400 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Top 5 (24h profit) for {windowHours}h window
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Items with {minHours.toFixed(minHours % 1 === 0 ? 0 : 1)}h–
            {maxHours.toFixed(maxHours % 1 === 0 ? 0 : 1)}h grow time · ranked
            by profit/24h
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div
          data-ocid="strategy.top5_window.empty_state"
          className="px-4 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            No priced items found in this time window.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Set prices in the Price Book to see results here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {ranked.map((item, idx) => (
            <div
              key={item.name}
              data-ocid={`strategy.top5_window.item.${idx + 1}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors"
            >
              {/* Rank */}
              <span className="font-mono text-xs text-muted-foreground/50 w-5 shrink-0 text-right">
                {idx + 1}.
              </span>

              {/* Name + Category */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-sm truncate">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium",
                      CATEGORY_COLORS[item.category] ??
                        "bg-surface-2 text-muted-foreground border-border",
                    )}
                  >
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {item.growHours % 1 === 0
                      ? `${item.growHours}h`
                      : `${item.growHours.toFixed(1)}h`}
                  </span>
                  <span className="opacity-50">·</span>
                  <span>{fmtS(item.profitPerHour)}s/h</span>
                </div>
              </div>

              {/* Profit metrics */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-bold tabular-nums text-gold">
                  +{fmtS(item.profit24h)}s/24h
                </div>
                <div className="font-mono text-xs text-muted-foreground tabular-nums">
                  +{fmtS(item.profitPerHarvest)}s/harvest
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-surface-1 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left font-medium">How this works</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-border/40 bg-surface-1/60 px-4 py-4 text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-semibold text-foreground">
              Grow-Time Strategy Engine
            </span>{" "}
            groups every item in Farming, Herbalism, Woodcutting, and Husbandry
            into five time bands based on their harvest cycle.
          </p>
          <p>
            For each band, it calculates the{" "}
            <span className="font-semibold text-foreground">
              average silver per hour
            </span>
            ,{" "}
            <span className="font-semibold text-foreground">
              top silver per hour
            </span>
            , and{" "}
            <span className="font-semibold text-foreground">
              total potential silver per harvest
            </span>{" "}
            — using only the prices you have entered in the Price Book.
          </p>
          <p>
            This tool tells you{" "}
            <span className="font-semibold text-foreground">
              which time slot is most profitable
            </span>
            , not which specific crops to grow. You decide based on market depth
            and your own strategy.
          </p>
          <p>
            The{" "}
            <span className="font-semibold text-foreground">
              Player Status selector
            </span>{" "}
            highlights the time band that aligns with your availability — but
            all bands are always visible so you can make an informed decision.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <span className="font-semibold text-emerald-400">
                FAST (1–2h)
              </span>{" "}
              — rapid cycles when you're actively playing
            </li>
            <li>
              <span className="font-semibold text-sky-400">ACTIVE (2–6h)</span>{" "}
              — medium cycles during a play session
            </li>
            <li>
              <span className="font-semibold text-violet-400">MID (6–8h)</span>{" "}
              — half-day cycles
            </li>
            <li>
              <span className="font-semibold text-indigo-400">
                SLEEP (8–16h)
              </span>{" "}
              — overnight cycles
            </li>
            <li>
              <span className="font-semibold text-amber-400">AWAY (16h+)</span>{" "}
              — long absence cycles
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Land Slot Card ───────────────────────────────────────────────────────────

const LAND_TYPE_LABELS: Record<LandType, string> = {
  fort: "🏰 Fort",
  large: "🏘 Large",
};

function LandSlotCard({
  slot,
  index,
  onUpdate,
  onRemove,
}: {
  slot: LandSlot;
  index: number;
  onUpdate: (id: string, patch: Partial<Omit<LandSlot, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground/60">
            #{index}
          </span>
          <Badge
            variant="outline"
            className={
              slot.landType === "fort"
                ? "text-[11px] border-gold/30 text-gold"
                : "text-[11px] border-teal-500/30 text-teal-400"
            }
          >
            {LAND_TYPE_LABELS[slot.landType]}
          </Badge>
        </div>
        <Button
          data-ocid={`my_lands.slot_remove_button.${index}`}
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(slot.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Land
          </span>
          <Select
            value={slot.landType}
            onValueChange={(v) =>
              onUpdate(slot.id, { landType: v as LandType })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-surface-3 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fort">🏰 Fort (20×)</SelectItem>
              <SelectItem value="large">🏘 Large (4×)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Plot
          </span>
          <Select
            value={slot.plotType}
            onValueChange={(v) =>
              onUpdate(slot.id, { plotType: v as PlotType })
            }
          >
            <SelectTrigger className="h-7 text-xs bg-surface-3 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crop">🌾 Crop</SelectItem>
              <SelectItem value="herb">🌿 Herb</SelectItem>
              <SelectItem value="tree">🌲 Tree</SelectItem>
              <SelectItem value="animal">🐄 Animal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row count */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Rows
        </span>
        <Input
          type="number"
          min={1}
          max={8}
          value={slot.rowCount}
          onChange={(e) => {
            const val = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val >= 1 && val <= 8) {
              onUpdate(slot.id, { rowCount: val });
            }
          }}
          className="h-7 w-16 text-xs text-center bg-surface-3 border-border font-mono"
        />
      </div>
    </div>
  );
}

// ─── My Lands Panel ───────────────────────────────────────────────────────────

function MyLandsPanel() {
  const {
    slots,
    addSlot,
    updateSlot,
    removeSlot,
    totalFortRows,
    totalLargeRows,
  } = useLandInventoryStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLandType, setNewLandType] = useState<LandType>("fort");
  const [newPlotType, setNewPlotType] = useState<PlotType>("crop");
  const [newRowCount, setNewRowCount] = useState(4);

  const fortRows = totalFortRows();
  const largeRows = totalLargeRows();

  const handleAdd = () => {
    addSlot({
      landType: newLandType,
      plotType: newPlotType,
      rowCount: newRowCount,
    });
    setShowAddForm(false);
    setNewRowCount(newLandType === "fort" ? 4 : 1);
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">My Lands</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure your owned lands for personalised recommendations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {fortRows > 0 && (
            <Badge
              variant="outline"
              className="border-gold/30 text-gold text-xs"
            >
              🏰 {fortRows} Fort row{fortRows !== 1 ? "s" : ""}
            </Badge>
          )}
          {largeRows > 0 && (
            <Badge
              variant="outline"
              className="border-teal-500/30 text-teal-400 text-xs"
            >
              🏘 {largeRows} Large plot{largeRows !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            data-ocid="my_lands.add_button"
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Land
          </Button>
        </div>
      </div>

      {/* Add Land inline form */}
      {showAddForm && (
        <div className="border-b border-border px-4 py-3 bg-surface-2/50 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Land Type
            </span>
            <Select
              value={newLandType}
              onValueChange={(v) => {
                const lt = v as LandType;
                setNewLandType(lt);
                setNewRowCount(lt === "fort" ? 4 : 1);
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fort">🏰 Fort (20×)</SelectItem>
                <SelectItem value="large">🏘 Large (4×)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Plot Type
            </span>
            <Select
              value={newPlotType}
              onValueChange={(v) => setNewPlotType(v as PlotType)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crop">🌾 Crop</SelectItem>
                <SelectItem value="herb">🌿 Herb</SelectItem>
                <SelectItem value="tree">🌲 Tree</SelectItem>
                <SelectItem value="animal">🐄 Animal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rows (1–8)
            </span>
            <Input
              type="number"
              min={1}
              max={8}
              value={newRowCount}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(val) && val >= 1 && val <= 8)
                  setNewRowCount(val);
              }}
              className="h-8 w-20 text-xs text-center bg-surface-2 border-border font-mono"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Button
              size="sm"
              onClick={handleAdd}
              className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-500 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddForm(false)}
              className="h-8 text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Slots grid */}
      {slots.length === 0 ? (
        <div data-ocid="my_lands.empty_state" className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No lands configured yet.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add your Fort and Large Land plots to get personalised grow
            recommendations.
          </p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map((slot, i) => (
            <LandSlotCard
              key={slot.id}
              slot={slot}
              index={i + 1}
              onUpdate={updateSlot}
              onRemove={removeSlot}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GrowTimeStrategy() {
  const farming = useFarming();
  const herbalism = useHerbalism();
  const woodcutting = useWoodcutting();
  const husbandry = useHusbandry();

  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();
  const { getLiquidityLabel } = useMarketDepthStore();
  const { getLatest } = useSnapshotStore();

  const playerStatus = config.playerStatus;
  const setPlayerStatus = config.setPlayerStatus;
  const rowCap = config.rowCap;
  const setRowCap = config.setRowCap;

  // Time window filter state (null = show all)
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<number | null>(
    null,
  );

  const isLoading =
    farming.isLoading ||
    herbalism.isLoading ||
    woodcutting.isLoading ||
    husbandry.isLoading;

  const hasError =
    farming.isError ||
    herbalism.isError ||
    woodcutting.isError ||
    husbandry.isError;

  // Aggregate all gathering items into one flat array
  const allGatheringItems = useMemo<GatheringItem[]>(() => {
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

  // Compute band stats (reactively updates when prices or config change)
  const bandStats = useMemo(
    () =>
      computeBandStats(allGatheringItems, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice,
      }),
    [
      allGatheringItems,
      config.landMultiplier,
      config.marketFeePercent,
      getPrice,
    ],
  );

  // Find the best band (highest avgSilverPerHour with data)
  const bestBand = useMemo<BandStats | null>(() => {
    const withData = bandStats.filter((b) => b.hasData);
    if (withData.length === 0) return null;
    return withData.reduce((best, b) =>
      b.avgSilverPerHour > best.avgSilverPerHour ? b : best,
    );
  }, [bandStats]);

  const preferredBandKey = PLAYER_STATUS_BAND[playerStatus];

  // All known items (gathering items + their drops) for fuzzy matching
  const allKnownItems = useMemo(() => {
    const seenIds = new Set<number>();
    const result: Array<{ id: number; name: string }> = [];

    for (const item of allGatheringItems) {
      // Add the item itself (in case it's also sellable)
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push({ id: item.id, name: item.name });
      }
      // Add all drop items (these are what prices are set for)
      for (const drop of item.items) {
        if (!seenIds.has(drop.id)) {
          seenIds.add(drop.id);
          result.push({ id: drop.id, name: drop.name });
        }
      }
    }
    return result;
  }, [allGatheringItems]);

  // Liquidity warnings: items with positive profit/hour but low market depth
  const liquidityWarnings = useMemo(() => {
    const warnings: Array<{
      itemName: string;
      bandKey: string;
      profitPerHour: number;
    }> = [];

    for (const item of allGatheringItems) {
      if (item.growingTime <= 0) continue;
      const result = calculateGatheringProfit(item, 1, {
        landMultiplier: config.landMultiplier,
        marketFeePercent: config.marketFeePercent,
        getPrice,
      });
      if (result.profitPerHour === null || result.profitPerHour <= 0) continue;

      // Check each drop item's liquidity
      for (const drop of item.items) {
        const label = getLiquidityLabel(drop.id);
        if (label === "low") {
          const bandKey = getBandForItem(item.growingTime);
          warnings.push({
            itemName: item.name,
            bandKey,
            profitPerHour: result.profitPerHour,
          });
          break; // one warning per gathering item
        }
      }
    }

    return warnings;
  }, [
    allGatheringItems,
    config.landMultiplier,
    config.marketFeePercent,
    getPrice,
    getLiquidityLabel,
  ]);

  // Latest snapshot for comparison
  const latestSnapshot = getLatest();

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading item data…</p>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold">Failed to load item data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Could not fetch one or more categories. Try refreshing the page.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              farming.refetch();
              herbalism.refetch();
              woodcutting.refetch();
              husbandry.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Sticky Controls Row ────────────────────────────────────────────── */}
      <div className="sticky top-[49px] z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-end gap-4">
            <PlayerStatusSelector
              status={playerStatus}
              onChange={setPlayerStatus}
            />
            <div className="h-8 w-px bg-border/60 hidden sm:block self-end mb-1" />
            <LandMultiplierSelect
              currentSize={config.landSize}
              onSelect={(size) => config.setLandSize(size)}
            />
            <div className="h-8 w-px bg-border/60 hidden sm:block self-end mb-1" />
            <GrowTimeWindowDropdown
              value={selectedTimeWindow}
              onChange={setSelectedTimeWindow}
            />
            {/* Current config summary */}
            <div className="ml-auto flex flex-col items-end gap-1 self-end">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active config
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-border/60 text-[11px] text-muted-foreground capitalize"
                >
                  {config.landSize} land · {config.landMultiplier}×
                </Badge>
                <Badge
                  variant="outline"
                  className="border-border/60 text-[11px] text-muted-foreground"
                >
                  {config.marketFeePercent}% fee
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Page Content ───────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Indicator */}
        <section>
          <QuickIndicator bestBand={bestBand} playerStatus={playerStatus} />
        </section>

        {/* My Lands Panel */}
        <section>
          <MyLandsPanel />
        </section>

        {/* Profit Dashboard */}
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Best Farming Time Window
                {selectedTimeWindow !== null && (
                  <span className="ml-2 text-sm font-normal text-amber-400">
                    · Filtered for {selectedTimeWindow}h window
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Profitability by grow-time band · based on your Price Book
                prices · {allGatheringItems.length} items tracked
              </p>
            </div>
          </div>

          {/* Band Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {bandStats.map((stats) => {
              const isSelectedWindow =
                selectedTimeWindow !== null &&
                stats.band.key === getWindowBandKey(selectedTimeWindow);
              return (
                <BandCard
                  key={stats.band.key}
                  stats={stats}
                  isBest={bestBand?.band.key === stats.band.key}
                  isPreferred={stats.band.key === preferredBandKey}
                  isSelectedWindow={isSelectedWindow}
                />
              );
            })}
          </div>

          {/* No data at all */}
          {!bandStats.some((b) => b.hasData) && (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center">
              <div className="text-3xl">📊</div>
              <div>
                <p className="font-semibold text-foreground">
                  No prices set yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open the{" "}
                  <span className="font-semibold text-gold">Price Book</span>{" "}
                  (top right) and add sell prices for items to see band
                  profitability.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Top 5 for selected time window */}
        {selectedTimeWindow !== null && (
          <Top5ForWindow
            windowHours={selectedTimeWindow}
            items={allGatheringItems}
            config={{
              landMultiplier: config.landMultiplier,
              marketFeePercent: config.marketFeePercent,
              getPrice,
            }}
          />
        )}

        {/* Comparison table: all bands side-by-side */}
        {bandStats.some((b) => b.hasData) && (
          <section className="rounded-xl border border-border bg-surface-1 overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                Band Comparison
              </h3>
              <p className="text-xs text-muted-foreground">
                All bands side-by-side · highest avg/h highlighted
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Band
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Avg s/h
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top s/h
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total potential
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Items priced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bandStats.map((stats) => {
                    const isBest = bestBand?.band.key === stats.band.key;
                    const isPreferred = stats.band.key === preferredBandKey;
                    const color = stats.band.color;

                    return (
                      <tr
                        key={stats.band.key}
                        className={cn(
                          "border-b border-border/30 last:border-0 transition-colors",
                          isBest
                            ? "bg-gold/5"
                            : isPreferred
                              ? BAND_BG[color]
                              : "",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{stats.band.icon}</span>
                            <div>
                              <span
                                className={cn(
                                  "text-sm font-bold",
                                  BAND_TEXT[color],
                                )}
                              >
                                {stats.band.label}
                              </span>
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {stats.band.rangeLabel}
                              </span>
                            </div>
                            {isBest && (
                              <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold border border-gold/30">
                                <TrendingUp className="h-2.5 w-2.5" />
                                BEST
                              </span>
                            )}
                            {isPreferred && !isBest && (
                              <span
                                className={cn(
                                  "ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                                  BAND_ICON_BG[color],
                                  BAND_TEXT[color],
                                )}
                              >
                                <Zap className="h-2.5 w-2.5" />
                                Your window
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-mono tabular-nums",
                            stats.hasData
                              ? isBest
                                ? "text-gold font-bold"
                                : "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {stats.hasData
                            ? fmtRate(stats.avgSilverPerHour)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                          {stats.hasData
                            ? fmtRate(stats.topSilverPerHour)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                          {stats.hasData
                            ? `${fmt(stats.totalPotentialSilver)}s`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {stats.pricedItemCount} / {stats.itemCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* How It Works */}
        <section>
          <HowItWorks />
        </section>

        {/* ── AI Strategy Summary ─────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 font-display text-base font-bold text-foreground">
            Strategy Summary
          </h3>
          <AISummaryPanel
            bandStats={bandStats}
            latestSnapshotBandStats={latestSnapshot?.bandStats ?? null}
            liquidityWarnings={liquidityWarnings}
            bestBand={bestBand}
          />
        </section>

        {/* ── Market Flood Warning ────────────────────────────────────────── */}
        <MarketFloodWarning
          bestBand={bestBand}
          bandStats={bandStats}
          rowCap={rowCap}
          onRowCapChange={setRowCap}
        />

        {/* ── Price Update Tools ──────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 font-display text-base font-bold text-foreground">
            Price Update Tools
          </h3>
          <ScreenshotImport knownItems={allKnownItems} bandStats={bandStats} />
        </section>

        {/* ── Snapshot Panel ──────────────────────────────────────────────── */}
        <section>
          <SnapshotPanel currentBandStats={bandStats} />
        </section>
      </div>
    </div>
  );
}
