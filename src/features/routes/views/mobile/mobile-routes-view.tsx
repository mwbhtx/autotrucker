"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { useRouteSearch, useRoundTripSearch, type RouteSearchParams, type RoundTripSearchParams } from "@/core/hooks/use-routes";
import { useMobileRouteNav } from "@/features/routes/hooks/use-mobile-route-nav";
import { useSaveRecentSearch, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";
import type { PlaceResult } from "@/features/routes/components/search-form";
import type { AdvancedFilters } from "./screens/filters-sheet";
import { HomeScreen } from "./screens/home-screen";
import { SearchSheet } from "./screens/search-sheet";
import { FiltersSheet } from "./screens/filters-sheet";
import { ResultsScreen } from "./screens/results-screen";
import { DetailScreen } from "./screens/detail-screen";

export function MobileRoutesView() {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();
  const { currentScreen, push, pop, goToResults } = useMobileRouteNav();
  const saveRecent = useSaveRecentSearch();

  // Search state
  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">("round-trip");
  const [origin, setOrigin] = useState<PlaceResult | null>(null);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    legs: 3,
    maxDeadheadPct: 30,
    maxIdleHours: 48,
    homeBy: "",
    trailerType: "",
  });

  // Query params
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);
  const [roundTripParams, setRoundTripParams] = useState<RoundTripSearchParams | null>(null);

  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  // Fire queries
  const oneWayQuery = useRouteSearch(activeCompanyId ?? "", searchParams);
  const roundTripQuery = useRoundTripSearch(activeCompanyId ?? "", roundTripParams);

  const isRoundTrip = tripMode === "round-trip";
  const activeQuery = isRoundTrip ? roundTripQuery : oneWayQuery;

  // Build chain list from results
  const chains = useMemo(() => {
    if (isRoundTrip && roundTripQuery.data) {
      return roundTripQuery.data.routes ?? [];
    }
    if (!isRoundTrip && oneWayQuery.data) {
      return oneWayQuery.data.routes ?? [];
    }
    return [];
  }, [isRoundTrip, roundTripQuery.data, oneWayQuery.data]);

  // Build search text for results screen
  const searchText = useMemo(() => {
    if (!origin) return "Search Routes";
    if (destination) return `${origin.name} → ${destination.name}`;
    return origin.name;
  }, [origin, destination]);

  // Build query params from current state
  const buildAndFireSearch = useCallback(
    (
      mode: "one-way" | "round-trip",
      orig: PlaceResult,
      dest: PlaceResult | null,
      filters: AdvancedFilters,
    ) => {
      if (!activeCompanyId) return;

      if (mode === "round-trip") {
        const params: RoundTripSearchParams = {
          origin_lat: orig.lat,
          origin_lng: orig.lng,
          origin_city: orig.name,
          legs: filters.legs,
          max_deadhead_pct: filters.maxDeadheadPct,
          max_layover_hours: filters.maxIdleHours,
          home_by: filters.homeBy || undefined,
          trailer_types: filters.trailerType || undefined,
          cost_per_mile: costPerMile,
        };
        setRoundTripParams(params);
        setSearchParams(null);
      } else {
        const params: RouteSearchParams = {
          origin_lat: orig.lat,
          origin_lng: orig.lng,
          dest_lat: dest?.lat,
          dest_lng: dest?.lng,
          legs: filters.legs,
          cost_per_mile: costPerMile,
          trailer_types: filters.trailerType || undefined,
          max_layover_hours: filters.maxIdleHours,
        };
        setSearchParams(params);
        setRoundTripParams(null);
      }
    },
    [activeCompanyId, costPerMile],
  );

  // Handlers

  const handleSearchBarTap = useCallback(() => {
    push({ type: "search" });
  }, [push]);

  const handleFiltersTap = useCallback(() => {
    push({ type: "filters" });
  }, [push]);

  const handleSearch = useCallback(
    (params: { tripMode: "one-way" | "round-trip"; origin: PlaceResult; destination: PlaceResult | null }) => {
      setTripMode(params.tripMode);
      setOrigin(params.origin);
      setDestination(params.destination);

      // Save recent search
      saveRecent.mutate({
        tripMode: params.tripMode === "round-trip" ? "round_trip" : "one_way",
        origin: { label: params.origin.name, coordinates: [params.origin.lat, params.origin.lng] },
        destination: {
          label: params.destination?.name ?? params.origin.name,
          coordinates: params.destination
            ? [params.destination.lat, params.destination.lng]
            : [params.origin.lat, params.origin.lng],
        },
        filters: {
          trailerType: advancedFilters.trailerType || undefined,
          maxIdle: advancedFilters.maxIdleHours,
          deadheadPercent: advancedFilters.maxDeadheadPct,
          homeBy: advancedFilters.homeBy || undefined,
          legs: advancedFilters.legs,
        },
      });

      buildAndFireSearch(params.tripMode, params.origin, params.destination, advancedFilters);
      goToResults();
    },
    [advancedFilters, buildAndFireSearch, goToResults, saveRecent],
  );

  const handleRecentTap = useCallback(
    (search: RecentSearch) => {
      const mode: "one-way" | "round-trip" = search.tripMode === "round_trip" ? "round-trip" : "one-way";
      const orig: PlaceResult = { name: search.origin.label, lat: search.origin.coordinates[0], lng: search.origin.coordinates[1] };
      const dest: PlaceResult = { name: search.destination.label, lat: search.destination.coordinates[0], lng: search.destination.coordinates[1] };
      const filters: AdvancedFilters = {
        legs: search.filters.legs ?? 3,
        maxDeadheadPct: search.filters.deadheadPercent ?? 30,
        maxIdleHours: search.filters.maxIdle ?? 48,
        homeBy: search.filters.homeBy ?? "",
        trailerType: search.filters.trailerType ?? "",
      };

      setTripMode(mode);
      setOrigin(orig);
      setDestination(dest);
      setAdvancedFilters(filters);

      buildAndFireSearch(mode, orig, dest, filters);
      goToResults();
    },
    [buildAndFireSearch, goToResults],
  );

  const handleFiltersApply = useCallback(
    (filters: AdvancedFilters) => {
      setAdvancedFilters(filters);
      // Re-run search if we have an active origin
      if (origin) {
        buildAndFireSearch(tripMode, origin, destination, filters);
      }
      pop();
    },
    [origin, destination, tripMode, buildAndFireSearch, pop],
  );

  const handleRouteSelect = useCallback(
    (index: number) => {
      push({ type: "detail", routeIndex: index });
    },
    [push],
  );

  // No company assigned edge case
  if (!activeCompanyId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No company assigned to your account. Please contact your administrator.
        </p>
      </div>
    );
  }

  // Render based on current screen
  const detailRouteIndex = currentScreen.type === "detail" ? currentScreen.routeIndex : 0;
  const detailChain = chains[detailRouteIndex] ?? null;

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
          isRoundTrip={isRoundTrip}
          isLoading={activeQuery.isLoading}
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
            initialTripMode={tripMode}
            initialOrigin={origin}
            initialDestination={destination}
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
            isRoundTrip={isRoundTrip}
            originCity={origin?.name ?? ""}
            onBack={pop}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
