import type { backendInterface } from "@/backend";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalPriceRecord {
  itemId: number;
  itemName: string;
  price: number;
  timestamp: number; // ms
  source: "chat" | "screenshot" | "manual";
  updatedBy?: string;
}

export interface BaselineInfo {
  baseline: number;
  volatility: number;
  method: string;
  dataPoints: number;
}

export type SellHoldSignal = "SELL" | "HOLD" | "STOCKPILE" | null;

// ─── Max records per item ─────────────────────────────────────────────────────

const MAX_RECORDS_PER_ITEM = 500;
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

// ─── Pure computation helpers ─────────────────────────────────────────────────

function computeMean(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function computeStdDev(prices: number[], mean: number): number {
  if (prices.length <= 1) return 0;
  const variance =
    prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / (prices.length - 1);
  return Math.sqrt(variance);
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PriceHistoryState {
  records: LocalPriceRecord[];

  // Mutations
  addRecords: (records: LocalPriceRecord[]) => void;

  // Queries
  getHistory: (itemId: number) => LocalPriceRecord[];
  computeBaseline: (itemId: number) => BaselineInfo | null;
  getSignal: (itemId: number, currentPrice: number) => SellHoldSignal;

  // Backend sync
  syncToBackend: (
    actor: backendInterface,
    identity?: { getPrincipal: () => { toText: () => string } } | null,
  ) => Promise<void>;
}

export const usePriceHistoryStore = create<PriceHistoryState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecords: (newRecords: LocalPriceRecord[]) => {
        set((state) => {
          // Merge new records at the front
          const combined = [...newRecords, ...state.records];

          // Group by itemId and trim to max per item
          const byItem = new Map<number, LocalPriceRecord[]>();
          for (const rec of combined) {
            const list = byItem.get(rec.itemId) ?? [];
            list.push(rec);
            byItem.set(rec.itemId, list);
          }

          const trimmed: LocalPriceRecord[] = [];
          for (const [, recs] of byItem) {
            // Keep newest first, trim to max
            const sorted = recs
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp);
            trimmed.push(...sorted.slice(0, MAX_RECORDS_PER_ITEM));
          }

          // Sort overall by timestamp descending
          trimmed.sort((a, b) => b.timestamp - a.timestamp);

          return { records: trimmed };
        });
      },

      getHistory: (itemId: number): LocalPriceRecord[] => {
        return get()
          .records.filter((r) => r.itemId === itemId)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      computeBaseline: (itemId: number): BaselineInfo | null => {
        const all = get()
          .records.filter((r) => r.itemId === itemId)
          .sort((a, b) => b.timestamp - a.timestamp);

        if (all.length === 0) return null;

        const nowMs = Date.now();
        const sevenDayRecords = all.filter(
          (r) => nowMs - r.timestamp <= SEVEN_DAYS_MS,
        );

        let window: LocalPriceRecord[];
        let method: string;

        if (sevenDayRecords.length >= 3) {
          window = sevenDayRecords;
          method = "7d_rolling_avg";
        } else if (all.length >= 3) {
          window = all.slice(0, 30);
          method = "last_30_avg";
        } else if (all.length >= 1) {
          window = all.slice(0, 10);
          method = "last_10_avg";
        } else {
          return null;
        }

        const prices = window.map((r) => r.price);
        const mean = computeMean(prices);
        const stddev = computeStdDev(prices, mean);

        return {
          baseline: mean,
          volatility: stddev,
          method,
          dataPoints: prices.length,
        };
      },

      getSignal: (itemId: number, currentPrice: number): SellHoldSignal => {
        const baseline = get().computeBaseline(itemId);
        if (!baseline) return null;
        if (baseline.dataPoints < 3) return null;

        const { baseline: mean, volatility } = baseline;

        let sellThreshold: number;
        let stockpileThreshold: number;

        if (volatility === 0) {
          // Use ±5% of baseline as threshold
          sellThreshold = mean * 1.05;
          stockpileThreshold = mean * 0.95;
        } else {
          sellThreshold = mean + 1.0 * volatility;
          stockpileThreshold = mean - 1.0 * volatility;
        }

        if (currentPrice > sellThreshold) return "SELL";
        if (currentPrice < stockpileThreshold) return "STOCKPILE";
        return "HOLD";
      },

      syncToBackend: async (
        actor: backendInterface,
        identity?: { getPrincipal: () => { toText: () => string } } | null,
      ): Promise<void> => {
        const records = get().records;
        if (records.length === 0) return;

        const updatedBy = identity?.getPrincipal().toText() ?? "";

        // Batch in groups of 50
        const BATCH = 50;
        for (let i = 0; i < records.length; i += BATCH) {
          const batch = records.slice(i, i + BATCH);
          await actor.addPriceHistory(
            batch.map((r) => ({
              itemId: BigInt(r.itemId),
              itemName: r.itemName,
              price: r.price,
              source: r.source,
              updatedBy: r.updatedBy ?? updatedBy,
            })),
          );
        }
      },
    }),
    {
      name: "rq-price-history:v1",
      // Only persist records, not computed state
      partialize: (state) => ({ records: state.records }),
    },
  ),
);
