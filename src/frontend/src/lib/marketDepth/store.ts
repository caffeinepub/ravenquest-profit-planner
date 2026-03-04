import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MarketDepthEntry {
  itemId: number;
  buyOrders: number | null;
  sellOrders: number | null;
}

interface MarketDepthState {
  depth: Record<number, MarketDepthEntry>;
  setDepth: (itemId: number, buy: number | null, sell: number | null) => void;
  getDepth: (itemId: number) => MarketDepthEntry | null;
  getLiquidityScore: (itemId: number) => number | null;
  getLiquidityLabel: (itemId: number) => "high" | "medium" | "low" | "unknown";
}

export const useMarketDepthStore = create<MarketDepthState>()(
  persist(
    (set, get) => ({
      depth: {},

      setDepth: (itemId, buy, sell) => {
        set((state) => ({
          depth: {
            ...state.depth,
            [itemId]: { itemId, buyOrders: buy, sellOrders: sell },
          },
        }));
      },

      getDepth: (itemId) => {
        return get().depth[itemId] ?? null;
      },

      getLiquidityScore: (itemId) => {
        const entry = get().depth[itemId];
        if (!entry) return null;
        if (entry.buyOrders === null || entry.sellOrders === null) return null;
        if (entry.sellOrders === 0) return null;
        return entry.buyOrders / entry.sellOrders;
      },

      getLiquidityLabel: (itemId) => {
        const score = get().getLiquidityScore(itemId);
        if (score === null) return "unknown";
        if (score >= 1.5) return "high";
        if (score >= 0.5) return "medium";
        return "low";
      },
    }),
    {
      name: "rq-market-depth:v1",
    },
  ),
);
