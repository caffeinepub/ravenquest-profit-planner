// ─── Land Screenshot Advisor ──────────────────────────────────────────────────
import { ImageCropTool } from "@/components/ImageCropTool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useFarming,
  useHerbalism,
  useHusbandry,
  useWoodcutting,
} from "@/hooks/useQueries";
import type { GatheringItem } from "@/lib/api/types";
import type { PlayerStatus } from "@/lib/calculator/growTimeBands";
import { husbandryToGathering } from "@/lib/calculator/growTimeBands";
import {
  type CalculationConfig,
  calculateGatheringProfit,
} from "@/lib/calculator/profitEngine";
import type { CropRect } from "@/lib/imagePreprocess";
import { useLandInventoryStore } from "@/lib/landInventory/store";
import { useMarketDepthStore } from "@/lib/marketDepth/store";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useConfigStore } from "@/store/configStore";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ImagePlus,
  Loader2,
  MapPinned,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlotType = "crop" | "herb" | "tree" | "animal";
type PlotStatus = "empty" | "growing" | "ready" | "unknown";
type LandType = "fort" | "large";

type Stage =
  | "idle"
  | "image_loaded"
  | "cropping"
  | "processing"
  | "review"
  | "recommendations";

interface SlotDraft {
  id: string;
  landType: LandType;
  plotType: PlotType;
  status: PlotStatus;
  confidence: number; // 0–1
}

interface RecommendationOption {
  item: GatheringItem;
  profitPerHour: number | null;
  profitPerHarvest: number;
  growHours: number;
  liquidityLabel: "high" | "medium" | "low" | "unknown";
}

interface SlotRecommendation {
  slotId: string;
  options: RecommendationOption[];
}

const PLOT_LABELS: Record<PlotType, string> = {
  crop: "🌾 Crop",
  herb: "🌿 Herb",
  tree: "🌲 Tree",
  animal: "🐄 Animal",
};

const STATUS_LABELS: Record<PlotStatus, string> = {
  empty: "Empty",
  growing: "Growing",
  ready: "Ready",
  unknown: "Unknown",
};

const LAND_LABELS: Record<LandType, string> = {
  fort: "🏰 Fort",
  large: "🏘 Large",
};

// ─── Recommendation Engine ────────────────────────────────────────────────────

function filterItemsByPlotType(
  allItems: GatheringItem[],
  plotType: PlotType,
): GatheringItem[] {
  return allItems.filter((item) => {
    const cat = (item.category ?? "").toLowerCase();
    if (plotType === "crop") {
      return (
        !cat.includes("herb") &&
        !cat.includes("wood") &&
        !cat.includes("tree") &&
        !cat.includes("animal") &&
        !cat.includes("husbandry")
      );
    }
    if (plotType === "herb") {
      return cat.includes("herb") || cat.includes("herbalism");
    }
    if (plotType === "tree") {
      return (
        cat.includes("wood") ||
        cat.includes("tree") ||
        cat.includes("woodcutting")
      );
    }
    if (plotType === "animal") {
      return cat.includes("husbandry") || cat.includes("animal");
    }
    return false;
  });
}

