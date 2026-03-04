// ─── Fuzzy Match Utility ──────────────────────────────────────────────────────

function normalize(str: string): string {
  return str.toLowerCase().replace(/['\-]/g, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use a single row rolling approach for efficiency
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] =
          1 +
          Math.min(
            prev[j], // deletion
            curr[j - 1], // insertion
            prev[j - 1], // substitution
          );
      }
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  return prev[n];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

export interface MatchResult {
  id: number;
  name: string;
  score: number;
  needsReview?: boolean;
}

export function findBestMatch(
  query: string,
  candidates: Array<{ id: number; name: string }>,
): MatchResult | null {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return null;

  let best: MatchResult | null = null;

  for (const candidate of candidates) {
    const normalizedName = normalize(candidate.name);

    let score: number;

    // Exact match
    if (normalizedName === normalizedQuery) {
      score = 1.0;
    }
    // Starts with
    else if (normalizedName.startsWith(normalizedQuery)) {
      score = 0.92;
    }
    // Query starts with candidate name
    else if (normalizedQuery.startsWith(normalizedName)) {
      score = 0.9;
    }
    // Substring match: query is contained in the name
    else if (normalizedName.includes(normalizedQuery)) {
      score = 0.85;
    }
    // Candidate name is contained in query
    else if (normalizedQuery.includes(normalizedName)) {
      score = 0.82;
    }
    // Levenshtein similarity
    else {
      score = levenshteinSimilarity(normalizedQuery, normalizedName);
    }

    if (score > (best?.score ?? 0)) {
      best = { id: candidate.id, name: candidate.name, score };
    }
  }

  if (!best || best.score < 0.55) return null;
  return best;
}

/**
 * Stricter variant of findBestMatch.
 *
 * Returns a MatchResult with `needsReview: true` when score is in the
 * [0.55, threshold) range — meaning a fuzzy match was found but with low
 * confidence, requiring manual user confirmation.
 *
 * Returns `null` for scores below 0.55 (no viable match).
 *
 * @param threshold  Minimum score for a confident match (default 0.72)
 */
export function findBestMatchStrict(
  query: string,
  candidates: Array<{ id: number; name: string }>,
  threshold = 0.72,
): MatchResult | null {
  const base = findBestMatch(query, candidates);
  if (!base) return null;

  if (base.score >= threshold) {
    return { ...base, needsReview: false };
  }

  // Score is in [0.55, threshold) — needs review
  return { ...base, needsReview: true };
}
