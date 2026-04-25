"use client";

import { createContext, useContext, useMemo } from "react";
import { useSimulationStore } from "@/core/stores/simulation-store";
import { useRouteSearch } from "@/core/hooks/use-routes";
import { useSettings } from "@/core/hooks/use-settings";
import { useAuth } from "@/core/services/auth-provider";
import type { RouteChain } from "@/core/types";

const MS_PER_HOUR = 3_600_000;
const DEFAULT_EARLY_TOLERANCE_HOURS = 168;

function legFromChain(chain: RouteChain) {
  return chain.legs[0] ?? null;
}

interface SimulationSearchContextValue {
  col1: ReturnType<typeof useRouteSearch>;
  col2: ReturnType<typeof useRouteSearch>;
}

const SimulationSearchContext = createContext<SimulationSearchContextValue | null>(null);

export function SimulationSearchProvider({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();
  const { origin, destination, radius, departureDate, orderA } = useSimulationStore();

  const homeBaseLat = settings?.home_base_lat;
  const homeBaseLng = settings?.home_base_lng;
  const homeBaseName = [settings?.home_base_city, settings?.home_base_state].filter(Boolean).join(", ");

  const effectiveOrigin = origin ?? (
    homeBaseLat && homeBaseLng
      ? { lat: homeBaseLat, lng: homeBaseLng, name: homeBaseName }
      : null
  );

  const earlyToleranceHours = settings?.early_tolerance_hours ?? DEFAULT_EARLY_TOLERANCE_HOURS;

  const col1Params = useMemo(() => {
    if (!effectiveOrigin) return null;
    return {
      origin_lat: effectiveOrigin.lat,
      origin_lng: effectiveOrigin.lng,
      departure_date: departureDate,
      search_radius_miles: radius,
      origin_radius_miles: radius,
      num_orders: 1 as const,
      candidates_only: true,
    };
  }, [effectiveOrigin?.lat, effectiveOrigin?.lng, departureDate, radius]);

  const col2Params = useMemo(() => {
    const aLeg = orderA ? legFromChain(orderA) : null;
    if (!aLeg) return null;
    const aDeliveryEarlyMs = aLeg.delivery_date_early_utc
      ? new Date(aLeg.delivery_date_early_utc).getTime()
      : null;
    const minPickupLateUtc = aDeliveryEarlyMs != null
      ? aDeliveryEarlyMs - earlyToleranceHours * MS_PER_HOUR
      : undefined;
    return {
      origin_lat: aLeg.destination_lat,
      origin_lng: aLeg.destination_lng,
      departure_date: departureDate,
      search_radius_miles: radius,
      origin_radius_miles: radius,
      num_orders: 1 as const,
      min_pickup_late_utc: minPickupLateUtc,
      candidates_only: true,
      ...(destination ? {
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        dest_radius_miles: radius,
      } : {}),
    };
  }, [orderA, radius, departureDate, earlyToleranceHours, destination]);

  const col1 = useRouteSearch(activeCompanyId ?? "", col1Params);
  const col2 = useRouteSearch(activeCompanyId ?? "", col2Params);

  const value = useMemo(() => ({ col1, col2 }), [col1, col2]);

  return (
    <SimulationSearchContext.Provider value={value}>
      {children}
    </SimulationSearchContext.Provider>
  );
}

export function useSimulationSearchContext(): SimulationSearchContextValue {
  const ctx = useContext(SimulationSearchContext);
  if (!ctx) throw new Error("useSimulationSearchContext must be used within SimulationSearchProvider");
  return ctx;
}