function getRecommendations(
  slots: SlotDraft[],
  allGatheringItems: GatheringItem[],
  playerStatus: PlayerStatus,
  config: CalculationConfig,
  getLiquidityLabel: (id: number) => "high" | "medium" | "low" | "unknown",
  rowCap: number,
): SlotRecommendation[] {
  const itemUsageCount = new Map<number, number>();
  const results: SlotRecommendation[] = [];

  const targetSlots = slots.filter(
    (s) => s.status === "empty" || s.status === "unknown",
  );

  for (const slot of targetSlots) {
    const landMultiplier = slot.landType === "fort" ? 20 : 4;
    const candidates = filterItemsByPlotType(allGatheringItems, slot.plotType);

    const scored = candidates
      .map((item) => {
        const result = calculateGatheringProfit(item, 1, {
          ...config,
          landMultiplier,
        });

        const growHours = item.growingTime / 3600;

        // Band bonus based on player status + grow time
        let bandBonus = 0;
        if (playerStatus === "active" && growHours <= 6) bandBonus = 0.2;
        else if (
          playerStatus === "sleeping" &&
          growHours >= 8 &&
          growHours <= 16
        )
          bandBonus = 0.2;
        else if (playerStatus === "away" && growHours > 16) bandBonus = 0.2;

        const baseScore = result.profitPerHour ?? -1;
        const sortScore = baseScore * (1 + bandBonus);

        return { item, result, growHours, sortScore };
      })
      .sort((a, b) => b.sortScore - a.sortScore);

    const options: RecommendationOption[] = [];
    for (const { item, result, growHours } of scored) {
      if (options.length >= 3) break;
      const usageCount = itemUsageCount.get(item.id) ?? 0;
      if (usageCount >= rowCap) continue;

      const firstDropId = item.items[0]?.id ?? -1;
      const liquidityLabel = getLiquidityLabel(firstDropId);

      options.push({
        item,
        profitPerHour: result.profitPerHour,
        profitPerHarvest: result.profitPerHarvest,
        growHours,
        liquidityLabel,
      });

      itemUsageCount.set(item.id, usageCount + 1);
    }

    results.push({ slotId: slot.id, options });
  }

  return results;
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ conf }: { conf: number }) {
  if (conf >= 0.7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
        <CheckCircle className="h-3 w-3" />
        {Math.round(conf * 100)}%
      </span>
    );
  }
  if (conf >= 0.4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
        <AlertCircle className="h-3 w-3" />
        {Math.round(conf * 100)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
      <AlertCircle className="h-3 w-3" />
      {Math.round(conf * 100)}%
    </span>
  );
}

// ─── Liquidity Badge ──────────────────────────────────────────────────────────

function LiquidityBadge({
  label,
}: { label: "high" | "medium" | "low" | "unknown" }) {
  if (label === "high") {
    return (
      <span className="rounded bg-emerald-500/15 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
        Low risk
      </span>
    );
  }
  if (label === "medium") {
    return (
      <span className="rounded bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
        Med risk
      </span>
    );
  }
  if (label === "low") {
    return (
      <span className="rounded bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
        ⚠ High risk
      </span>
    );
  }
  return (
    <span className="rounded bg-surface-3 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
      Unknown
    </span>
  );
}

// ─── Idle Stage ───────────────────────────────────────────────────────────────

function IdleStage({
  onImageLoaded,
  onManualSetup,
}: {
  onImageLoaded: (src: string) => void;
  onManualSetup: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      onImageLoaded(url);
    },
    [onImageLoaded],
  );

  // Paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) processFile(file);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [processFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Drop zone */}
      <label
        htmlFor="land-advisor-file-input"
        data-ocid="land_advisor.dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-14 text-center transition-all ${
          isDragging
            ? "border-sky-400 bg-sky-400/5"
            : "border-border bg-surface-2/30 hover:border-border/80 hover:bg-surface-2/50"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
          <ImagePlus className="h-8 w-8 text-teal-400" />
        </div>
        <div>
          <p className="text-base font-bold text-foreground">
            Paste or drop a screenshot
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-sky-400">Ctrl+V</span> to paste ·
            drag & drop · or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            PNG, JPG supported
          </p>
        </div>

        <input
          ref={fileInputRef}
          id="land-advisor-file-input"
          type="file"
          accept="image/*"
          className="sr-only"
          data-ocid="land_advisor.upload_button"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />
      </label>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground/60">
          or skip the image
        </span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Manual Setup button */}
      <Button
        data-ocid="land_advisor.manual_setup_button"
        variant="outline"
        onClick={onManualSetup}
        className="gap-2 border-border bg-surface-2 hover:bg-surface-3 text-foreground"
      >
        <Plus className="h-4 w-4 text-teal-400" />
        Manual Setup — Configure land slots directly
      </Button>
    </div>
  );
}

// ─── Review Stage ─────────────────────────────────────────────────────────────

