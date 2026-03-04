import { findBestMatch } from "@/lib/fuzzyMatch";

export interface ParsedPriceUpdate {
  matched: Array<{ id: number; name: string; price: number }>;
  unrecognized: string[];
}

/**
 * Parses a text block into price updates.
 *
 * Supported formats:
 *  Format A (one per line):  "Apple 3690"  or  "Apple: 3690"
 *  Format B (comma-separated): "apple:3690, cherry:3765"
 *
 * Numbers: integers or decimals, with optional commas as thousand separators.
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
    // Try to extract item name + price
    // Patterns: "Apple 3690", "Apple: 3690", "apple:3690", "apple : 3,690"
    const match = seg.match(/^(.+?)\s*:?\s+([0-9][0-9,]*(?:\.[0-9]+)?)$/);
    if (!match) {
      // Could be "apple:3690" (no space)
      const altMatch = seg.match(/^(.+?):([0-9][0-9,]*(?:\.[0-9]+)?)$/);
      if (!altMatch) {
        unrecognized.push(seg);
        continue;
      }
      const itemQuery = altMatch[1].trim();
      const priceStr = altMatch[2].replace(/,/g, "");
      const price = Number.parseFloat(priceStr);
      if (Number.isNaN(price) || price < 0) {
        unrecognized.push(seg);
        continue;
      }
      const result = findBestMatch(itemQuery, knownItems);
      if (!result) {
        unrecognized.push(itemQuery);
        continue;
      }
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        matched.push({ id: result.id, name: result.name, price });
      }
      continue;
    }

    const itemQuery = match[1].trim();
    const priceStr = match[2].replace(/,/g, "");
    const price = Number.parseFloat(priceStr);

    if (Number.isNaN(price) || price < 0) {
      unrecognized.push(seg);
      continue;
    }

    const result = findBestMatch(itemQuery, knownItems);
    if (!result) {
      unrecognized.push(itemQuery);
      continue;
    }

    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      matched.push({ id: result.id, name: result.name, price });
    }
  }

  return { matched, unrecognized };
}
