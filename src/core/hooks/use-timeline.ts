"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import type { TripPhase, TripSimulationSummary } from "@mwbhtx/haulvisor-core";
import type { RouteChain } from "@/core/types";

export interface ExpensesBreakdown {
  total: number;
  fuel: number;
  fuel_is_actual: boolean;
  maintenance: number;
  tires: number;
  def: number;
  custom: { label: string; amount: number }[];
  /** True in 'simple' cost mode — no component split, just the lump total. */
  is_lump_sum: boolean;
}

interface TimelineResponse {
  timeline: TripPhase[];
  trip_summary: TripSimulationSummary & {
    /** Sum of per-fuel-stop (gallons × PADD price). Null when no stops had
     *  a resolvable price. Added by the backend enricher. */
    fuel_cost_actual?: number | null;
  };
  suggested_departure?: string;
  expenses_breakdown?: ExpensesBreakdown;
}

interface SearchContext {
  origin_lat: number;
  origin_lng: number;
  departure_date: string;
  destination_lat?: number;
  destination_lng?: number;
  destination_city?: string;
  cost_per_mile?: number;
  max_driving_hours_per_day?: number;
  max_on_duty_hours_per_day?: number;
  earliest_on_duty_hour?: number;
  latest_on_duty_hour?: number;
}

export function useTimeline(
  companyId: string,
  chain: RouteChain | null,
  searchContext: SearchContext | null,
  enabled: boolean,
) {
  const orderIds = chain?.legs.map(l => l.order_id).filter(Boolean).join(",") ?? "";

  return useQuery<TimelineResponse>({
    queryKey: ["timeline", companyId, orderIds],
    queryFn: () => {
      if (!searchContext || !orderIds) throw new Error("Missing context");
      const qs = new URLSearchParams();
      qs.set("order_ids", orderIds);
      qs.set("origin_lat", String(searchContext.origin_lat));
      qs.set("origin_lng", String(searchContext.origin_lng));
      qs.set("departure_date", searchContext.departure_date);
      if (searchContext.destination_lat != null) qs.set("destination_lat", String(searchContext.destination_lat));
      if (searchContext.destination_lng != null) qs.set("destination_lng", String(searchContext.destination_lng));
      if (searchContext.destination_city) qs.set("destination_city", searchContext.destination_city);
      if (searchContext.cost_per_mile != null) qs.set("cost_per_mile", String(searchContext.cost_per_mile));
      if (searchContext.max_driving_hours_per_day != null) qs.set("max_driving_hours_per_day", String(searchContext.max_driving_hours_per_day));
      if (searchContext.max_on_duty_hours_per_day != null) qs.set("max_on_duty_hours_per_day", String(searchContext.max_on_duty_hours_per_day));
      if (searchContext.earliest_on_duty_hour != null) qs.set("earliest_on_duty_hour", String(searchContext.earliest_on_duty_hour));
      if (searchContext.latest_on_duty_hour != null) qs.set("latest_on_duty_hour", String(searchContext.latest_on_duty_hour));
      return fetchApi<TimelineResponse>(`routes/${companyId}/timeline?${qs.toString()}`);
    },
    enabled: enabled && !!companyId && !!orderIds && !!searchContext,
    retry: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
