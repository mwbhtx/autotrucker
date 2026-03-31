"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import type { RouteSearchResult } from "@mwbhtx/haulvisor-core";

export interface RouteSearchParams {
  origin_lat: number;
  origin_lng: number;
  departure_date: string;
  destination_lat?: number;
  destination_lng?: number;
  search_radius_miles?: number;
  legs?: number;
  max_trip_days?: number;
  // Driver profile
  trailer_types?: string;
  max_weight?: number;
  hazmat_certified?: boolean;
  twic_card?: boolean;
  team_driver?: boolean;
  no_tarps?: boolean;
  // Cost model
  cost_per_mile?: number;
  cost_per_day?: number;
  avg_mpg?: number;
  avg_driving_hours_per_day?: number;
  // Work hours
  work_start_hour?: number;
  work_end_hour?: number;
}

export function useRouteSearch(companyId: string, params: RouteSearchParams | null) {
  return useQuery<RouteSearchResult>({
    queryKey: ["routes", companyId, params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (!params) throw new Error("params required");
      for (const [key, value] of Object.entries(params)) {
        if (value != null) qs.set(key, String(value));
      }
      return fetchApi<RouteSearchResult>(`routes/${companyId}/search?${qs.toString()}`);
    },
    enabled: !!companyId && !!params,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
