import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlotType = "crop" | "herb" | "tree" | "animal";
export type LandType = "fort" | "large";

export interface LandSlot {
  id: string;
  landType: LandType;
  plotType: PlotType;
  rowCount: number; // 1–8
}

interface LandInventoryState {
  slots: LandSlot[];
  addSlot: (slot: Omit<LandSlot, "id">) => void;
  updateSlot: (id: string, patch: Partial<Omit<LandSlot, "id">>) => void;
  removeSlot: (id: string) => void;
  clearAll: () => void;
  totalFortRows: () => number;
  totalLargeRows: () => number;
}

export const useLandInventoryStore = create<LandInventoryState>()(
  persist(
    (set, get) => ({
      slots: [],

      addSlot: (slot) =>
        set((s) => ({
          slots: [...s.slots, { ...slot, id: crypto.randomUUID() }],
        })),

      updateSlot: (id, patch) =>
        set((s) => ({
          slots: s.slots.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
        })),

      removeSlot: (id) =>
        set((s) => ({ slots: s.slots.filter((sl) => sl.id !== id) })),

      clearAll: () => set({ slots: [] }),

      totalFortRows: () =>
        get()
          .slots.filter((s) => s.landType === "fort")
          .reduce((sum, s) => sum + s.rowCount, 0),

      totalLargeRows: () =>
        get()
          .slots.filter((s) => s.landType === "large")
          .reduce((sum, s) => sum + s.rowCount, 0),
    }),
    { name: "rq-land-inventory:v1" },
  ),
);
