// ─── Screenshot Price Import (v2 — with crop, preprocessing, confidence) ─────
import { ImageCropTool } from "@/components/ImageCropTool";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { BandStats } from "@/lib/calculator/growTimeBands";
import { parsePriceInput } from "@/lib/chatPriceParser";
import { findBestMatchStrict } from "@/lib/fuzzyMatch";
import type { CropRect } from "@/lib/imagePreprocess";
import { preprocessImage } from "@/lib/imagePreprocess";
import { extractOcrRows } from "@/lib/ocrPriceExtractor";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useSnapshotStore } from "@/lib/snapshots/store";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Crop,
  ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// ─── CDN Loader ───────────────────────────────────────────────────────────────
// Tesseract.js is not bundled; load it from CDN on first use.

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let tesseractLoadPromise: Promise<void> | null = null;

function loadTesseractCdn(): Promise<void> {
  if (tesseractLoadPromise) return tesseractLoadPromise;
  // Already loaded
  // biome-ignore lint/suspicious/noExplicitAny: CDN global
  if ((window as any).Tesseract) {
    tesseractLoadPromise = Promise.resolve();
    return tesseractLoadPromise;
  }
  tesseractLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Tesseract.js from CDN"));
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | "idle"
  | "image_loaded"
  | "cropping"
  | "processing"
  | "reviewing"
  | "done";

type RowStatus = "high" | "low" | "needs_review";

interface ReviewRow {
  lineText: string;
  rawName: string;
  rawPrice: string;
  price: number;
  ocrConfidence: number;
  matchedId: number | null;
  matchedName: string; // editable
  editedPrice: number; // editable
  needsReview: boolean;
  confirmed: boolean; // user-checked low/needs_review rows
  status: RowStatus;
  include: boolean; // checkbox state
}

interface ScreenshotImportProps {
  knownItems: Array<{ id: number; name: string }>;
  bandStats?: BandStats[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OCR_CONFIDENCE_THRESHOLD = 0.65;
const MATCH_SCORE_THRESHOLD = 0.72;

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenshotImport({
  knownItems,
  bandStats = [],
}: ScreenshotImportProps) {
  const { setPrice } = usePriceBookStore();
  const { saveSnapshot } = useSnapshotStore();

  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State machine
  const [stage, setStage] = useState<Stage>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [, setCropRect] = useState<CropRect | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  // Paste fallback
  const [pasteFallbackText, setPasteFallbackText] = useState("");
  const [showPasteFallback, setShowPasteFallback] = useState(false);

  // ── Image ingestion ──────────────────────────────────────────────────────

  const loadImage = useCallback(
    (file: File | Blob) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setOcrError(null);
      setReviewRows([]);
      setCropRect(null);
      setShowPasteFallback(false);
      setStage("image_loaded");
    },
    [imageUrl],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) loadImage(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((i) => i.type.startsWith("image/"));
    if (imageItem) {
      const blob = imageItem.getAsFile();
      if (blob) loadImage(blob);
    }
  };

  // ── OCR pipeline ─────────────────────────────────────────────────────────

  const runOcr = useCallback(
    async (imgSrc: string, crop: CropRect | null) => {
      setStage("processing");
      setOcrError(null);

      try {
        // Preprocess
        const processed = await preprocessImage(imgSrc, crop ?? undefined);

        // Tesseract OCR — loaded via CDN script tag to avoid bundler issues
        await loadTesseractCdn();
        // biome-ignore lint/suspicious/noExplicitAny: Tesseract loaded from CDN
        const TesseractGlobal = (window as any).Tesseract as {
          createWorker: (...args: unknown[]) => Promise<unknown>;
        };
        const worker = (await TesseractGlobal.createWorker("eng")) as {
          recognize: (src: string) => Promise<{ data: unknown }>;
          terminate: () => Promise<void>;
        };
        const result = await worker.recognize(processed);
        await worker.terminate();

        const page = result.data;
        const ocrRows = extractOcrRows(page);

        if (ocrRows.length === 0) {
          setOcrError(
            "OCR could not detect any item/price rows. Try adjusting the crop box or use the paste fallback below.",
          );
          setShowPasteFallback(true);
          setStage("reviewing");
          setReviewRows([]);
          return;
        }

        // Map each OCR row → ReviewRow via fuzzy matching
        const rows: ReviewRow[] = ocrRows.map((row) => {
          const match = findBestMatchStrict(
            row.rawName,
            knownItems,
            MATCH_SCORE_THRESHOLD,
          );

          const ocrHigh = row.confidence >= OCR_CONFIDENCE_THRESHOLD;
          const matchHigh = match !== null && !match.needsReview;

          let status: RowStatus;
          if (ocrHigh && matchHigh) {
            status = "high";
          } else if (!match || match.needsReview) {
            status = "needs_review";
          } else {
            status = "low";
          }

          return {
            lineText: row.lineText,
            rawName: row.rawName,
            rawPrice: row.rawPrice,
            price: row.price,
            ocrConfidence: row.confidence,
            matchedId: match?.id ?? null,
            matchedName: match?.name ?? "",
            editedPrice: row.price,
            needsReview: match?.needsReview ?? true,
            confirmed: false,
            status,
            // Auto-include only high-confidence rows
            include: status === "high",
          };
        });

        setReviewRows(rows);
        setStage("reviewing");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "OCR processing failed";
        setOcrError(`OCR failed: ${msg}`);
        setShowPasteFallback(true);
        setStage("reviewing");
      }
    },
    [knownItems],
  );

  // ── Crop tool callbacks ───────────────────────────────────────────────────

  const handleCropConfirm = (crop: CropRect) => {
    setCropRect(crop);
    if (imageUrl) void runOcr(imageUrl, crop);
  };

  const handleSkipCrop = () => {
    setCropRect(null);
    if (imageUrl) void runOcr(imageUrl, null);
  };

  const handleRerunOcr = () => {
    // Go back to cropping stage (keeps the image)
    setStage("image_loaded");
    setReviewRows([]);
    setOcrError(null);
  };

  // ── Review row edits ──────────────────────────────────────────────────────

  const updateRow = (index: number, updates: Partial<ReviewRow>) => {
    setReviewRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...updates } : row)),
    );
  };

  const toggleInclude = (index: number, checked: boolean) => {
    updateRow(index, { include: checked });
  };

  // ── Apply updates ─────────────────────────────────────────────────────────

  const handleApply = () => {
    const toApply = reviewRows.filter(
      (row) => row.include && row.editedPrice > 0 && row.matchedName.trim(),
    );

    if (toApply.length === 0) {
      toast.warning("No rows selected to apply.");
      return;
    }

    for (const row of toApply) {
      if (row.matchedId !== null) {
        setPrice(row.matchedId, row.matchedName, row.editedPrice);
      } else {
        // Try to re-match with the possibly-edited name
        const match = findBestMatchStrict(
          row.matchedName,
          knownItems,
          MATCH_SCORE_THRESHOLD,
        );
        if (match) {
          setPrice(match.id, match.name, row.editedPrice);
        }
      }
    }

    const label = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const currentPriceBook = usePriceBookStore.getState().priceBook;
    saveSnapshot(`Screenshot — ${label}`, currentPriceBook, bandStats);

    toast.success(
      `${toApply.length} price${toApply.length !== 1 ? "s" : ""} updated from screenshot`,
    );
    handleDiscard();
  };

  // ── Paste fallback ────────────────────────────────────────────────────────

  const handlePasteFallbackApply = () => {
    if (!pasteFallbackText.trim()) return;
    const parsed = parsePriceInput(pasteFallbackText, knownItems);
    if (parsed.matched.length === 0) {
      toast.warning("No recognizable items found. Check the format.");
      return;
    }
    for (const item of parsed.matched) {
      setPrice(item.id, item.name, item.price);
    }
    toast.success(
      `${parsed.matched.length} price${parsed.matched.length !== 1 ? "s" : ""} updated`,
    );
    setPasteFallbackText("");
    handleDiscard();
  };

  // ── Discard / reset ───────────────────────────────────────────────────────

  const handleDiscard = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setCropRect(null);
    setReviewRows([]);
    setOcrError(null);
    setPasteFallbackText("");
    setShowPasteFallback(false);
    setStage("idle");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const readyCount = reviewRows.filter((r) => r.include).length;

  const confidenceBadge = (conf: number) => {
    const pct = Math.round(conf * 100);
    if (conf >= 0.65) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
          {pct}%
        </span>
      );
    }
    if (conf >= 0.45) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
          {pct}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
        {pct}%
      </span>
    );
  };

  const statusBadge = (status: RowStatus) => {
    if (status === "high") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          <Check className="h-2.5 w-2.5" /> High
        </span>
      );
    }
    if (status === "low") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
          <AlertTriangle className="h-2.5 w-2.5" /> Low
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
        ? Review
      </span>
    );
  };

  const rowBg = (status: RowStatus) => {
    if (status === "low") return "bg-amber-500/5";
    if (status === "needs_review") return "bg-orange-500/8";
    return "";
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2">
            <Camera className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <span className="flex-1 text-left font-semibold text-foreground">
            Screenshot Price Import
          </span>
          {readyCount > 0 && (
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-400 border border-sky-500/30">
              {readyCount} ready
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-xl border border-border bg-surface-1 p-4 space-y-4">
          {/* ── Stage: idle — Drop / Upload zone ── */}
          {(stage === "idle" || stage === "image_loaded") && !imageUrl && (
            <div
              data-ocid="screenshot.dropzone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onPaste={handlePaste}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/60 bg-surface-2/50 px-4 py-6 text-center hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drop a marketplace screenshot here, or click to upload
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Also supports{" "}
                  <kbd className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px]">
                    Ctrl+V
                  </kbd>{" "}
                  paste
                </p>
              </div>
              <Button
                data-ocid="screenshot.upload_button"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 bg-surface-2 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                Browse files
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* ── Stage: image_loaded — show drop zone again + crop tool ── */}
          {stage === "image_loaded" && imageUrl && (
            <>
              {/* Small re-upload strip */}
              <div
                data-ocid="screenshot.dropzone"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border/50 bg-surface-2/30 px-3 py-2 text-xs text-muted-foreground hover:border-sky-500/30 transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="flex-1">
                  Paste or drop a different screenshot to replace
                </span>
                <Button
                  data-ocid="screenshot.upload_button"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 px-2 text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Replace
                </Button>
              </div>

              <ImageCropTool
                imageSrc={imageUrl}
                onConfirm={handleCropConfirm}
                onSkipCrop={handleSkipCrop}
              />
            </>
          )}

          {/* ── Stage: processing — spinner ── */}
          {stage === "processing" && (
            <div className="space-y-3">
              {imageUrl && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Screenshot preview"
                    className="max-h-[120px] w-full object-contain bg-surface-2"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-sm text-sky-300">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Preprocessing &amp; running OCR…</span>
              </div>
            </div>
          )}

          {/* ── Stage: reviewing ── */}
          {stage === "reviewing" && (
            <div className="space-y-3">
              {/* OCR error banner */}
              {ocrError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{ocrError}</span>
                </div>
              )}

              {/* Low-confidence global warning */}
              {reviewRows.some((r) => r.status !== "high") &&
                reviewRows.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Some rows have low confidence or need review. Check the
                      &quot;Include&quot; column before applying.
                    </span>
                  </div>
                )}

              {/* Review table */}
              {reviewRows.length > 0 && (
                <div
                  data-ocid="screenshot.review_table"
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <div className="border-b border-border bg-surface-2 px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      {reviewRows.length} row
                      {reviewRows.length !== 1 ? "s" : ""} detected
                      {readyCount > 0 && (
                        <span className="ml-1.5 text-sky-400">
                          ({readyCount} selected)
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() =>
                        setReviewRows((rows) =>
                          rows.map((r) => ({ ...r, include: true })),
                        )
                      }
                    >
                      Select all
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs py-2 w-8">#</TableHead>
                          <TableHead className="text-xs py-2">
                            Detected Name
                          </TableHead>
                          <TableHead className="text-xs py-2">
                            Detected Price
                          </TableHead>
                          <TableHead className="text-xs py-2 text-center">
                            Confidence
                          </TableHead>
                          <TableHead className="text-xs py-2">
                            Matched Name
                          </TableHead>
                          <TableHead className="text-xs py-2 w-28">
                            Price
                          </TableHead>
                          <TableHead className="text-xs py-2 text-center">
                            Status
                          </TableHead>
                          <TableHead className="text-xs py-2 text-center w-16">
                            Include
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviewRows.map((row, idx) => (
                          <TableRow
                            key={`${row.rawName}-${row.rawPrice}-${idx}`}
                            className={cn("border-border", rowBg(row.status))}
                          >
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            {/* Detected Name (read-only) */}
                            <TableCell
                              className="py-2 text-xs text-muted-foreground font-mono max-w-[120px] truncate"
                              title={row.rawName}
                            >
                              {row.rawName}
                            </TableCell>
                            {/* Detected Price (read-only) */}
                            <TableCell className="py-2 text-xs text-muted-foreground font-mono">
                              {row.rawPrice}
                            </TableCell>
                            {/* Confidence badge */}
                            <TableCell className="py-2 text-center">
                              {confidenceBadge(row.ocrConfidence)}
                            </TableCell>
                            {/* Matched Name (editable) */}
                            <TableCell className="py-2 min-w-[140px]">
                              <Input
                                value={row.matchedName}
                                placeholder="Type item name…"
                                className="h-7 text-xs bg-surface-2 border-border/60 focus:border-sky-500/60 px-2"
                                onChange={(e) =>
                                  updateRow(idx, {
                                    matchedName: e.target.value,
                                  })
                                }
                                list={`ocr-items-${idx}`}
                              />
                              <datalist id={`ocr-items-${idx}`}>
                                {knownItems.map((item) => (
                                  <option key={item.id} value={item.name} />
                                ))}
                              </datalist>
                            </TableCell>
                            {/* Price (editable) */}
                            <TableCell className="py-2">
                              <Input
                                type="number"
                                value={row.editedPrice || ""}
                                min={0}
                                className="h-7 text-xs bg-surface-2 border-border/60 focus:border-sky-500/60 px-2 w-24"
                                onChange={(e) =>
                                  updateRow(idx, {
                                    editedPrice:
                                      Number.parseInt(e.target.value, 10) || 0,
                                  })
                                }
                              />
                            </TableCell>
                            {/* Status badge */}
                            <TableCell className="py-2 text-center">
                              {statusBadge(row.status)}
                            </TableCell>
                            {/* Include checkbox */}
                            <TableCell className="py-2 text-center">
                              <Checkbox
                                data-ocid={`screenshot.row_include_checkbox.${idx + 1}`}
                                checked={row.include}
                                onCheckedChange={(checked) =>
                                  toggleInclude(idx, checked === true)
                                }
                                className="border-border/60 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Paste Prices fallback */}
              {(showPasteFallback || reviewRows.length === 0) && (
                <div className="rounded-lg border border-border bg-surface-2/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="h-3 w-3 text-sky-400" />
                    OCR failed? Paste prices manually instead.
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    One item per line:{" "}
                    <span className="font-mono text-foreground/60">
                      Apple 3690
                    </span>{" "}
                    or{" "}
                    <span className="font-mono text-foreground/60">
                      apple:3690
                    </span>
                  </p>
                  <Textarea
                    data-ocid="screenshot.paste_fallback_textarea"
                    value={pasteFallbackText}
                    onChange={(e) => setPasteFallbackText(e.target.value)}
                    placeholder={"Brightday 840\nEgg 1800\nApple 3690"}
                    className="min-h-[100px] font-mono text-xs resize-y bg-surface-2 border-border/60"
                  />
                  <div className="flex gap-2">
                    <Button
                      data-ocid="screenshot.paste_fallback_apply_button"
                      type="button"
                      size="sm"
                      onClick={handlePasteFallbackApply}
                      disabled={!pasteFallbackText.trim()}
                      className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500 text-xs font-semibold"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPasteFallbackText("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  data-ocid="screenshot.apply_button"
                  type="button"
                  size="sm"
                  disabled={readyCount === 0}
                  onClick={handleApply}
                  className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500 font-semibold"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply {readyCount > 0 ? `${readyCount} ` : ""}update
                  {readyCount !== 1 ? "s" : ""}
                </Button>
                <Button
                  data-ocid="screenshot.rerun_ocr_button"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRerunOcr}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-run OCR
                </Button>
                <Button
                  data-ocid="screenshot.discard_button"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Discard
                </Button>
              </div>
            </div>
          )}

          {/* When idle but user wants paste fallback directly */}
          {stage === "idle" && (
            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-sky-400 transition-colors underline underline-offset-2"
                onClick={() => setShowPasteFallback((v) => !v)}
              >
                {showPasteFallback ? "Hide" : "Paste Prices Instead"}
              </button>
              {showPasteFallback && (
                <div className="mt-3 rounded-lg border border-border bg-surface-2/50 p-3 space-y-2 text-left">
                  <p className="text-[11px] text-muted-foreground/70">
                    One item per line:{" "}
                    <span className="font-mono text-foreground/60">
                      Apple 3690
                    </span>{" "}
                    or{" "}
                    <span className="font-mono text-foreground/60">
                      apple:3690
                    </span>
                  </p>
                  <Textarea
                    data-ocid="screenshot.paste_fallback_textarea"
                    value={pasteFallbackText}
                    onChange={(e) => setPasteFallbackText(e.target.value)}
                    placeholder={"Brightday 840\nEgg 1800\nApple 3690"}
                    className="min-h-[100px] font-mono text-xs resize-y bg-surface-2 border-border/60"
                  />
                  <div className="flex gap-2">
                    <Button
                      data-ocid="screenshot.paste_fallback_apply_button"
                      type="button"
                      size="sm"
                      onClick={handlePasteFallbackApply}
                      disabled={!pasteFallbackText.trim()}
                      className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500 text-xs font-semibold"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPasteFallbackText("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
