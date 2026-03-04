// ─── Image Preprocessing Pipeline ────────────────────────────────────────────

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Preprocess an image for OCR:
 * 1. Crop to the specified region (or full image if no crop)
 * 2. Convert to grayscale
 * 3. Upscale 2x (nearest-neighbour to preserve edge sharpness)
 * 4. Increase contrast
 * 5. Apply 3×3 sharpening kernel
 * 6. Binarize (Otsu-style mean threshold)
 *
 * @param source  data URL string or Blob containing the source image
 * @param crop    optional crop rectangle in *pixel* coordinates
 * @returns       data URL of the processed image (PNG)
 */
export async function preprocessImage(
  source: string | Blob,
  crop?: CropRect,
): Promise<string> {
  // ── 1. Load the image into a bitmap ────────────────────────────────────────
  const url = typeof source === "string" ? source : URL.createObjectURL(source);

  const img = await loadImage(url);

  if (typeof source !== "string") {
    URL.revokeObjectURL(url);
  }

  // ── 2. Determine crop rect ─────────────────────────────────────────────────
  const srcX = crop ? Math.round(crop.x) : 0;
  const srcY = crop ? Math.round(crop.y) : 0;
  const srcW = crop ? Math.round(crop.w) : img.naturalWidth;
  const srcH = crop ? Math.round(crop.h) : img.naturalHeight;

  // ── 3. Draw cropped region to an offscreen canvas ──────────────────────────
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = srcW;
  cropCanvas.height = srcH;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Could not get 2D context");

  cropCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  let imageData = cropCtx.getImageData(0, 0, srcW, srcH);

  // ── 4. Grayscale ───────────────────────────────────────────────────────────
  imageData = toGrayscale(imageData);

  // ── 5. Increase contrast ───────────────────────────────────────────────────
  imageData = adjustContrast(imageData, 1.4);

  // ── 6. Sharpen ─────────────────────────────────────────────────────────────
  imageData = convolve(imageData, SHARPEN_KERNEL);

  // ── 7. Binarize ────────────────────────────────────────────────────────────
  imageData = binarize(imageData);

  // Write back to crop canvas
  cropCtx.putImageData(imageData, 0, 0);

  // ── 8. Upscale 2x (nearest-neighbour) ─────────────────────────────────────
  const upCanvas = document.createElement("canvas");
  upCanvas.width = srcW * 2;
  upCanvas.height = srcH * 2;
  const upCtx = upCanvas.getContext("2d");
  if (!upCtx) throw new Error("Could not get 2D context");

  upCtx.imageSmoothingEnabled = false;
  upCtx.drawImage(cropCanvas, 0, 0, srcW * 2, srcH * 2);

  return upCanvas.toDataURL("image/png");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function toGrayscale(data: ImageData): ImageData {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
    // alpha unchanged
  }
  return data;
}

function adjustContrast(data: ImageData, factor: number): ImageData {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c];
      d[i + c] = Math.min(255, Math.max(0, (v - 128) * factor + 128));
    }
  }
  return data;
}

// 3×3 sharpening kernel
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];

function convolve(data: ImageData, kernel: number[]): ImageData {
  const { width, height } = data;
  const src = new Uint8ClampedArray(data.data);
  const dst = data.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const srcIdx = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelVal = kernel[(ky + 1) * 3 + (kx + 1)];
            val += src[srcIdx] * kernelVal;
          }
        }
        dst[idx + c] = Math.min(255, Math.max(0, val));
      }
    }
  }

  return data;
}

function binarize(data: ImageData): ImageData {
  const d = data.data;
  // Compute mean brightness
  let sum = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += d[i]; // grayscale: r == g == b
    count++;
  }
  const mean = count > 0 ? sum / count : 128;

  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] >= mean ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  return data;
}
