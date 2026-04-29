import { fetchApi } from "@/core/services/api";
import type { FreightNetworkMapResponse, ZoneDetailResponse } from "@/core/types";

export async function fetchFreightNetwork(
  companyId: string,
  period: '30d' | '60d' | '90d',
  zoneRadius: 100 | 200 | 300 = 100,
): Promise<FreightNetworkMapResponse> {
  return fetchApi<FreightNetworkMapResponse>(
    `/analytics/${encodeURIComponent(companyId)}/freight-network-map?period=${period}&zone_radius=${zoneRadius}`,
  );
}

export async function fetchZoneDetail(
  companyId: string,
  zoneKey: string,
  period: '30d' | '60d' | '90d',
): Promise<ZoneDetailResponse> {
  return fetchApi<ZoneDetailResponse>(
    `/analytics/${encodeURIComponent(companyId)}/freight-network-map/zone/${encodeURIComponent(zoneKey)}?period=${period}`,
  );
}