function ReviewStage({
  slots,
  croppedImageSrc,
  onSlotsChange,
  onGetRecommendations,
  onBack,
}: {
  slots: SlotDraft[];
  croppedImageSrc: string | null;
  onSlotsChange: (slots: SlotDraft[]) => void;
  onGetRecommendations: () => void;
  onBack: () => void;
}) {
  const updateSlot = (id: string, patch: Partial<SlotDraft>) => {
    onSlotsChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSlot = (id: string) => {
    onSlotsChange(slots.filter((s) => s.id !== id));
  };

  const addSlot = () => {
    onSlotsChange([
      ...slots,
      {
        id: crypto.randomUUID(),
        landType: "fort",
        plotType: "crop",
        status: "empty",
        confidence: 0.35,
      },
    ]);
  };

  const fortCount = slots.filter((s) => s.landType === "fort").length;
  const largeCount = slots.filter((s) => s.landType === "large").length;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Cropped image preview (if available) */}
      {croppedImageSrc && (
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={croppedImageSrc}
            alt="Cropped land screenshot"
            className="w-full max-h-52 object-contain bg-surface-2"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-ocid="land_advisor.add_slot_button"
          size="sm"
          variant="outline"
          onClick={addSlot}
          className="gap-1.5 text-xs border-border bg-surface-2 hover:bg-surface-3"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Slot
        </Button>
        <Button
          data-ocid="land_advisor.mark_all_empty_button"
          size="sm"
          variant="outline"
          onClick={() =>
            onSlotsChange(
              slots.map((s) => ({ ...s, status: "empty" as const })),
            )
          }
          className="text-xs border-border bg-surface-2 hover:bg-surface-3"
        >
          Mark All Empty
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onSlotsChange(
              slots.map((s) => ({ ...s, landType: "fort" as const })),
            )
          }
          className="text-xs border-border bg-surface-2 hover:bg-surface-3"
        >
          Set All Fort
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onSlotsChange(
              slots.map((s) => ({ ...s, landType: "large" as const })),
            )
          }
          className="text-xs border-border bg-surface-2 hover:bg-surface-3"
        >
          Set All Large
        </Button>

        {/* Land type summary */}
        <div className="ml-auto flex items-center gap-2">
          {fortCount > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] border-gold/30 text-gold"
            >
              🏰 {fortCount} Fort {fortCount === 1 ? "slot" : "slots"}
            </Badge>
          )}
          {largeCount > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] border-teal-500/30 text-teal-400"
            >
              🏘 {largeCount} Large {largeCount === 1 ? "slot" : "slots"}
            </Badge>
          )}
        </div>
      </div>

      {/* Slot table */}
      {slots.length === 0 ? (
        <div
          data-ocid="land_advisor.empty_state"
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/30 px-4 py-10 text-center"
        >
          <MapPinned className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No slots yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Click "Add Slot" to configure your land plots.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Land Type
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Plot Type
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conf.
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => (
                <tr
                  key={slot.id}
                  className="border-b border-border/40 last:border-0 transition-colors hover:bg-surface-2/30"
                >
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={slot.landType}
                      onValueChange={(v) =>
                        updateSlot(slot.id, { landType: v as LandType })
                      }
                    >
                      <SelectTrigger
                        data-ocid={`land_advisor.slot_landtype_select.${i + 1}`}
                        className="h-7 w-[110px] text-xs bg-surface-2 border-border"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fort">🏰 Fort</SelectItem>
                        <SelectItem value="large">🏘 Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={slot.plotType}
                      onValueChange={(v) =>
                        updateSlot(slot.id, { plotType: v as PlotType })
                      }
                    >
                      <SelectTrigger
                        data-ocid={`land_advisor.slot_plottype_select.${i + 1}`}
                        className="h-7 w-[110px] text-xs bg-surface-2 border-border"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crop">🌾 Crop</SelectItem>
                        <SelectItem value="herb">🌿 Herb</SelectItem>
                        <SelectItem value="tree">🌲 Tree</SelectItem>
                        <SelectItem value="animal">🐄 Animal</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={slot.status}
                      onValueChange={(v) =>
                        updateSlot(slot.id, { status: v as PlotStatus })
                      }
                    >
                      <SelectTrigger
                        data-ocid={`land_advisor.slot_status_select.${i + 1}`}
                        className="h-7 w-[110px] text-xs bg-surface-2 border-border"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">Empty</SelectItem>
                        <SelectItem value="growing">Growing</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <ConfidenceBadge conf={slot.confidence} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Button
                      data-ocid={`land_advisor.slot_remove_button.${i + 1}`}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSlot(slot.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          data-ocid="land_advisor.get_recommendations_button"
          className="ml-auto gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          onClick={onGetRecommendations}
          disabled={slots.length === 0}
        >
          <MapPinned className="h-4 w-4" />
          Get Recommendations
        </Button>
      </div>
    </div>
  );
}

// ─── Recommendations Stage ────────────────────────────────────────────────────

function RecommendationsStage({
  slots,
  recommendations,
  onAddToPlan,
  onStartOver,
}: {
  slots: SlotDraft[];
  recommendations: SlotRecommendation[];
  onAddToPlan: (slot: SlotDraft) => void;
  onStartOver: () => void;
}) {
  const emptySlots = slots.filter(
    (s) => s.status === "empty" || s.status === "unknown",
  );
  const inUseSlots = slots.filter(
    (s) => s.status === "growing" || s.status === "ready",
  );

  const getRecForSlot = (slotId: string) =>
    recommendations.find((r) => r.slotId === slotId);

  const fmtSilver = (n: number | null): string => {
    if (n === null || !Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M s/h`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k s/h`;
    return `${n.toFixed(0)} s/h`;
  };

  const fmtHours = (h: number): string => {
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h === Math.floor(h)) return `${h}h`;
    return `${h.toFixed(1)}h`;
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">
            Slot Recommendations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top 3 options per empty slot based on current prices and player
            status
          </p>
        </div>
        <Button
          data-ocid="land_advisor.restart_button"
          variant="outline"
          size="sm"
          onClick={onStartOver}
          className="gap-1.5 text-xs border-border bg-surface-2 hover:bg-surface-3"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Start Over
        </Button>
      </div>

      {/* In-use slots */}
      {inUseSlots.map((slot) => (
        <div
          key={slot.id}
          className="rounded-xl border border-border/50 bg-surface-1 p-4 opacity-60"
        >
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[11px] border-border text-muted-foreground"
            >
              Slot {slots.indexOf(slot) + 1}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {LAND_LABELS[slot.landType]} · {PLOT_LABELS[slot.plotType]} ·{" "}
              <span className="text-emerald-400">
                {STATUS_LABELS[slot.status]}
              </span>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Already in use — no recommendation needed.
          </p>
        </div>
      ))}

      {/* Empty slots with recommendations */}
      {emptySlots.map((slot, idx) => {
        const rec = getRecForSlot(slot.id);
        const slotNum = slots.indexOf(slot) + 1;

        return (
          <div
            key={slot.id}
            className="rounded-xl border border-border bg-surface-1 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border/50 bg-surface-2/40 px-4 py-2.5">
              <Badge
                variant="outline"
                className="text-[11px] border-sky-500/30 text-sky-400"
              >
                Slot {slotNum}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {LAND_LABELS[slot.landType]} · {PLOT_LABELS[slot.plotType]} ·{" "}
                {STATUS_LABELS[slot.status]}
              </span>
              <Badge
                variant="outline"
                className={`ml-auto text-[11px] ${
                  slot.landType === "fort"
                    ? "border-gold/30 text-gold"
                    : "border-teal-500/30 text-teal-400"
                }`}
              >
                {slot.landType === "fort" ? "20× yield" : "4× yield"}
              </Badge>
            </div>

            {/* Options */}
            {!rec || rec.options.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Set prices in the Price Book to see recommendations for this
                  slot.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {rec.options.map((opt, optIdx) => (
                  <div
                    key={opt.item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/30 transition-colors"
                  >
                    {/* Rank */}
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                      {optIdx === 0 ? "🥇" : optIdx === 1 ? "🥈" : "🥉"}
                    </span>

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {opt.item.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {fmtHours(opt.growHours)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {fmtSilver(opt.profitPerHour)}
                        </span>
                        <LiquidityBadge label={opt.liquidityLabel} />
                      </div>
                    </div>

                    {/* Add to Plan */}
                    <Button
                      data-ocid={`land_advisor.recommendation.add_to_plan_button.${idx * 3 + optIdx + 1}`}
                      size="sm"
                      variant="outline"
                      onClick={() => onAddToPlan(slot)}
                      className="shrink-0 gap-1.5 text-xs border-teal-500/30 text-teal-400 hover:bg-teal-500/10 hover:text-teal-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Plan
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {emptySlots.length === 0 && inUseSlots.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-2/30 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No slots configured. Start over to set up your land.
          </p>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onStartOver}
        className="mt-2 gap-2 self-start text-muted-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Start Over
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LandAdvisorProps {
  open: boolean;
  onClose: () => void;
  playerStatus: PlayerStatus;
}

export function LandAdvisor({ open, onClose, playerStatus }: LandAdvisorProps) {
  const farming = useFarming();
  const herbalism = useHerbalism();
  const woodcutting = useWoodcutting();
  const husbandry = useHusbandry();

  const config = useConfigStore();
  const { getPrice } = usePriceBookStore();
  const { getLiquidityLabel } = useMarketDepthStore();
  const landInventory = useLandInventoryStore();

  // Stage machine
  const [stage, setStage] = useState<Stage>("idle");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImageSrc, setCroppedImageSrc] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [recommendations, setRecommendations] = useState<SlotRecommendation[]>(
    [],
  );

  // Aggregate all gathering items
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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
      if (croppedImageSrc?.startsWith("blob:"))
        URL.revokeObjectURL(croppedImageSrc);
    };
  }, [imageSrc, croppedImageSrc]);

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleImageLoaded = (src: string) => {
    setImageSrc(src);
    setStage("cropping");
  };

  const handleManualSetup = () => {
    setImageSrc(null);
    setCroppedImageSrc(null);
    setSlots([
      {
        id: crypto.randomUUID(),
        landType: "fort",
        plotType: "crop",
        status: "empty",
        confidence: 1.0,
      },
    ]);
    setStage("review");
  };

  const handleCropConfirm = (crop: CropRect) => {
    if (!imageSrc) return;
    setStage("processing");

    // Crop the image using a canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = crop.w;
      canvas.height = crop.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        doHeuristicDetection(crop.h);
        return;
      }
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      const croppedUrl = canvas.toDataURL("image/png");
      setCroppedImageSrc(croppedUrl);
      doHeuristicDetection(crop.h);
    };
    img.src = imageSrc;
  };

  const handleSkipCrop = () => {
    setStage("processing");
    // Use full image dimensions for detection
    const img = new Image();
    img.onload = () => {
      doHeuristicDetection(img.naturalHeight);
    };
    img.src = imageSrc ?? "";
  };

  const doHeuristicDetection = (imageHeight: number) => {
    // Simulate detection delay for UX
    setTimeout(() => {
      const rowCount = Math.min(8, Math.max(1, Math.round(imageHeight / 100)));
      const detected: SlotDraft[] = Array.from({ length: rowCount }, () => ({
        id: crypto.randomUUID(),
        landType: "fort" as const,
        plotType: "crop" as const,
        status: "unknown" as const,
        confidence: 0.35,
      }));
      setSlots(detected);
      setStage("review");
    }, 800);
  };

  const handleGetRecommendations = () => {
    const calcConfig: CalculationConfig = {
      landMultiplier: config.landMultiplier,
      marketFeePercent: config.marketFeePercent,
      getPrice,
    };

    const recs = getRecommendations(
      slots,
      allGatheringItems,
      playerStatus,
      calcConfig,
      getLiquidityLabel,
      config.rowCap,
    );
    setRecommendations(recs);
    setStage("recommendations");
  };

  const handleAddToPlan = (slot: SlotDraft) => {
    landInventory.addSlot({
      landType: slot.landType,
      plotType: slot.plotType,
      rowCount: slot.landType === "fort" ? 4 : 1,
    });
    toast.success("Added slot to My Lands plan");
  };

  const handleStartOver = () => {
    setStage("idle");
    if (imageSrc?.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    if (croppedImageSrc?.startsWith("blob:"))
      URL.revokeObjectURL(croppedImageSrc);
    setImageSrc(null);
    setCroppedImageSrc(null);
    setSlots([]);
    setRecommendations([]);
  };

  const handleClose = () => {
    onClose();
    // Don't reset state on close so user can reopen
  };

  const isDataLoading =
    farming.isLoading ||
    herbalism.isLoading ||
    woodcutting.isLoading ||
    husbandry.isLoading;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        data-ocid="land_advisor.sheet"
        side="right"
        className="w-full sm:max-w-[600px] p-0 flex flex-col bg-background border-border overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20">
                <MapPinned className="h-4.5 w-4.5 text-teal-400" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-foreground">
                  Land Screenshot Advisor
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stage === "idle" &&
                    "Upload a screenshot to get crop recommendations"}
                  {stage === "cropping" && "Crop the image to the land area"}
                  {stage === "processing" && "Analysing your land..."}
                  {stage === "review" &&
                    "Review and confirm detected land slots"}
                  {stage === "recommendations" &&
                    "Recommendations based on your prices"}
                </p>
              </div>
            </div>

            {/* Stage indicator pills */}
            <div className="hidden sm:flex items-center gap-1">
              {(["idle", "cropping", "review", "recommendations"] as const).map(
                (s) => {
                  const stageOrder = [
                    "idle",
                    "image_loaded",
                    "cropping",
                    "processing",
                    "review",
                    "recommendations",
                  ];
                  const currentIdx = stageOrder.indexOf(stage);
                  const thisIdx = stageOrder.indexOf(s);
                  const done = currentIdx > thisIdx;
                  const active =
                    s === stage ||
                    (s === "cropping" &&
                      (stage === "image_loaded" ||
                        stage === "cropping" ||
                        stage === "processing"));

                  return (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        active
                          ? "w-6 bg-sky-400"
                          : done
                            ? "w-4 bg-emerald-500"
                            : "w-4 bg-border"
                      }`}
                    />
                  );
                },
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Content area with scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Data loading notice */}
          {isDataLoading && (
            <div className="flex items-center gap-2 border-b border-border/40 bg-surface-2/30 px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading item data...
            </div>
          )}

          {stage === "idle" && (
            <IdleStage
              onImageLoaded={handleImageLoaded}
              onManualSetup={handleManualSetup}
            />
          )}

          {(stage === "image_loaded" || stage === "cropping") && imageSrc && (
            <div className="p-4">
              <ImageCropTool
                imageSrc={imageSrc}
                onConfirm={handleCropConfirm}
                onSkipCrop={handleSkipCrop}
              />
            </div>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Analysing your land...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estimating row count from image dimensions
                </p>
              </div>
            </div>
          )}

          {stage === "review" && (
            <ReviewStage
              slots={slots}
              croppedImageSrc={croppedImageSrc}
              onSlotsChange={setSlots}
              onGetRecommendations={handleGetRecommendations}
              onBack={() => {
                if (imageSrc) {
                  setStage("cropping");
                } else {
                  setStage("idle");
                }
              }}
            />
          )}

          {stage === "recommendations" && (
            <RecommendationsStage
              slots={slots}
              recommendations={recommendations}
              onAddToPlan={handleAddToPlan}
              onStartOver={handleStartOver}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/50 bg-surface-1/60 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {imageSrc && stage !== "idle" && stage !== "recommendations" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartOver}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Upload New
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
              <Upload className="h-3 w-3" />
              <span>Ctrl+V to paste anywhere</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
