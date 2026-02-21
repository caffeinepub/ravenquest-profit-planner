import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

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

export function useEndpoint(path: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["endpoint", path],
    queryFn: () => api.fetchEndpoint(path),
    enabled,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}
