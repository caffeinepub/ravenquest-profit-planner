import type { backendInterface } from "@/backend";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PriceBook, PriceEntry } from "./types";

interface PriceBookState {
  priceBook: PriceBook;
  setPrice: (itemId: number, itemName: string, price: number) => void;
  getPrice: (itemId: number) => number | null;
  hasPrice: (itemId: number) => boolean;
  clearPrice: (itemId: number) => void;
  clearAll: () => void;
  importPrices: (data: PriceBook) => void;
  exportPrices: () => PriceBook;

  // Guild mode (runtime-only, not persisted)
  guildMode: boolean;
  lastSyncAt: number | null;
  syncStatus: "idle" | "syncing" | "error";
  setGuildMode: (enabled: boolean, actor?: backendInterface | null) => void;
  syncFromBackend: (actor: backendInterface) => Promise<void>;
  syncToBackend: (actor: backendInterface) => Promise<void>;
}

export const usePriceBookStore = create<PriceBookState>()(
  persist(
    (set, get) => ({
      priceBook: {},

      setPrice: (itemId: number, itemName: string, price: number) => {
        set((state) => ({
          priceBook: {
            ...state.priceBook,
            [itemId]: {
              itemId,
              itemName,
              price,
              lastUpdated: Date.now(),
            },
          },
        }));
      },

      getPrice: (itemId: number) => {
        const entry = get().priceBook[itemId];
        return entry ? entry.price : null;
      },

      hasPrice: (itemId: number) => {
        return itemId in get().priceBook;
      },

      clearPrice: (itemId: number) => {
        set((state) => {
          const newPriceBook = { ...state.priceBook };
          delete newPriceBook[itemId];
          return { priceBook: newPriceBook };
        });
      },

      clearAll: () => {
        set({ priceBook: {} });
      },

      importPrices: (data: PriceBook) => {
        set({ priceBook: data });
      },

      exportPrices: () => {
        return get().priceBook;
      },

      // Guild mode fields (runtime only)
      guildMode: false,
      lastSyncAt: null,
      syncStatus: "idle",

      setGuildMode: (enabled: boolean, actor?: backendInterface | null) => {
        set({ guildMode: enabled });
        if (enabled && actor) {
          void get().syncFromBackend(actor);
        }
      },

      syncFromBackend: async (actor: backendInterface) => {
        set({ syncStatus: "syncing" });
        try {
          const entries = await actor.getPrices();
          const localBook = get().priceBook;
          const merged: PriceBook = { ...localBook };

          for (const [idBig, entry] of entries) {
            const id = Number(idBig);
            const backendTs = Number(entry.lastUpdatedAt);
            const localTs = localBook[id]?.lastUpdated ?? 0;
            // Backend wins if its timestamp is more recent
            if (backendTs > localTs) {
              merged[id] = {
                itemId: id,
                itemName: entry.itemName,
                price: entry.price,
                lastUpdated: backendTs,
              };
            }
          }

          set({
            priceBook: merged,
            syncStatus: "idle",
            lastSyncAt: Date.now(),
          });
        } catch {
          set({ syncStatus: "error" });
        }
      },

      syncToBackend: async (actor: backendInterface) => {
        set({ syncStatus: "syncing" });
        try {
          const entries = Object.values(get().priceBook);
          await Promise.all(
            entries.map((e) =>
              actor.setPrice(BigInt(e.itemId), e.itemName, e.price),
            ),
          );
          set({ syncStatus: "idle", lastSyncAt: Date.now() });
        } catch {
          set({ syncStatus: "error" });
        }
      },
    }),
    {
      name: "ravenquest-price-book",
      // Exclude runtime-only guild fields from persistence
      partialize: (state) => ({ priceBook: state.priceBook }),
    },
  ),
);
