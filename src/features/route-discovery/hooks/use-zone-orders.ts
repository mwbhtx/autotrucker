"use client";

import { useQuery } from "@tanstack/react-query";
import { haversine } from "@mwbhtx/haulvisor-core";
import { useAuth } from "@/core/services/auth-provider";
import { fetchApi } from "@/core/services/api";
import type { Order, PaginatedOrders } from "@/core/types";
import type { FreightZoneSummary } from "@mwbhtx/haulvisor-core";

export type ZoneOrder = Order;

export function useZoneOrders(
  zone: FreightZoneSummary | null,
  radiusMiles: number,
) {
  const { activeCompanyId } = useAuth();

  return useQuery<ZoneOrder[]>({
    queryKey: ['route-discovery', 'zone-orders', activeCompanyId, zone?.zone_key, radiusMiles],
    queryFn: async () => {
      const params = new URLSearchParams({
        origin_state: zone!.display_state,
        limit: '500',
      });
      const data = await fetchApi<PaginatedOrders>(
        `orders/${activeCompanyId}?${params.toString()}`,
      );
      return data.items
        .filter((o) => {
          if (!o.origin_lat || !o.origin_lng) return true;
          return haversine(zone!.centroid_lat, zone!.centroid_lng, o.origin_lat, o.origin_lng) <= radiusMiles;
        })
        .sort((a, b) => b.rate_per_mile - a.rate_per_mile);
    },
    enabled: !!activeCompanyId && !!zone,
    staleTime: 60_000,
  });
}
