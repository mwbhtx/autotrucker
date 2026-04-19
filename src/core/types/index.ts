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

export interface AnalyticsLaneEntry {
  lane: string;
  period: string;
  count: number;
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

export interface AnalyticsTopCitiesEntry {
  city: string;
  state: string;
  avg_count: number;
}

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
