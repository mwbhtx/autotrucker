"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import type { RouteChain } from "@/core/types";

export interface SimulateLocation {
  lat: number;
  lng: number;
  city?: string;
}

/**
 * The /timeline endpoint now returns either a full evaluated chain
 * (success) or a structured rejection shape so the UI can explain *why*
 * a user-pinned chain failed (window violation, envelope, on-duty cap).
 */
export type SimulateRejection = {
  feasible: false;
  reason: 'WINDOW_VIOLATION' | 'ENVELOPE_VIOLATION_END' | 'ON_DUTY_CAP_EXCEEDED' | 'UNKNOWN';
  violations: Array<{
    leg_index: number;
    window: 'pickup' | 'delivery';
    hours_late: number;
    city: string;
  }>;
};

export type SimulateResult = (RouteChain & { expenses_breakdown?: unknown }) | SimulateRejection;

export function isSimulateRejection(r: SimulateResult | undefined): r is SimulateRejection {
  return !!r && (r as SimulateRejection).feasible === false;
}

export function useSimulate(
  orderIds: string[],
  enabled: boolean,
  origin?: SimulateLocation,
  destination?: SimulateLocation,
  departureDate?: string,
) {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();

  const idsKey = orderIds.join(",");

  const originLat = origin?.lat ?? settings?.home_base_lat;
  const originLng = origin?.lng ?? settings?.home_base_lng;

  const effectiveDepartureDate = departureDate ?? new Date().toISOString().slice(0, 10);

  const canFetch =
    enabled &&
    orderIds.length === 2 &&
    !!activeCompanyId &&
    !!settings &&
    !!originLat &&
    !!originLng;

  return useQuery<SimulateResult>({
    queryKey: [
      "simulate",
      activeCompanyId,
      idsKey,
      originLat,
      originLng,
      destination?.lat,
      destination?.lng,
      effectiveDepartureDate,
    ],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("order_ids", idsKey);
      qs.set("origin_lat", String(originLat));
      qs.set("origin_lng", String(originLng));
      qs.set("departure_date", effectiveDepartureDate);
      if (destination) {
        qs.set("destination_lat", String(destination.lat));
        qs.set("destination_lng", String(destination.lng));
        if (destination.city) qs.set("destination_city", destination.city);
      }
      if (settings?.cost_per_mile != null) qs.set("cost_per_mile", String(settings.cost_per_mile));
      if (settings?.max_driving_hours_per_day != null) qs.set("max_driving_hours_per_day", String(settings.max_driving_hours_per_day));
      if (settings?.max_on_duty_hours_per_day != null) qs.set("max_on_duty_hours_per_day", String(settings.max_on_duty_hours_per_day));
      if (settings?.earliest_on_duty_hour != null) qs.set("earliest_on_duty_hour", String(settings.earliest_on_duty_hour));
      if (settings?.latest_on_duty_hour != null) qs.set("latest_on_duty_hour", String(settings.latest_on_duty_hour));
      return fetchApi<SimulateResult>(`routes/${activeCompanyId}/timeline?${qs.toString()}`);
    },
    enabled: canFetch,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });
}
