import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LandSize = "small" | "medium" | "large" | "stronghold" | "fort";

const LAND_MULTIPLIERS: Record<LandSize, number> = {
  small: 1,
  medium: 2,
  large: 4,
  stronghold: 8,
  fort: 20,
};

interface ConfigState {
  landSize: LandSize;
  landMultiplier: number;
  marketFeePercent: number;
  craftTaxPercent: number;

  setLandSize: (size: LandSize) => void;
  setMarketFeePercent: (percent: number) => void;
  setCraftTaxPercent: (percent: number) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      landSize: "medium",
      landMultiplier: LAND_MULTIPLIERS.medium,
      marketFeePercent: 5,
      craftTaxPercent: 0,

      setLandSize: (size: LandSize) => {
        set({
          landSize: size,
          landMultiplier: LAND_MULTIPLIERS[size],
        });
      },

      setMarketFeePercent: (percent: number) => {
        set({ marketFeePercent: Math.max(0, Math.min(100, percent)) });
      },

      setCraftTaxPercent: (percent: number) => {
        set({ craftTaxPercent: Math.max(0, Math.min(100, percent)) });
      },
    }),
    {
      name: "rq-config:v1",
    },
  ),
);
