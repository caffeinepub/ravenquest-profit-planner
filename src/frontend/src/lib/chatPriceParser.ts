import { findBestMatch } from "@/lib/fuzzyMatch";

export interface ParsedPriceUpdate {
  matched: Array<{ id: number; name: string; price: number }>;
  unrecognized: string[];
}

/**
 * Normalise a raw price string: remove commas and internal spaces used as
 * thousand separators (e.g. "1 100" → "1100", "1,100" → "1100").
 */
function normalisePrice(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, "");
  return Number.parseFloat(cleaned);
}

/**
 * Try to extract { itemQuery, price } from a single segment string.
 *
 * Supported formats:
 *   "Apple 3690"
 *   "Apple: 3690"
 *   "apple:3690"          (no space)
 *   "apple - 3690"        (dash separator)
 *   "apple - 3,690"       (dash + comma thousands)
 *   "Apple 1,100"         (comma thousands)
 *   "Apple 1 100"         (space thousands — last word is price)
 */
function extractPair(seg: string): { itemQuery: string; price: number } | null {
  // Pattern 1: "name - price" (dash separator, optional spaces around dash)
  const dashMatch = seg.match(/^(.+?)\s*-\s+([0-9][0-9,\s]*(?:\.[0-9]+)?)$/);
  if (dashMatch) {
    const price = normalisePrice(dashMatch[2]);
    if (!Number.isNaN(price) && price >= 0)
      return { itemQuery: dashMatch[1].trim(), price };
  }

  // Pattern 2: "name: price" or "name price" (colon optional, space separated)
  const spaceMatch = seg.match(/^(.+?)\s*:?\s+([0-9][0-9,]*(?:\.[0-9]+)?)$/);
  if (spaceMatch) {
    const price = normalisePrice(spaceMatch[2]);
    if (!Number.isNaN(price) && price >= 0)
      return { itemQuery: spaceMatch[1].trim(), price };
  }

  // Pattern 3: "name:price" (colon, no space)
  const colonMatch = seg.match(/^(.+?):([0-9][0-9,]*(?:\.[0-9]+)?)$/);
  if (colonMatch) {
    const price = normalisePrice(colonMatch[2]);
    if (!Number.isNaN(price) && price >= 0)
      return { itemQuery: colonMatch[1].trim(), price };
  }

  return null;
}

/**
 * Parses a text block into price updates.
 *
 * Supported formats:
 *  "Apple 3690"       (space)
 *  "Apple: 3690"      (colon + space)
 *  "apple:3690"       (colon, no space)
 *  "apple - 3690"     (dash separator)
 *  "Apple 1,100"      (comma thousands)
 *  "Apple 1 100"      (space thousands)
 *  "apple:3690, cherry:3765"  (comma-separated batch)
 */
export function parsePriceInput(
  text: string,
  knownItems: Array<{ id: number; name: string }>,
): ParsedPriceUpdate {
  const matched: Array<{ id: number; name: string; price: number }> = [];
  const unrecognized: string[] = [];

  if (!text.trim()) return { matched, unrecognized };

  // Split into candidate token pairs.
  // Strategy: split on newlines first, then handle commas within each line.
  const rawLines = text.split(/\n/);

  const segments: string[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // If the line contains commas (Format B), split by comma
    if (trimmed.includes(",")) {
      for (const seg of trimmed.split(",")) {
        const s = seg.trim();
        if (s) segments.push(s);
      }
    } else {
      segments.push(trimmed);
    }
  }

  const seenIds = new Set<number>();

  for (const seg of segments) {
    const pair = extractPair(seg);
    if (!pair) {
      unrecognized.push(seg);
      continue;
    }

    const result = findBestMatch(pair.itemQuery, knownItems);
    if (!result) {
      unrecognized.push(pair.itemQuery);
      continue;
    }

    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      matched.push({ id: result.id, name: result.name, price: pair.price });
    }
  }

  return { matched, unrecognized };
}
