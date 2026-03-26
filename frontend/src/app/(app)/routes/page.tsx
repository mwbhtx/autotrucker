"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { SlidersHorizontal, ArrowUpDown, XIcon, ChevronUpIcon } from "lucide-react";
import { RouteMap } from "@/components/map/route-map";
import { SearchFilters } from "@/components/map/search-form";
import { LocationSidebar } from "@/components/map/location-sidebar";
import { MobileCarousel, SORT_OPTIONS, type SortKey } from "@/components/map/mobile-carousel";
import { MobileFilterSheet } from "@/components/map/search-form";
import { useRouteSearch, useRoundTripSearch, type RouteSearchParams, type RoundTripSearchParams } from "@/lib/hooks/use-routes";
import { useActiveOrderCount } from "@/lib/hooks/use-orders";
import { useAuth } from "@/components/auth-provider";
import { useSettings } from "@/lib/hooks/use-settings";
import { groupRoutesByLocation } from "@/lib/group-by-location";
import type { LocationGroup } from "@/lib/types";
import type { DrawableRouteLeg } from "@/lib/map/draw-route";

const EMPTY_LOCATION: LocationGroup = {
  city: "",
  state: "",
  lat: 0,
  lng: 0,
  orders: [],
  routeChains: [],
  roundTripChains: [],
};

