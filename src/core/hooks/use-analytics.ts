"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import type {
  AnalyticsStats,
  AnalyticsHistoryEntry,
  AnalyticsChurnEntry,
  AnalyticsBreakdownEntry,
  AnalyticsAvailabilityEntry,
  AnalyticsTopCityEntry,
  AnalyticsTopStateEntry,
  AnalyticsTopLaneEntry,
  AnalyticsSide,
  AnalyticsLaneGranularity,
} from "@/core/types";

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  ) as [string, string][];
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export function useAnalyticsStats(
  companyId: string,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ from, to });
  return useQuery<AnalyticsStats>({
    queryKey: ["analytics", companyId, "stats", from, to],
    queryFn: () =>
      fetchApi<AnalyticsStats>(`analytics/${companyId}/stats${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsHistory(
  companyId: string,
  from?: string,
  to?: string,
  bucket?: string,
) {
  const qs = buildQuery({ from, to, bucket });
  return useQuery<AnalyticsHistoryEntry[]>({
    queryKey: ["analytics", companyId, "history", from, to, bucket],
    queryFn: () =>
      fetchApi<AnalyticsHistoryEntry[]>(`analytics/${companyId}/history${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsTopLanes(
  companyId: string,
  granularity: AnalyticsLaneGranularity,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ granularity, from, to });
  return useQuery<AnalyticsTopLaneEntry[]>({
    queryKey: ["analytics", companyId, "top-lanes", granularity, from, to],
    queryFn: () =>
      fetchApi<AnalyticsTopLaneEntry[]>(`analytics/${companyId}/top-lanes${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsChurn(
  companyId: string,
  from?: string,
  to?: string,
  bucket?: string,
) {
  const qs = buildQuery({ from, to, bucket });
  return useQuery<AnalyticsChurnEntry[]>({
    queryKey: ["analytics", companyId, "churn", from, to, bucket],
    queryFn: () =>
      fetchApi<AnalyticsChurnEntry[]>(`analytics/${companyId}/churn${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsTrailerBreakdown(
  companyId: string,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ from, to });
  return useQuery<AnalyticsBreakdownEntry[]>({
    queryKey: ["analytics", companyId, "trailer-breakdown", from, to],
    queryFn: () =>
      fetchApi<AnalyticsBreakdownEntry[]>(
        `analytics/${companyId}/trailer-breakdown${qs}`,
      ),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsAvailability(
  companyId: string,
  from?: string,
  to?: string,
  bucket?: string,
) {
  const qs = buildQuery({ from, to, bucket });
  return useQuery<AnalyticsAvailabilityEntry[]>({
    queryKey: ["analytics", companyId, "availability", from, to, bucket],
    queryFn: () =>
      fetchApi<AnalyticsAvailabilityEntry[]>(
        `analytics/${companyId}/availability${qs}`,
      ),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsTopCities(
  companyId: string,
  side: AnalyticsSide,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ side, from, to });
  return useQuery<AnalyticsTopCityEntry[]>({
    queryKey: ["analytics", companyId, "top-cities", side, from, to],
    queryFn: () =>
      fetchApi<AnalyticsTopCityEntry[]>(`analytics/${companyId}/top-cities${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAnalyticsTopStates(
  companyId: string,
  side: AnalyticsSide,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ side, from, to });
  return useQuery<AnalyticsTopStateEntry[]>({
    queryKey: ["analytics", companyId, "top-states", side, from, to],
    queryFn: () =>
      fetchApi<AnalyticsTopStateEntry[]>(`analytics/${companyId}/top-states${qs}`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}
