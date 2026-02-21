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
    }),
    {
      name: "ravenquest-price-book",
    },
  ),
);
