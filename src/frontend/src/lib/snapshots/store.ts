import type { BandStats } from "@/lib/calculator/growTimeBands";
import type { PriceBook } from "@/lib/priceBook/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_SNAPSHOTS = 10;

export interface Snapshot {
  id: string;
  label: string;
  timestamp: number;
  priceBook: PriceBook;
  bandStats: BandStats[];
}

interface SnapshotState {
  snapshots: Snapshot[];
  saveSnapshot: (
    label: string,
    priceBook: PriceBook,
    bandStats: BandStats[],
  ) => void;
  removeSnapshot: (id: string) => void;
  getLatest: () => Snapshot | null;
  clearAll: () => void;
}

export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set, get) => ({
      snapshots: [],

      saveSnapshot: (label, priceBook, bandStats) => {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString();

        const newSnapshot: Snapshot = {
          id,
          label,
          timestamp: Date.now(),
          priceBook,
          bandStats,
        };

        set((state) => {
          const updated = [newSnapshot, ...state.snapshots];
          // Cap at MAX_SNAPSHOTS (oldest removed first since list is newest-first)
          if (updated.length > MAX_SNAPSHOTS) {
            updated.splice(MAX_SNAPSHOTS);
          }
          return { snapshots: updated };
        });
      },

      removeSnapshot: (id) => {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
        }));
      },

      getLatest: () => {
        const snaps = get().snapshots;
        return snaps.length > 0 ? snaps[0] : null;
      },

      clearAll: () => {
        set({ snapshots: [] });
      },
    }),
    {
      name: "rq-snapshots:v1",
    },
  ),
);
