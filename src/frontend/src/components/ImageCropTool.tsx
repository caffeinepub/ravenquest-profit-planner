// ─── Interactive Image Crop Tool ─────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import type { CropRect } from "@/lib/imagePreprocess";
import { Crop, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  imageSrc: string;
  onConfirm: (crop: CropRect) => void;
  onSkipCrop: () => void;
}

// Crop is stored as fractions (0–1) relative to the displayed image dimensions
interface FracRect {
  x: number; // 0–1
  y: number; // 0–1
  w: number; // 0–1
  h: number; // 0–1
}

// Default: focus on market rows (skip top ~20%, use middle 60%)
const DEFAULT_FRAC: FracRect = { x: 0.05, y: 0.2, w: 0.9, h: 0.6 };

const MIN_SIZE = 0.04; // minimum crop size as fraction

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move";

interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  startRect: FracRect;
}

export function ImageCropTool({ imageSrc, onConfirm, onSkipCrop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [frac, setFrac] = useState<FracRect>(DEFAULT_FRAC);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<DragState | null>(null);

  // Once the image loads, capture its natural size
  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    setImgNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setDisplaySize({ w: el.offsetWidth, h: el.offsetHeight });
  };

  // Keep display size in sync with container resizes
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDisplaySize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Convert frac → pixel coords for overlay positioning
  const px = {
    x: frac.x * displaySize.w,
    y: frac.y * displaySize.h,
    w: frac.w * displaySize.w,
    h: frac.h * displaySize.h,
  };

  // Pixel dimensions for display label
  const cropPx = {
    x: Math.round(frac.x * imgNatural.w),
    y: Math.round(frac.y * imgNatural.h),
    w: Math.round(frac.w * imgNatural.w),
    h: Math.round(frac.h * imgNatural.h),
  };

  // ── Pointer drag logic ────────────────────────────────────────────────────
  const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

  const startDrag = useCallback(
    (e: React.PointerEvent, handle: Handle) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...frac },
      };
    },
    [frac],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: setFrac is stable
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !displaySize.w || !displaySize.h) return;
      const { handle, startX, startY, startRect } = dragRef.current;
      const dx = (e.clientX - startX) / displaySize.w;
      const dy = (e.clientY - startY) / displaySize.h;

      setFrac(() => {
        let { x, y, w, h } = startRect;

        if (handle === "move") {
          x = clamp(x + dx, 0, 1 - w);
          y = clamp(y + dy, 0, 1 - h);
        }

        // Resize handles
        if (handle === "e" || handle === "ne" || handle === "se") {
          w = clamp(w + dx, MIN_SIZE, 1 - x);
        }
        if (handle === "w" || handle === "nw" || handle === "sw") {
          const newX = clamp(x + dx, 0, x + w - MIN_SIZE);
          w = w + (x - newX);
          x = newX;
        }
        if (handle === "s" || handle === "sw" || handle === "se") {
          h = clamp(h + dy, MIN_SIZE, 1 - y);
        }
        if (handle === "n" || handle === "nw" || handle === "ne") {
          const newY = clamp(y + dy, 0, y + h - MIN_SIZE);
          h = h + (y - newY);
          y = newY;
        }

        return { x, y, w, h };
      });
    },
    [displaySize],
  );

  const stopDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Confirm: convert frac → natural pixel coords ──────────────────────────
  const handleConfirm = () => {
    onConfirm({
      x: Math.round(frac.x * imgNatural.w),
      y: Math.round(frac.y * imgNatural.h),
      w: Math.round(frac.w * imgNatural.w),
      h: Math.round(frac.h * imgNatural.h),
    });
  };

  // Handle SVG for resize cursors
  const handleStyle = (cursor: string) =>
    `absolute w-3 h-3 rounded-sm bg-sky-400 border-2 border-sky-200 cursor-${cursor} z-20 -translate-x-1/2 -translate-y-1/2`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Crop className="h-3.5 w-3.5 text-sky-400" />
        <span>
          Drag the crop box to focus on the item/price columns.{" "}
          <span className="text-foreground font-medium">
            {cropPx.w > 0 ? `${cropPx.w}×${cropPx.h}px` : "Loading…"}
          </span>
        </span>
      </div>

      {/* Image + crop overlay container */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border select-none touch-none"
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Screenshot for cropping"
          className="w-full h-auto max-h-[400px] object-contain bg-surface-2 block"
          onLoad={onImgLoad}
          draggable={false}
        />

        {displaySize.w > 0 && (
          <>
            {/* Dimmed overlay: 4 rects around the crop box */}
            {/* Top */}
            <div
              className="absolute inset-x-0 top-0 bg-black/50 pointer-events-none"
              style={{ height: px.y }}
            />
            {/* Bottom */}
            <div
              className="absolute inset-x-0 bottom-0 bg-black/50 pointer-events-none"
              style={{ top: px.y + px.h }}
            />
            {/* Left */}
            <div
              className="absolute bg-black/50 pointer-events-none"
              style={{
                top: px.y,
                left: 0,
                width: px.x,
                height: px.h,
              }}
            />
            {/* Right */}
            <div
              className="absolute bg-black/50 pointer-events-none"
              style={{
                top: px.y,
                left: px.x + px.w,
                right: 0,
                height: px.h,
              }}
            />

            {/* Crop box border */}
            <div
              className="absolute border-2 border-sky-400 cursor-move z-10"
              style={{
                left: px.x,
                top: px.y,
                width: px.w,
                height: px.h,
              }}
              onPointerDown={(e) => startDrag(e, "move")}
            >
              {/* Rule-of-thirds guide lines */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div
                  className="absolute inset-y-0 border-l border-sky-300"
                  style={{ left: "33.3%" }}
                />
                <div
                  className="absolute inset-y-0 border-l border-sky-300"
                  style={{ left: "66.6%" }}
                />
                <div
                  className="absolute inset-x-0 border-t border-sky-300"
                  style={{ top: "33.3%" }}
                />
                <div
                  className="absolute inset-x-0 border-t border-sky-300"
                  style={{ top: "66.6%" }}
                />
              </div>

              {/* Size label */}
              <div className="absolute -top-6 left-0 bg-sky-500 text-white text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                {cropPx.w}×{cropPx.h}
              </div>
            </div>

            {/* Corner + edge handles — positioned relative to the container */}
            {/* NW */}
            <div
              className={handleStyle("nw-resize")}
              style={{ left: px.x, top: px.y }}
              onPointerDown={(e) => startDrag(e, "nw")}
            />
            {/* NE */}
            <div
              className={handleStyle("ne-resize")}
              style={{ left: px.x + px.w, top: px.y }}
              onPointerDown={(e) => startDrag(e, "ne")}
            />
            {/* SW */}
            <div
              className={handleStyle("sw-resize")}
              style={{ left: px.x, top: px.y + px.h }}
              onPointerDown={(e) => startDrag(e, "sw")}
            />
            {/* SE */}
            <div
              className={handleStyle("se-resize")}
              style={{ left: px.x + px.w, top: px.y + px.h }}
              onPointerDown={(e) => startDrag(e, "se")}
            />
            {/* N */}
            <div
              className={handleStyle("n-resize")}
              style={{ left: px.x + px.w / 2, top: px.y }}
              onPointerDown={(e) => startDrag(e, "n")}
            />
            {/* S */}
            <div
              className={handleStyle("s-resize")}
              style={{ left: px.x + px.w / 2, top: px.y + px.h }}
              onPointerDown={(e) => startDrag(e, "s")}
            />
            {/* W */}
            <div
              className={handleStyle("w-resize")}
              style={{ left: px.x, top: px.y + px.h / 2 }}
              onPointerDown={(e) => startDrag(e, "w")}
            />
            {/* E */}
            <div
              className={handleStyle("e-resize")}
              style={{ left: px.x + px.w, top: px.y + px.h / 2 }}
              onPointerDown={(e) => startDrag(e, "e")}
            />
          </>
        )}

        {displaySize.w === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2/70">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          data-ocid="screenshot.crop_confirm_button"
          type="button"
          size="sm"
          onClick={handleConfirm}
          className="gap-1.5 bg-sky-600 text-white hover:bg-sky-500 font-semibold"
        >
          <Crop className="h-3.5 w-3.5" />
          Crop &amp; Run OCR
        </Button>
        <Button
          data-ocid="screenshot.crop_skip_button"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSkipCrop}
          className="text-muted-foreground hover:text-foreground"
        >
          Use Full Image
        </Button>
      </div>
    </div>
  );
}
