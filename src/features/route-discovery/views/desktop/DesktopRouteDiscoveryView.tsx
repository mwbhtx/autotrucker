"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/platform/web/components/ui/tabs";
import { FilterBar, type FilterBarValues } from "../../components/FilterBar";
import { RoutesList } from "../../components/RoutesList";
import { DrilldownPanel } from "../../components/DrilldownPanel";
import { EngineInspectors } from "../../components/EngineInspectors";
import { EmptyState } from "../../components/EmptyState";
import { HowItWorks } from "../../components/HowItWorks";
import { FreightNetworkMap } from "../../components/FreightNetworkMap";
import { useDiscoveredRoutes } from "../../hooks/use-routes";
import { useFreightNetwork } from "../../hooks/use-freight-network";
import { useRouteDiscoveryStore } from "../../store";
import type { RoutesQuery } from "../../api";

type TabId = "map" | "search";
type PeriodId = "30d" | "60d" | "90d";
type ZoneRadius = 100 | 200 | 300;

export function DesktopRouteDiscoveryView() {
  const [tab, setTab] = useState<TabId>("map");
  const [period, setPeriod] = useState<PeriodId>("90d");
  const [zoneRadius, setZoneRadius] = useState<ZoneRadius>(200);
  const [query, setQuery] = useState<RoutesQuery | null>(null);

  const { data: networkData, isLoading: networkLoading } = useFreightNetwork(period, zoneRadius);
  const { data, isLoading, error } = useDiscoveredRoutes(query);
  const selectedRowIndex = useRouteDiscoveryStore((s) => s.selectedRowIndex);
  const resetSelection = useRouteDiscoveryStore((s) => s.resetSelection);

  const searchRows = data?.rows ?? [];
  const selectedRoute = selectedRowIndex !== null ? searchRows[selectedRowIndex] ?? null : null;

  const handleTabChange = (value: string) => {
    resetSelection();
    setTab(value as TabId);
  };

  useEffect(() => {
    resetSelection();
  }, [query, resetSelection]);

  const handleSearch = (values: FilterBarValues) => {
    setQuery({ city: values.city, state: values.state, radius_miles: values.radius_miles });
  };

  const regionQuery = query
    ? { city: query.city, state: query.state, radius_miles: query.radius_miles }
    : null;

  const laneQuery =
    selectedRoute?.orders[0]
      ? {
          origin_lat: selectedRoute.orders[0].origin_anchor.lat,
          origin_lng: selectedRoute.orders[0].origin_anchor.lng,
          destination_lat: selectedRoute.orders[0].destination_anchor.lat,
          destination_lng: selectedRoute.orders[0].destination_anchor.lng,
          radius_miles: query?.radius_miles ?? 100,
        }
      : null;

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
    <div className={tab === "map" ? "py-4 space-y-4" : "container mx-auto py-6 space-y-6 max-w-7xl"}>
      <header>
        <h1 className="text-2xl font-semibold">Route Discovery</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recurring route patterns flowing through any city in your operating area, drawn from your historical orders.
        </p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange}>
        {/* Tab triggers + period toggle share the same row */}
        <div className="flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          {tab === "map" && (
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(["30d", "60d", "90d"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                      period === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Zone</span>
                {([100, 200, 300] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setZoneRadius(r)}
                    className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                      zoneRadius === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Map tab ── */}
        <TabsContent value="map" className="mt-4">
          {networkLoading && (
            <Skeleton className="h-[calc(100vh-22rem)] min-h-[400px] w-full rounded-lg" />
          )}

          {!networkLoading && networkData && (
            <FreightNetworkMap data={networkData} period={period} />
          )}
        </TabsContent>

        {/* ── Search tab ── */}
        <TabsContent value="search" className="mt-6 space-y-6">
          <HowItWorks />

          <p className="text-sm text-muted-foreground">
            Enter a location and radius, then click Search to find routes in a specific area.
          </p>

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

          {!isLoading && data && searchRows.length === 0 && query && (
            <EmptyState city={query.city} state={query.state} radiusMiles={query.radius_miles} />
          )}

          {!isLoading && data && searchRows.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <RoutesList routes={searchRows} />
              </div>
              <div className="lg:col-span-2">
                <div key={selectedRoute?.route_id ?? "empty"} className="animate-in slide-in-from-right-4 duration-200">
                  <DrilldownPanel route={selectedRoute} radiusMiles={query?.radius_miles ?? 100} />
                </div>
              </div>
            </div>
          )}

          {query && (
            <EngineInspectors regionQuery={regionQuery} laneQuery={laneQuery} legQuery={legQuery} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
