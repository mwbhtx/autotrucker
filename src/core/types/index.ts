// Re-export shared types as the single source of truth
export type { Order, Stopoff, PaginatedOrders } from "@mwbhtx/haulvisor-core";
export type { RouteLeg, RouteChain, RouteSearchResult } from "@mwbhtx/haulvisor-core";
export type { RouteCostBreakdown } from "@mwbhtx/haulvisor-core";
export type { TripPhase, TripPhaseKind, TripSimulationSummary } from "@mwbhtx/haulvisor-core";
export { TRIP_DEFAULTS } from "@mwbhtx/haulvisor-core";
export type { RouteSortKey } from "@mwbhtx/haulvisor-core";

// Analytics types (new API)
export interface AnalyticsStats {
  total_open: number;
  orders_added: number;
  orders_removed: number;
  avg_pay: number;
  median_pay: number;
  avg_rate_per_mile: number;
  avg_miles: number;
}

export interface AnalyticsHistoryEntry {
  period: string;
  active_orders: number;
  added: number;
  removed: number;
  avg_rate_per_mile: number;
  avg_pay: number;
}

export interface AnalyticsChurnEntry {
  period: string;
  closed_count: number;
  active_at_start: number;
  churn_rate: number;
}

export interface AnalyticsBreakdownEntry {
  key: string;
  count: number;
}

export interface AnalyticsAvailabilityEntry {
  period: string;
  avg_hours: number;
  median_hours: number;
  closed_count: number;
}

export type AnalyticsSide = 'origin' | 'destination';
export type AnalyticsLaneGranularity = 'city' | 'state' | 'region';
export type AnalyticsTopPlacesSort = 'loads_per_day' | 'rate_per_mile' | 'entropy_h';
export type AnalyticsTopLanesSort = 'loads_per_day' | 'rate_per_mile' | 'median_pay';

export interface AnalyticsTopCityEntry {
  city: string;
  state: string;
  load_count: number;
  loads_per_day: number;
  median_rate_per_mile: number | null;
  entropy_h: number;
}

export interface AnalyticsTopStateEntry {
  state: string;
  load_count: number;
  loads_per_day: number;
  median_rate_per_mile: number | null;
  entropy_h: number;
}

export interface AnalyticsTopLaneEntry {
  origin_city: string | null;
  origin_state: string;
  destination_city: string | null;
  destination_state: string;
  origin_label: string;
  destination_label: string;
  load_count: number;
  loads_per_day: number;
  median_rate_per_mile: number | null;
  median_pay: number | null;
}

export interface AnalyticsTopRegionEntry {
  cell_lat: number;
  cell_lng: number;
  display_city: string;
  display_state: string;
  load_count: number;
  loads_per_day: number;
  median_rate_per_mile: number | null;
  entropy_h: number;
}

export interface AnalyticsTopRegionLaneEntry {
  origin_cell_lat: number;
  origin_cell_lng: number;
  origin_display_city: string;
  origin_display_state: string;
  destination_cell_lat: number;
  destination_cell_lng: number;
  destination_display_city: string;
  destination_display_state: string;
  origin_label: string;
  destination_label: string;
  load_count: number;
  loads_per_day: number;
  median_rate_per_mile: number | null;
  median_pay: number | null;
}

export type {
  DiscoveredRoute,
  DiscoveredOrder,
  RouteDiscoveryResult,
  RegionInspectorResult,
  LaneDensityResult,
  LegDeadheadResult,
  RegionAnchor,
  LaneDensityDay,
  FreightNetworkMapResponse,
  ZoneDetailResponse,
  ZoneDetailLane,
} from "@mwbhtx/haulvisor-core";

// Frontend-only types (not shared with backend)

export interface LocationGroup {
  city: string;
  state: string;
  lat: number;
  lng: number;
  orders: import("@mwbhtx/haulvisor-core").Order[];
  routeChains: import("@mwbhtx/haulvisor-core").RouteChain[];
}

export interface OrderFilters {
  origin_state?: string;
  destination_state?: string;
  trailer_type?: string;
  min_pay?: number;
  limit?: number;
  offset?: number;
}
