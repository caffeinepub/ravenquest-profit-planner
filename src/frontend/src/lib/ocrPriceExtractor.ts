// ─── Column-Aware OCR Price Extractor ────────────────────────────────────────
// Parses Tesseract.js Page output into structured rows with per-row confidence.

// We avoid importing the full tesseract.js types at the module level to keep
// the bundle clean — we only need the Page shape at runtime.

export interface OcrRow {
  /** OCR text tokens for the item name (non-price portion) */
  rawName: string;
  /** Raw price string exactly as found in the OCR output */
  rawPrice: string;
  /** Normalized integer price (commas/spaces stripped) */
  price: number;
  /** Per-row confidence on a 0–1 scale */
  confidence: number;
  /** Full raw line text, useful for debug display */
  lineText: string;
}

// Price-like token patterns
const PRICE_PATTERNS: RegExp[] = [
  /^\d+$/, // plain integer: 123
  /^\d{1,3}(,\d{3})+$/, // comma thousands: 1,234 or 1,234,567
  /^\d+(\s\d{3})+$/, // space thousands: 12 345
];

function looksLikePrice(token: string): boolean {
  return PRICE_PATTERNS.some((re) => re.test(token));
}

function normalizePrice(raw: string): number {
  return Number.parseInt(raw.replace(/[,\s]/g, ""), 10);
}

/**
 * Accepts the `result.data` Page object returned by Tesseract.js `worker.recognize()`
 * and converts it into structured OcrRow entries.
 *
 * Strategy:
 * - Iterate lines
 * - For each line, collect words; detect rightmost price-like token
 * - Everything before the price = item name
 * - Confidence = mean of word confidences (0–100 → 0–1)
 * - Also try merging consecutive numeric words to handle "12 345" split across words
 */
export function extractOcrRows(tesseractPage: unknown): OcrRow[] {
  const rows: OcrRow[] = [];

  const page = tesseractPage as Record<string, unknown>;
  const lines = (Array.isArray(page?.lines) ? page.lines : []) as Record<
    string,
    unknown
  >[];

  for (const line of lines) {
    const words = (Array.isArray(line?.words) ? line.words : []) as Record<
      string,
      unknown
    >[];
    if (words.length < 2) continue;

    const wordTexts: string[] = words.map((w) => String(w?.text ?? "").trim());
    const confidences: number[] = words.map(
      (w) => Number(w?.confidence ?? 0) / 100,
    );

    // Build merged token list: try joining adjacent numeric tokens for "12 345"
    // We process left-to-right, merging runs of digit-only tokens if they form a price
    const mergedTokens: string[] = [];
    let i = 0;
    while (i < wordTexts.length) {
      const tok = wordTexts[i];
      // Try to merge with next token if both are digit-only
      if (
        /^\d+$/.test(tok) &&
        i + 1 < wordTexts.length &&
        /^\d{3}$/.test(wordTexts[i + 1])
      ) {
        const merged = `${tok} ${wordTexts[i + 1]}`;
        mergedTokens.push(merged);
        i += 2;
      } else {
        mergedTokens.push(tok);
        i++;
      }
    }

    // Find the LAST price-like token (rightmost column)
    let priceIndex = -1;
    for (let j = mergedTokens.length - 1; j >= 0; j--) {
      if (looksLikePrice(mergedTokens[j])) {
        priceIndex = j;
        break;
      }
    }

    if (priceIndex < 0) continue; // no price found in this line

    const rawPrice = mergedTokens[priceIndex];
    const price = normalizePrice(rawPrice);
    if (Number.isNaN(price) || price <= 0) continue;

    const nameParts = mergedTokens.slice(0, priceIndex);
    const rawName = nameParts.join(" ").trim();
    if (!rawName) continue;

    const lineText = wordTexts.join(" ");
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    rows.push({
      rawName,
      rawPrice,
      price,
      confidence: Math.min(1, Math.max(0, avgConfidence)),
      lineText,
    });
  }

  return rows;
}
