import { fetchApi } from "@/core/services/api";
import type {
  RouteDiscoveryResult,
  RegionInspectorResult,
  LaneDensityResult,
  LegDeadheadResult,
} from "@/core/types";

export interface RoutesQuery {
  city: string;
  state: string;
  radius_miles: number;
  order_count: 2 | 3 | 4;
}

export async function fetchDiscoveredRoutes(
  companyId: string,
  q: RoutesQuery,
): Promise<RouteDiscoveryResult> {
  const params = new URLSearchParams({
    city: q.city,
    state: q.state,
    radius_miles: q.radius_miles.toString(),
    order_count: q.order_count.toString(),
  });
  return fetchApi<RouteDiscoveryResult>(
    `/analytics/route-discovery/${encodeURIComponent(companyId)}/routes?${params.toString()}`,
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
