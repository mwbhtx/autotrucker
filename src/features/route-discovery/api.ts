import { fetchApi } from "@/core/services/api";
import type {
  RouteDiscoveryResult,
  RegionInspectorResult,
  LaneDensityResult,
  LegDeadheadResult,
  FreightNetworkMapResponse,
} from "@/core/types";

export interface RoutesQuery {
  city: string;
  state: string;
  radius_miles: number;
}

export async function fetchDiscoveredRoutes(
  companyId: string,
  q: RoutesQuery,
): Promise<RouteDiscoveryResult> {
  const params = new URLSearchParams({
    city: q.city,
    state: q.state,
    radius_miles: q.radius_miles.toString(),
  });
  return fetchApi<RouteDiscoveryResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/routes?${params.toString()}`,
  );
}

export async function fetchTopRoutes(
  companyId: string,
): Promise<RouteDiscoveryResult> {
  return fetchApi<RouteDiscoveryResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/top-routes`,
  );
}

export async function fetchRegionInspector(
  companyId: string,
  q: { city: string; state: string; radius_miles: number },
): Promise<RegionInspectorResult> {
  const params = new URLSearchParams({
    city: q.city,
    state: q.state,
    radius_miles: q.radius_miles.toString(),
  });
  return fetchApi<RegionInspectorResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/region?${params.toString()}`,
  );
}

export async function fetchLaneDensity(
  companyId: string,
  q: {
    origin_lat: number;
    origin_lng: number;
    destination_lat: number;
    destination_lng: number;
    radius_miles: number;
  },
): Promise<LaneDensityResult> {
  const params = new URLSearchParams({
    origin_lat: q.origin_lat.toString(),
    origin_lng: q.origin_lng.toString(),
    destination_lat: q.destination_lat.toString(),
    destination_lng: q.destination_lng.toString(),
    radius_miles: q.radius_miles.toString(),
  });
  return fetchApi<LaneDensityResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/lane-density?${params.toString()}`,
  );
}

export async function fetchLegDeadhead(
  companyId: string,
  q: {
    drop_lat: number;
    drop_lng: number;
    pickup_lat: number;
    pickup_lng: number;
    radius_miles: number;
  },
): Promise<LegDeadheadResult> {
  const params = new URLSearchParams({
    drop_lat: q.drop_lat.toString(),
    drop_lng: q.drop_lng.toString(),
    pickup_lat: q.pickup_lat.toString(),
    pickup_lng: q.pickup_lng.toString(),
    radius_miles: q.radius_miles.toString(),
  });
  return fetchApi<LegDeadheadResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/leg-deadhead?${params.toString()}`,
  );
}

export async function fetchFreightNetwork(
  companyId: string,
  period: '30d' | '60d' | '90d',
  zoneRadius: 100 | 200 | 300 | 400 = 100,
): Promise<FreightNetworkMapResponse> {
  return fetchApi<FreightNetworkMapResponse>(
    `/analytics/${encodeURIComponent(companyId)}/freight-network-map?period=${period}&zone_radius=${zoneRadius}`,
  );
}
