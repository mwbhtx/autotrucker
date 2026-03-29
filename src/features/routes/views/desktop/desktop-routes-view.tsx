"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useOnborda } from "onborda";
import { RouteMap } from "@/features/routes/components/route-map";
import { SearchFilters } from "@/features/routes/components/search-form";
import { LocationSidebar } from "@/features/routes/views/desktop/location-sidebar";
import { useRouteSearch, useRoundTripSearch, type RouteSearchParams, type RoundTripSearchParams } from "@/core/hooks/use-routes";
import { useActiveOrderCount } from "@/core/hooks/use-orders";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { isDemoUser } from "@/core/services/auth";
import { groupRoutesByLocation } from "@/core/utils/group-by-location";
import type { LocationGroup } from "@/core/types";
import type { DrawableRouteLeg } from "@/core/utils/map/draw-route";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";

const EMPTY_LOCATION: LocationGroup = {
  city: "",
  state: "",
  lat: 0,
  lng: 0,
  orders: [],
  routeChains: [],
  roundTripChains: [],
};

export function DesktopRoutesView() {
  const { activeCompanyId } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);
  const [roundTripParams, setRoundTripParams] = useState<RoundTripSearchParams | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationGroup | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [originFilter, setOriginFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);
  const [destFilter, setDestFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);

  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">("round-trip");
  const [filterPending, setFilterPending] = useState(false);
  const hoverLegRef = useRef<((legIndex: number | null) => void) | null>(null);

  const { data, isLoading, isFetched } = useRouteSearch(activeCompanyId ?? "", searchParams);
  const routes = data?.routes ?? [];

  const { data: roundTripResults, isLoading: isRoundTripLoading, isFetched: isRoundTripFetched } = useRoundTripSearch(activeCompanyId ?? "", roundTripParams);

  const orderUrlTemplate = roundTripResults?.order_url_template ?? data?.order_url_template;

  // Lightweight count for the empty state display
  const { data: countData } = useActiveOrderCount(activeCompanyId ?? "");
  const orderCount = countData?.count ?? 0;

  const hasActiveSearch = searchParams !== null || roundTripParams !== null;
  const hasHomeBase = !settingsLoading && !!settings?.home_base_lat;

  // Start onboarding tour if no search is active and user hasn't completed it
  const { startOnborda, closeOnborda, isOnbordaVisible } = useOnborda();
  const tourStarted = useRef(false);
  // Reset tour guard when user changes (e.g. sign out → try demo again)
  useEffect(() => {
    tourStarted.current = false;
  }, [activeCompanyId]);

  useEffect(() => {
    if (tourStarted.current || isOnbordaVisible) return;
    if (settingsLoading) return;
    if (hasHomeBase && !isDemoUser()) return;
    if (hasActiveSearch) return;
    // Real users: check backend setting; demo users: check sessionStorage
    if (settings?.onboarding_completed) return;
    const dismissed = sessionStorage.getItem("hv-tour-dismissed");
    if (dismissed) return;
    tourStarted.current = true;
    const timer = setTimeout(() => startOnborda("routes-intro"), 500);
    return () => clearTimeout(timer);
  }, [settingsLoading, hasHomeBase, hasActiveSearch, startOnborda, isOnbordaVisible, settings?.onboarding_completed, activeCompanyId]);

  // Track whether any search has fired (distinguishes "initial load" from "user cleared search")
  const hasSearchedOnce = useRef(false);
  if (hasActiveSearch) hasSearchedOnce.current = true;

  // Check if filters are persisted and a search is expected to fire on restore
  const hasPersistedFilters = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem("hv-route-filters");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed.origin) return false;
      // Both modes only need origin to fire a search
      return true;
    } catch { return false; }
  }, []);

  // Ready gate: show nothing until we have what we need
  const ready = useMemo(() => {
    if (settingsLoading) return false;
    if (!hasActiveSearch) {
      // No search yet — ready unless home base will trigger an auto-search we haven't seen yet
      if (hasHomeBase && !hasSearchedOnce.current) return false;
      return true;
    }
    // Search active — ready once results have settled
    if (roundTripParams !== null && isRoundTripFetched) return true;
    if (searchParams !== null && isFetched) return true;
    return false;
  }, [settingsLoading, hasActiveSearch, hasHomeBase, roundTripParams, isRoundTripFetched, searchParams, isFetched]);

  const [selectedRouteLegs, setSelectedRouteLegs] = useState<DrawableRouteLeg[] | null>(null);

  // Derive the selected route for the map
  const selectedRoute = useMemo<{ legs: DrawableRouteLeg[] } | null>(() => {
    if (selectedRouteLegs) return { legs: selectedRouteLegs };
    if (!selectedLocation) return null;
    if (selectedLocation.roundTripChains.length > 0) {
      const chain = selectedLocation.roundTripChains[selectedItemIndex];
      return chain ? { legs: chain.legs } : null;
    }
    if (selectedLocation.routeChains.length > 0) {
      const chain = selectedLocation.routeChains[selectedItemIndex];
      return chain ? { legs: chain.legs } : null;
    }
    return null;
  }, [selectedLocation, selectedItemIndex, selectedRouteLegs]);

  // The location for the sidebar — either search results or empty
  const displayLocation = selectedLocation ?? EMPTY_LOCATION;

  const handleSearch = (p: RouteSearchParams) => {
    setFilterPending(false);
    setSearchParams(p);
    setRoundTripParams(null);
    setSelectedLocation(null);
    setSelectedItemIndex(0);
    setSelectedRouteLegs(null);
  };

  const handleSearchRoundTrip = (p: RoundTripSearchParams) => {
    setFilterPending(false);
    setRoundTripParams(p);
    setSearchParams(null);
    setSelectedLocation(null);
    setSelectedItemIndex(0);
    setSelectedRouteLegs(null);
  };

  const handleSearchCleared = () => {
    setSearchParams(null);
    setRoundTripParams(null);
    setSelectedLocation(null);
    setSelectedItemIndex(0);
    setSelectedRouteLegs(null);
    setOriginFilter(null);
    setDestFilter(null);
  };

  const handleClearSearch = () => {
    handleSearchCleared();
    setTripMode("round-trip");
    setFilterResetKey((k) => k + 1);
  };

  const handleSelectIndex = useCallback((index: number, legs?: DrawableRouteLeg[]) => {
    setSelectedItemIndex(index);
    if (legs) setSelectedRouteLegs(legs);
  }, []);

  // Populate sidebar when round-trip results arrive
  useEffect(() => {
    const homeRoutes = roundTripResults?.routes ?? [];
    if (homeRoutes.length === 0 || roundTripParams === null) return;
    const origin = roundTripResults!.origin;
    setSelectedLocation({
      city: origin.city,
      state: origin.state,
      lat: origin.lat,
      lng: origin.lng,
      orders: [],
      routeChains: [],
      roundTripChains: homeRoutes,
    });
    setSelectedItemIndex(0);
    setSelectedRouteLegs(homeRoutes[0]?.legs ?? null);
  }, [roundTripResults, roundTripParams]);

  // Populate sidebar when one-way results arrive
  useEffect(() => {
    if (routes.length === 0 || searchParams === null) return;
    const locations = groupRoutesByLocation(routes);
    if (locations.length === 0) return;
    const allRouteChains = locations.flatMap((l) => l.routeChains);
    setSelectedLocation({
      city: "Search Results",
      state: "",
      lat: locations[0].lat,
      lng: locations[0].lng,
      orders: [],
      routeChains: allRouteChains,
      roundTripChains: [],
    });
    setSelectedItemIndex(0);
    setSelectedRouteLegs(allRouteChains[0]?.legs ?? null);
  }, [routes, searchParams]);

  if (!activeCompanyId) {
    return (
      <div className="flex h-full items-center justify-center -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">No company assigned</p>
          <p className="text-sm text-muted-foreground/70">Contact your admin to get access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
      {/* Map fills entire area */}
      <RouteMap
        selectedRoute={ready ? selectedRoute : undefined}
        originCoords={originFilter}
        destCoords={destFilter}
        tripMode={tripMode}
        onHoverLegRef={hoverLegRef}
      />

      {/* Filter bar + results panel */}
      <div className="flex absolute top-4 left-4 right-4 bottom-4 z-10 flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-[#111111e8] border border-white/10 rounded-2xl p-3 w-full">
          <SearchFilters
            onSearch={handleSearch}
            onSearchRoundTrip={handleSearchRoundTrip}
            onClearSearch={handleSearchCleared}
            onTripModeChange={setTripMode}
            onOriginChange={setOriginFilter}
            onDestinationChange={setDestFilter}
            onFilterPending={() => setFilterPending(true)}
            isOnboarding={isOnbordaVisible}
            hasHome={hasHomeBase}
            resetKey={filterResetKey}
            initialTripType="round-trip"
          />
        </div>

        {hasActiveSearch && <div className="w-[48%] min-w-[380px] max-w-[780px] shrink-0 flex-1 min-h-0 pointer-events-auto">
          <LocationSidebar
            location={displayLocation}
            selectedIndex={selectedItemIndex}
            onSelectIndex={handleSelectIndex}
            onClose={() => {}}
            onClearFilters={hasActiveSearch ? handleClearSearch : undefined}
            maxWeight={settings?.max_weight ?? null}
            orderCount={orderCount}
            isLoading={!ready || isLoading || isRoundTripLoading || filterPending || (hasPersistedFilters && !hasActiveSearch && !hasSearchedOnce.current)}
            originFilter={originFilter}
            destFilter={destFilter}
            costPerMile={(settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE}
            orderUrlTemplate={orderUrlTemplate}
            onHoverLeg={(idx) => hoverLegRef.current?.(idx)}
          />
        </div>}
      </div>
    </div>
  );
}
