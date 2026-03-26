"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { RouteSearchResult } from "@/lib/types";
import type { RoundTripSearchResult } from "@mwbhtx/haulvisor-types";

export interface RouteSearchParams {
  origin_lat: number;
  origin_lng: number;
  dest_lat?: number;
  dest_lng?: number;
  legs?: number;
  cost_per_mile?: number;
  trailer_types?: string;
  max_layover_hours?: number;
}

export function useRouteSearch(companyId: string, params: RouteSearchParams | null) {
  return useQuery<RouteSearchResult>({
    queryKey: ["routes", companyId, params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params) {
        qs.set("origin_lat", String(params.origin_lat));
        qs.set("origin_lng", String(params.origin_lng));
        if (params.dest_lat != null) qs.set("dest_lat", String(params.dest_lat));
        if (params.dest_lng != null) qs.set("dest_lng", String(params.dest_lng));
        if (params.legs != null) qs.set("legs", String(params.legs));
        if (params.cost_per_mile != null) qs.set("cost_per_mile", String(params.cost_per_mile));
        if (params.trailer_types) qs.set("trailer_types", params.trailer_types);
        if (params.max_layover_hours != null) qs.set("max_layover_hours", String(params.max_layover_hours));
      }
      return fetchApi<RouteSearchResult>(`routes/${companyId}/search?${qs.toString()}`);
    },
    enabled: !!companyId && !!params,
    staleTime: 5 * 60 * 1000,   // consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000,     // keep in cache for 10 minutes
  });
}

export interface RoundTripSearchParams {
  origin_lat: number;
  origin_lng: number;
  origin_city?: string;
  legs?: number;
  risk?: 'any' | 'safe' | 'moderate' | 'bold';
  home_by?: string;
  max_deadhead_pct?: number;
  // Driver profile
  trailer_types?: string;
  max_weight?: number;
  hazmat_certified?: boolean;
  twic_card?: boolean;
  team_driver?: boolean;
  max_assigned_orders?: number;
  // Timing
  max_layover_hours?: number;
  // Cost model
  cost_per_mile?: number;
  diesel_price_per_gallon?: number;
  maintenance_per_mile?: number;
  tires_per_mile?: number;
  truck_payment_per_day?: number;
  insurance_per_day?: number;
  per_diem_per_day?: number;
}

export function useRoundTripSearch(companyId: string, params: RoundTripSearchParams | null) {
  return useQuery<RoundTripSearchResult>({
    queryKey: ["routes-round-trip", companyId, params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params) {
        qs.set("origin_lat", String(params.origin_lat));
        qs.set("origin_lng", String(params.origin_lng));
        if (params.origin_city) qs.set("origin_city", params.origin_city);
        if (params.legs != null) qs.set("legs", String(params.legs));
        if (params.risk) qs.set("risk", params.risk);
        if (params.home_by) qs.set("home_by", params.home_by);
        if (params.max_deadhead_pct != null) qs.set("max_deadhead_pct", String(params.max_deadhead_pct));
        if (params.max_layover_hours != null) qs.set("max_layover_hours", String(params.max_layover_hours));
        // Driver profile
        if (params.trailer_types) qs.set("trailer_types", params.trailer_types);
        if (params.max_weight != null) qs.set("max_weight", String(params.max_weight));
        if (params.hazmat_certified != null) qs.set("hazmat_certified", String(params.hazmat_certified));
        if (params.twic_card != null) qs.set("twic_card", String(params.twic_card));
        if (params.team_driver != null) qs.set("team_driver", String(params.team_driver));
        if (params.max_assigned_orders != null) qs.set("max_assigned_orders", String(params.max_assigned_orders));
        // Cost model
        if (params.cost_per_mile != null) qs.set("cost_per_mile", String(params.cost_per_mile));
        if (params.diesel_price_per_gallon != null) qs.set("diesel_price_per_gallon", String(params.diesel_price_per_gallon));
        if (params.maintenance_per_mile != null) qs.set("maintenance_per_mile", String(params.maintenance_per_mile));
        if (params.tires_per_mile != null) qs.set("tires_per_mile", String(params.tires_per_mile));
        if (params.truck_payment_per_day != null) qs.set("truck_payment_per_day", String(params.truck_payment_per_day));
        if (params.insurance_per_day != null) qs.set("insurance_per_day", String(params.insurance_per_day));
        if (params.per_diem_per_day != null) qs.set("per_diem_per_day", String(params.per_diem_per_day));
      }
      return fetchApi<RoundTripSearchResult>(`routes/${companyId}/search-round-trip?${qs.toString()}`);
    },
    enabled: !!companyId && !!params,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
