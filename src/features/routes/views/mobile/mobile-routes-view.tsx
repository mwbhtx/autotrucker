"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { useRouteSearch, type RouteSearchParams } from "@/core/hooks/use-routes";
import { useMobileRouteNav } from "@/features/routes/hooks/use-mobile-route-nav";
import { useSaveRecentSearch, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";
import { DEFAULT_COST_PER_MILE, DEFAULT_MAX_TRIP_DAYS } from "@mwbhtx/haulvisor-core";
import type { RouteChain } from "@/core/types";
import type { PlaceResult } from "@/features/routes/components/search-form";
import type { AdvancedFilters } from "./screens/filters-sheet";
import { HomeScreen } from "./screens/home-screen";
import { SearchSheet } from "./screens/search-sheet";
import { FiltersSheet } from "./screens/filters-sheet";
import { ResultsScreen } from "./screens/results-screen";
import { DetailScreen } from "./screens/detail-screen";

export function MobileRoutesView() {
  const { activeCompanyId, logout } = useAuth();
  const { data: settings } = useSettings();
  const { currentScreen, push, pop, goToResults } = useMobileRouteNav();
  const saveRecent = useSaveRecentSearch();

  // Search state
  const [origin, setOrigin] = useState<PlaceResult | null>(null);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    numOrders: 0,
    departureDate: tomorrow,
    daysOut: DEFAULT_MAX_TRIP_DAYS,
  });

  // Query params
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);

  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  // Build driver profile from settings (mirrors desktop search-form.tsx)
  const driverProfile = settings ? {
    trailer_types: settings.trailer_types?.length ? settings.trailer_types.join('|') : undefined,
    max_weight: settings.max_weight ?? undefined,
    hazmat_certified: settings.hazmat_certified ?? undefined,
    twic_card: settings.twic_card ?? undefined,
    team_driver: settings.team_driver ?? undefined,
    no_tarps: settings.no_tarps ?? undefined,
    max_assigned_orders: settings.max_assigned_orders ?? undefined,
    cost_per_mile: costPerMile,
  } : { cost_per_mile: costPerMile };

  // Fire query
  const routeQuery = useRouteSearch(activeCompanyId ?? "", searchParams);

  // Build chain list from results (sorting handled by ResultsScreen)
  const chains = useMemo(() => {
    return routeQuery.data?.routes ?? [];
  }, [routeQuery.data]);

  // Build search text for results screen (city, state only — drop country)
  const searchText = useMemo(() => {
    const short = (name: string) => name.split(",").slice(0, 2).map(s => s.trim()).join(", ");
    if (!origin) return "Search Routes";
    if (destination) return `${short(origin.name)} → ${short(destination.name)}`;
    return short(origin.name);
  }, [origin, destination]);

  // Build query params from current state
  const buildAndFireSearch = useCallback(
    (
      orig: PlaceResult,
      dest: PlaceResult | null,
      filters: AdvancedFilters,
    ) => {
      if (!activeCompanyId) return;

      const params: RouteSearchParams = {
        origin_lat: orig.lat,
        origin_lng: orig.lng,
        departure_date: filters.departureDate,
        ...(dest ? { destination_lat: dest.lat, destination_lng: dest.lng } : {}),
        max_trip_days: filters.daysOut,
        num_orders: filters.numOrders,
        ...driverProfile,
      };
      setSearchParams(params);
    },
    [activeCompanyId, driverProfile],
  );

  // Handlers

  const handleSearchBarTap = useCallback(() => {
    push({ type: "search" });
  }, [push]);

  const handleFiltersTap = useCallback(() => {
    push({ type: "filters" });
  }, [push]);

  const handleSearch = useCallback(
    (params: { origin: PlaceResult; destination: PlaceResult | null }) => {
      setOrigin(params.origin);
      setDestination(params.destination);

      // Save recent search
      saveRecent.mutate({
        origin: { label: params.origin.name, coordinates: [params.origin.lat, params.origin.lng] },
        destination: {
          label: params.destination?.name ?? params.origin.name,
          coordinates: params.destination
            ? [params.destination.lat, params.destination.lng]
            : [params.origin.lat, params.origin.lng],
        },
        filters: {},
      });

      buildAndFireSearch(params.origin, params.destination, advancedFilters);
      goToResults();
    },
    [advancedFilters, buildAndFireSearch, goToResults, saveRecent],
  );

  const handleRecentTap = useCallback(
    (search: RecentSearch) => {
      const orig: PlaceResult = { name: search.origin.label, lat: search.origin.coordinates[0], lng: search.origin.coordinates[1] };
      const dest: PlaceResult = { name: search.destination.label, lat: search.destination.coordinates[0], lng: search.destination.coordinates[1] };
      const filters: AdvancedFilters = {
        numOrders: 0,
        departureDate: tomorrow,
        daysOut: DEFAULT_MAX_TRIP_DAYS,
      };

      setOrigin(orig);
      setDestination(dest);
      setAdvancedFilters(filters);

      buildAndFireSearch(orig, dest, filters);
      goToResults();
    },
    [buildAndFireSearch, goToResults, tomorrow],
  );

  const handleFiltersApply = useCallback(
    (filters: AdvancedFilters) => {
      setAdvancedFilters(filters);
      // Re-run search if we have an active origin
      if (origin) {
        buildAndFireSearch(origin, destination, filters);
      }
      pop();
    },
    [origin, destination, buildAndFireSearch, pop],
  );

  const [selectedChain, setSelectedChain] = useState<RouteChain | null>(null);
  const handleRouteSelect = useCallback(
    (chain: RouteChain) => {
      setSelectedChain(chain);
      push({ type: "detail", routeIndex: 0 });
    },
    [push],
  );

  // No company assigned edge case
  if (!activeCompanyId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base text-muted-foreground">
          No company assigned to your account. Please contact your administrator.
        </p>
        <button
          onClick={logout}
          className="text-base text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Render based on current screen
  const detailChain = currentScreen.type === "detail" ? selectedChain : null;

  return (
    <div className="relative h-full">
      {/* Base screens (home or results) */}
      {currentScreen.type === "home" && (
        <HomeScreen
          onSearchBarTap={handleSearchBarTap}
          onFiltersTap={handleFiltersTap}
          onRecentTap={handleRecentTap}
        />
      )}

      {currentScreen.type === "results" && (
        <ResultsScreen
          searchText={searchText}
          chains={chains}
          isLoading={routeQuery.isLoading}
          onSearchBarTap={handleSearchBarTap}
          onFiltersTap={handleFiltersTap}
          onRouteSelect={handleRouteSelect}
        />
      )}

      {/* Overlay screens with animation */}
      <AnimatePresence>
        {currentScreen.type === "search" && (
          <SearchSheet
            key="search"
            onBack={pop}
            onSearch={handleSearch}
            initialOrigin={origin}
            initialDestination={destination}
            onRecentTap={handleRecentTap}
          />
        )}

        {currentScreen.type === "filters" && (
          <FiltersSheet
            key="filters"
            onBack={pop}
            onApply={handleFiltersApply}
            initialFilters={advancedFilters}
          />
        )}

        {currentScreen.type === "detail" && detailChain && (
          <DetailScreen
            key="detail"
            chain={detailChain}
            originCity={origin?.name ?? ""}
            onBack={pop}
            originCoords={origin ? { lat: origin.lat, lng: origin.lng } : null}
            destCoords={destination ? { lat: destination.lat, lng: destination.lng } : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
