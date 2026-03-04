import * as api from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

export function useFarming() {
  return useQuery({
    queryKey: ["farming"],
    queryFn: api.fetchFarming,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useHerbalism() {
  return useQuery({
    queryKey: ["herbalism"],
    queryFn: api.fetchHerbalism,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useWoodcutting() {
  return useQuery({
    queryKey: ["woodcutting"],
    queryFn: api.fetchWoodcutting,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useHusbandry() {
  return useQuery({
    queryKey: ["husbandry"],
    queryFn: api.fetchHusbandry,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useAllCrafting() {
  return useQuery({
    queryKey: ["crafting", "all"],
    queryFn: api.fetchAllCrafting,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useSwaggerDoc() {
  return useQuery({
    queryKey: ["swagger"],
    queryFn: api.fetchSwaggerDoc,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 60 * 60 * 1000,
  });
}

export type ItemSource = "farming" | "herbalism" | "woodcutting" | "husbandry";

/**
 * Builds a Map<itemId, source> from all gathering/husbandry drop data.
 * Used by the Crafting tab to show which materials come from other calculators.
 */
export function useItemSourceMap(): Map<number, ItemSource> {
  const { data: farmingItems } = useFarming();
  const { data: herbalismItems } = useHerbalism();
  const { data: woodcuttingItems } = useWoodcutting();
  const { data: husbandryItems } = useHusbandry();

  return useMemo(() => {
    const map = new Map<number, ItemSource>();

    for (const item of farmingItems ?? []) {
      for (const drop of item.items) {
        map.set(drop.id, "farming");
      }
    }

    for (const item of herbalismItems ?? []) {
      for (const drop of item.items) {
        map.set(drop.id, "herbalism");
      }
    }

    for (const item of woodcuttingItems ?? []) {
      for (const drop of item.items) {
        map.set(drop.id, "woodcutting");
      }
    }

    for (const item of husbandryItems ?? []) {
      for (const drop of item.items.gathering ?? []) {
        map.set(drop.id, "husbandry");
      }
      for (const drop of item.items.butchering ?? []) {
        map.set(drop.id, "husbandry");
      }
    }

    return map;
  }, [farmingItems, herbalismItems, woodcuttingItems, husbandryItems]);
}

export function useEndpoint(path: string, enabled = true) {
  return useQuery({
    queryKey: ["endpoint", path],
    queryFn: () => api.fetchEndpoint(path),
    enabled,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}
