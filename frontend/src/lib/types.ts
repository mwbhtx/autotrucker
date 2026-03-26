// Re-export shared types as the single source of truth
export type { Order, Stopoff, PaginatedOrders } from "@mwbhtx/haulvisor-types";
export type { RouteLeg, RouteChain, RouteSearchResult } from "@mwbhtx/haulvisor-types";
export type { RoundTripChain, RoundTripLeg, RoundTripSearchResult } from "@mwbhtx/haulvisor-types";
export type { RouteCostBreakdown } from "@mwbhtx/haulvisor-types";

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
  orders: import("@mwbhtx/haulvisor-types").Order[];
  routeChains: import("@mwbhtx/haulvisor-types").RouteChain[];
  roundTripChains: import("@mwbhtx/haulvisor-types").RoundTripChain[];
}

export interface OrderFilters {
  origin_state?: string;
  destination_state?: string;
  trailer_type?: string;
  min_pay?: number;
  limit?: number;
  last_key?: string;
}
