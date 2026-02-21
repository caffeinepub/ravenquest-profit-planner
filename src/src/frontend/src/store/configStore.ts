import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PricingMode } from "@/lib/priceBook/types";

export type LandSize = "small" | "medium" | "large" | "stronghold" | "fort";

const LAND_MULTIPLIERS: Record<LandSize, number> = {
  small: 1,
  medium: 2,
  large: 4,
  stronghold: 8,
  fort: 20,
};

interface ConfigState {
  // Land configuration
  landSize: LandSize;
  landMultiplier: number;
  upgradeLevel: number;

  // Fees and taxes
  marketFeePercent: number;
  craftingFee: number;
  listingFee: number;

  // Calculation options
  includeOpportunityCost: boolean;
  pricingMode: PricingMode;

  // Server/region (placeholder for future)
  selectedServer: string | null;

  // Actions
  setLandSize: (size: LandSize) => void;
  setUpgradeLevel: (level: number) => void;
  setMarketFeePercent: (percent: number) => void;
  setCraftingFee: (fee: number) => void;
  setListingFee: (fee: number) => void;
  setIncludeOpportunityCost: (include: boolean) => void;
  setPricingMode: (mode: PricingMode) => void;
  setSelectedServer: (server: string | null) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      // Default values
      landSize: "medium",
      landMultiplier: LAND_MULTIPLIERS.medium,
      upgradeLevel: 0,
      marketFeePercent: 5,
      craftingFee: 0,
      listingFee: 0,
      includeOpportunityCost: false,
      pricingMode: "manual",
      selectedServer: null,

      // Actions
      setLandSize: (size: LandSize) => {
        set({
          landSize: size,
          landMultiplier: LAND_MULTIPLIERS[size],
        });
      },

      setUpgradeLevel: (level: number) => {
        set({ upgradeLevel: Math.max(0, Math.min(10, level)) });
      },

      setMarketFeePercent: (percent: number) => {
        set({ marketFeePercent: Math.max(0, Math.min(100, percent)) });
      },

      setCraftingFee: (fee: number) => {
        set({ craftingFee: Math.max(0, fee) });
      },

      setListingFee: (fee: number) => {
        set({ listingFee: Math.max(0, fee) });
      },

      setIncludeOpportunityCost: (include: boolean) => {
        set({ includeOpportunityCost: include });
      },

      setPricingMode: (mode: PricingMode) => {
        set({ pricingMode: mode });
      },

      setSelectedServer: (server: string | null) => {
        set({ selectedServer: server });
      },
    }),
    {
      name: "ravenquest-config",
    },
  ),
);
