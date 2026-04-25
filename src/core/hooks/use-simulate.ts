"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import type { RouteChain } from "@/core/types";

export function useSimulate(orderIds: string[], enabled: boolean) {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();

  const today = new Date().toISOString().slice(0, 10);
  const idsKey = orderIds.join(",");

  const canFetch =
    enabled &&
    orderIds.length === 2 &&
    !!activeCompanyId &&
    !!settings?.home_base_lat &&
    !!settings?.home_base_lng;

  return useQuery<RouteChain & { expenses_breakdown?: unknown }>({
    queryKey: ["simulate", activeCompanyId, idsKey],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("order_ids", idsKey);
      qs.set("origin_lat", String(settings!.home_base_lat));
      qs.set("origin_lng", String(settings!.home_base_lng));
      qs.set("departure_date", today);
      if (settings!.cost_per_mile != null) qs.set("cost_per_mile", String(settings!.cost_per_mile));
      if (settings!.max_driving_hours_per_day != null) qs.set("max_driving_hours_per_day", String(settings!.max_driving_hours_per_day));
      if (settings!.max_on_duty_hours_per_day != null) qs.set("max_on_duty_hours_per_day", String(settings!.max_on_duty_hours_per_day));
      if (settings!.earliest_on_duty_hour != null) qs.set("earliest_on_duty_hour", String(settings!.earliest_on_duty_hour));
      if (settings!.latest_on_duty_hour != null) qs.set("latest_on_duty_hour", String(settings!.latest_on_duty_hour));
      return fetchApi<RouteChain>(`routes/${activeCompanyId}/timeline?${qs.toString()}`);
    },
    enabled: canFetch,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });
}
