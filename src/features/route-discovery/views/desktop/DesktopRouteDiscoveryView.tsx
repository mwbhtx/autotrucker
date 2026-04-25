"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { FilterBar, type FilterBarValues } from "../../components/FilterBar";
import { RoutesList } from "../../components/RoutesList";
import { DrilldownPanel } from "../../components/DrilldownPanel";
import { EngineInspectors } from "../../components/EngineInspectors";
import { EmptyState } from "../../components/EmptyState";
import { useDiscoveredRoutes } from "../../hooks/use-routes";
import { useRouteDiscoveryStore } from "../../store";
import type { RoutesQuery } from "../../api";

export function DesktopRouteDiscoveryView() {
  const [query, setQuery] = useState<RoutesQuery | null>(null);
  const { data, isLoading, error } = useDiscoveredRoutes(query);
  const selectedRowIndex = useRouteDiscoveryStore((s) => s.selectedRowIndex);
  const resetSelection = useRouteDiscoveryStore((s) => s.resetSelection);

  // Reset selection when query changes
  useEffect(() => {
    resetSelection();
  }, [query, resetSelection]);

  const handleSearch = (values: FilterBarValues) => {
    setQuery({
      city: values.city,
      state: values.state,
      radius_miles: values.radius_miles,
      order_count: values.order_count,
    });
  };

  const rows = data?.rows ?? [];
  const selectedRoute = selectedRowIndex !== null ? rows[selectedRowIndex] ?? null : null;

  // Engine inspector queries
  const regionQuery = query
    ? { city: query.city, state: query.state, radius_miles: query.radius_miles }
    : null;

  // Default lane query: selected row's first order. Active-order changes
  // happen via the panel; for the inspector card we just show the first order
  // of the selected row as the default seed.
  const laneQuery =
    selectedRoute && selectedRoute.orders[0]
      ? {
          origin_lat: selectedRoute.orders[0].origin_anchor.lat,
          origin_lng: selectedRoute.orders[0].origin_anchor.lng,
          destination_lat: selectedRoute.orders[0].destination_anchor.lat,
          destination_lng: selectedRoute.orders[0].destination_anchor.lng,
          radius_miles: query?.radius_miles ?? 100,
        }
      : null;

  // Leg deadhead: only when there's at least 2 orders + drilldown context
  // (default to the gap between order 0 dest and order 1 origin).
  const legQuery =
    selectedRoute && selectedRoute.orders.length >= 2
      ? {
          drop_lat: selectedRoute.orders[0].destination_anchor.lat,
          drop_lng: selectedRoute.orders[0].destination_anchor.lng,
          pickup_lat: selectedRoute.orders[1].origin_anchor.lat,
          pickup_lng: selectedRoute.orders[1].origin_anchor.lng,
          radius_miles: query?.radius_miles ?? 100,
        }
      : null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-2xl font-semibold">Route Discovery</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recurring route patterns flowing through any city in your operating area, drawn from your historical orders.
        </p>
      </header>

      <FilterBar onSearch={handleSearch} />

      {error && (
        <div className="text-sm text-destructive">
          Failed to load routes. {(error as Error).message}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      )}

      {!isLoading && data && rows.length === 0 && query && (
        <EmptyState city={query.city} state={query.state} radiusMiles={query.radius_miles} />
      )}

      {!isLoading && data && rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <RoutesList routes={rows} />
          </div>
          <div className="lg:col-span-2">
            <DrilldownPanel route={selectedRoute} radiusMiles={query?.radius_miles ?? 100} />
          </div>
        </div>
      )}

      {query && (
        <EngineInspectors regionQuery={regionQuery} laneQuery={laneQuery} legQuery={legQuery} />
      )}

      {!query && (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Enter a location, radius, and order count above, then click Search.
        </p>
      )}
    </div>
  );
}
