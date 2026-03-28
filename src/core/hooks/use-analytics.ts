"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type {
  AnalyticsStats,
  AnalyticsHistoryEntry,
  AnalyticsLaneEntry,
  AnalyticsChurnEntry,
  AnalyticsBreakdownEntry,
  AnalyticsAvailabilityEntry,
  AnalyticsTopCitiesEntry,
} from "@/lib/types";

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
  from?: string,
  to?: string,
  bucket?: string,
) {
  const qs = buildQuery({ from, to, bucket });
  return useQuery<AnalyticsLaneEntry[]>({
    queryKey: ["analytics", companyId, "top-lanes", from, to, bucket],
    queryFn: () =>
      fetchApi<AnalyticsLaneEntry[]>(`analytics/${companyId}/top-lanes${qs}`),
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

export function useAnalyticsStateBreakdown(
  companyId: string,
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ from, to });
  return useQuery<AnalyticsBreakdownEntry[]>({
    queryKey: ["analytics", companyId, "state-breakdown", from, to],
    queryFn: () =>
      fetchApi<AnalyticsBreakdownEntry[]>(
        `analytics/${companyId}/state-breakdown${qs}`,
      ),
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
  from?: string,
  to?: string,
) {
  const qs = buildQuery({ from, to });
  return useQuery<AnalyticsTopCitiesEntry[]>({
    queryKey: ["analytics", companyId, "top-cities", from, to],
    queryFn: () =>
      fetchApi<AnalyticsTopCitiesEntry[]>(
        `analytics/${companyId}/top-cities${qs}`,
      ),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}