export default function MapPage() {
  const { activeCompanyId } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);
  const [roundTripParams, setRoundTripParams] = useState<RoundTripSearchParams | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationGroup | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [originFilter, setOriginFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);
  const [destFilter, setDestFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [mobileSortBy, setMobileSortBy] = useState<SortKey>("score");
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">("round-trip");

  const { data, isLoading, isFetched } = useRouteSearch(activeCompanyId ?? "", searchParams);
  const routes = data?.routes ?? [];

  const { data: roundTripResults, isLoading: isRoundTripLoading, isFetched: isRoundTripFetched } = useRoundTripSearch(activeCompanyId ?? "", roundTripParams);

  const orderUrlTemplate = roundTripResults?.order_url_template ?? data?.order_url_template;

  // Lightweight count for the empty state display
  const { data: countData } = useActiveOrderCount(activeCompanyId ?? "");
  const orderCount = countData?.count ?? 0;

  const hasActiveSearch = searchParams !== null || roundTripParams !== null;
  const hasHomeBase = !settingsLoading && !!settings?.home_base_lat;

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
    setSearchParams(p);
    setRoundTripParams(null);
    setSelectedLocation(null);
    setSelectedItemIndex(0);
    setSelectedRouteLegs(null);
  };

  const handleSearchRoundTrip = (p: RoundTripSearchParams) => {
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

  const hasCards = ready && (displayLocation.routeChains.length > 0 || displayLocation.roundTripChains.length > 0);

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
    <>
    {/* Filter sheet rendered outside overflow-hidden container */}
    <MobileFilterSheet
      open={mobileFilterOpen}
      onOpenChange={setMobileFilterOpen}
      onSearch={handleSearch}
      onSearchRoundTrip={handleSearchRoundTrip}
      onClearSearch={handleSearchCleared}
      onTripModeChange={setTripMode}
      onOriginChange={setOriginFilter}
      onDestinationChange={setDestFilter}
      hasHome={hasHomeBase}
      resetKey={filterResetKey}
      initialTripType="round-trip"
    />
    <div className="relative overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
      {/* Map fills entire area — desktop only */}
      {!isMobile && (
        <RouteMap
          selectedRoute={ready ? selectedRoute : undefined}
          originCoords={originFilter}
          destCoords={destFilter}
          tripMode={tripMode}
        />
      )}

      {/* Desktop: Filter bar + results panel */}
      <div className="hidden md:flex absolute top-4 left-4 right-4 bottom-4 z-10 flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-black/80 border border-white/10 rounded-2xl p-3 w-full">
          <SearchFilters
            onSearch={handleSearch}
            onSearchRoundTrip={handleSearchRoundTrip}
            onClearSearch={handleSearchCleared}
            onTripModeChange={setTripMode}
            onOriginChange={setOriginFilter}
            onDestinationChange={setDestFilter}
            hasHome={hasHomeBase}
            resetKey={filterResetKey}
            initialTripType="round-trip"
          />
        </div>

        {hasActiveSearch && <div className="w-[40%] min-w-[320px] max-w-[672px] shrink-0 flex-1 min-h-0 pointer-events-auto">
          <LocationSidebar
            location={displayLocation}
            selectedIndex={selectedItemIndex}
            onSelectIndex={handleSelectIndex}
            onClose={() => {}}
            onClearFilters={hasActiveSearch ? handleClearSearch : undefined}
            maxWeight={settings?.max_weight ?? null}
            orderCount={orderCount}
            isLoading={!ready || isLoading || isRoundTripLoading || (hasPersistedFilters && !hasActiveSearch && !hasSearchedOnce.current)}
            originFilter={originFilter}
            destFilter={destFilter}
            costPerMile={(settings?.cost_per_mile as number | undefined) ?? 1.5}
            orderUrlTemplate={orderUrlTemplate}
          />
        </div>}
      </div>

      {/* Mobile: persistent compact search bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 z-20 pointer-events-auto bg-black/60 backdrop-blur-md border-b border-white/10 px-2 py-1.5">
        <SearchFilters
          compactBar
          onSearch={handleSearch}
          onSearchRoundTrip={handleSearchRoundTrip}
          onClearSearch={handleSearchCleared}
          onTripModeChange={setTripMode}
          onOriginChange={setOriginFilter}
          onDestinationChange={setDestFilter}
          hasHome={hasHomeBase}
          resetKey={filterResetKey}
          initialTripType="round-trip"
        >
          {/* Sort + filter + clear icons injected into row 2 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileSortOpen(!mobileSortOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] border border-white/10"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
            {mobileSortOpen && (
              <div className="absolute top-11 left-0 bg-card border border-border/50 rounded-xl shadow-lg p-2 min-w-[120px] z-50">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { setMobileSortBy(opt.key); setMobileSortOpen(false); setSelectedItemIndex(0); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      mobileSortBy === opt.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] border border-white/10"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </SearchFilters>
      </div>

      {/* Mobile: carousel panel (no solid background — cards float individually) */}
      <div className="md:hidden absolute inset-x-0 bottom-0 z-10 pointer-events-auto" style={{ top: "7.5rem" }}>
        {(() => {
          if (hasActiveSearch && !hasCards) {
            return (
              <div className="flex items-end justify-center pb-4">
                <div className="w-[85%] bg-card border rounded-2xl p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-4 space-y-3 animate-pulse">
                      <div className="flex justify-between items-center">
                        <div className="h-5 w-36 bg-muted rounded" />
                        <div className="h-5 w-16 bg-muted rounded" />
                      </div>
                      <div className="h-4 w-48 bg-muted rounded" />
                      <div className="flex gap-3">
                        <div className="h-4 w-14 bg-muted rounded" />
                        <div className="h-4 w-14 bg-muted rounded" />
                        <div className="h-4 w-14 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (hasCards) {
            return (
              <MobileCarousel
                location={displayLocation}
                selectedIndex={selectedItemIndex}
                onSelectIndex={handleSelectIndex}
                originCity={originFilter?.city}
                destCity={destFilter?.city}
                sortBy={mobileSortBy}
                orderUrlTemplate={orderUrlTemplate}
              />
            );
          }
          return (
            <div className="flex items-end justify-center pb-6 px-4">
              <div className="w-[85%] max-w-sm bg-card border rounded-2xl flex flex-col items-center justify-center text-center px-8 py-12">
                {orderCount > 0 && (
                  <p className="text-4xl font-bold tabular-nums tracking-tight mb-1">{orderCount.toLocaleString()}</p>
                )}
                <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">available orders</p>
                <div className="w-8 h-px bg-border my-4" />
                <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">Set your origin and destination to find routes</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    </>
  );
}
