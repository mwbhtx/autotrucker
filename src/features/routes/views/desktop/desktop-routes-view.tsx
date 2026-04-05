"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tourSteps } from "@/platform/web/components/tour-steps";
import { RouteMap } from "@/features/routes/components/route-map";
import { SearchFilters } from "@/features/routes/components/search-form";
import { RouteList } from "./route-list";
import { RouteDetailPanel } from "./route-detail-panel";
import { useRouteSearch, type RouteSearchParams } from "@/core/hooks/use-routes";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings, useUpdateSettings } from "@/core/hooks/use-settings";
import { isDemoUser } from "@/core/services/auth";
import { groupRoutesByLocation } from "@/core/utils/group-by-location";
import type { LocationGroup, RouteChain } from "@/core/types";
import type { DrawableRouteLeg } from "@/core/utils/map/draw-route";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/platform/web/components/ui/dialog";
import { fetchApi } from "@/core/services/api";

const EMPTY_LOCATION: LocationGroup = {
  city: "",
  state: "",
  lat: 0,
  lng: 0,
  orders: [],
  routeChains: [],
};

export function DesktopRoutesView() {
  const { activeCompanyId } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedChain, setSelectedChain] = useState<RouteChain | null>(null);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [originFilter, setOriginFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);
  const [destFilter, setDestFilter] = useState<{ lat: number; lng: number; city: string } | null>(null);

  const [filterPending, setFilterPending] = useState(false);
  const hoverLegRef = useRef<((legIndex: number | null) => void) | null>(null);

  const [watchlistSet, setWatchlistSet] = useState<Set<string>>(new Set());
  const toggleWatchlistRef = useRef<((key: string) => void) | null>(null);

  const handleWatchlistChange = useCallback((wl: Set<string>, toggle: (key: string) => void) => {
    setWatchlistSet(wl);
    toggleWatchlistRef.current = toggle;
  }, []);

  const selectedRouteKey = useMemo(() => {
    if (!selectedChain) return "";
    return selectedChain.legs.map((l) => l.order_id ?? "spec").join("|");
  }, [selectedChain]);

  const { data, isLoading, isFetched, progress } = useRouteSearch(activeCompanyId ?? "", searchParams);
  const routes = useMemo(() => data?.routes ?? [], [data?.routes]);

  const orderUrlTemplate = data?.order_url_template;

  const hasActiveSearch = searchParams !== null;
  const hasHomeBase = !settingsLoading && !!settings?.home_base_lat;

  // Start onboarding tour if no search is active and user hasn't completed it
  const tourStarted = useRef(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const updateSettings = useUpdateSettings();
  // Reset tour guard when user changes (e.g. sign out → try demo again)
  useEffect(() => {
    tourStarted.current = false;
  }, [activeCompanyId]);

  useEffect(() => {
    if (tourStarted.current) return;
    if (settingsLoading) return;
    if (!activeCompanyId) return;
    if (hasHomeBase && !isDemoUser()) return;
    if (hasActiveSearch) return;
    if (settings?.onboarding_completed) return;
    const dismissed = sessionStorage.getItem("hv-tour-dismissed");
    if (dismissed) return;
    tourStarted.current = true;
    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        steps: tourSteps,
        overlayColor: "black",
        overlayOpacity: 0.7,
        popoverClass: "hv-tour-popover",
        onDestroyed: () => {
          setIsTourActive(false);
          if (isDemoUser()) {
            sessionStorage.setItem("hv-tour-dismissed", "1");
          } else {
            updateSettings.mutate({ onboarding_completed: true } as any);
          }
        },
      });
      setIsTourActive(true);
      driverObj.drive();
    }, 500);
    return () => clearTimeout(timer);
  }, [settingsLoading, hasHomeBase, hasActiveSearch, settings?.onboarding_completed, activeCompanyId]);

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
    if (searchParams !== null && isFetched) return true;
    return false;
  }, [settingsLoading, hasActiveSearch, hasHomeBase, searchParams, isFetched]);

  const [selectedRouteLegs, setSelectedRouteLegs] = useState<DrawableRouteLeg[] | null>(null);

  // Derive sidebar location directly from query results (no useEffect delay)
  const displayLocation = useMemo<LocationGroup>(() => {
    if (searchParams !== null && routes.length > 0) {
      const origin = data?.origin;
      if (origin) {
        return {
          city: origin.city,
          state: origin.state,
          lat: origin.lat,
          lng: origin.lng,
          orders: [],
          routeChains: routes,
        };
      }
      // Fallback: group by location
      const locations = groupRoutesByLocation(routes);
      if (locations.length > 0) {
        const allRouteChains = locations.flatMap((l) => l.routeChains);
        return {
          city: "Search Results",
          state: "",
          lat: locations[0].lat,
          lng: locations[0].lng,
          orders: [],
          routeChains: allRouteChains,
        };
      }
    }
    return EMPTY_LOCATION;
  }, [searchParams, routes, data?.origin]);

  // Derive selected route for the map — only use legs provided by the sidebar
  // (sidebar handles sort order, so index-based lookup would be wrong)
  const selectedRoute = useMemo<{ legs: DrawableRouteLeg[] } | null>(() => {
    if (selectedRouteLegs) return { legs: selectedRouteLegs };
    return null;
  }, [selectedRouteLegs]);

  // Reset selection when results change — RouteList's sync effect will
  // pick the first *sorted* result via the onSelectIndex callback.
  // Only clear the chain when there are no results; otherwise the child
  // effect sets the correct sorted route and we must not overwrite it
  // (parent effects run after child effects in React).
  const prevResultsRef = useRef(displayLocation);
  useEffect(() => {
    if (prevResultsRef.current !== displayLocation) {
      prevResultsRef.current = displayLocation;
      setSelectedItemIndex(0);
      const hasResults = displayLocation.routeChains.length > 0;
      if (!hasResults) {
        setSelectedChain(null);
        setSelectedRouteLegs(null);
      }
    }
  }, [displayLocation]);

  // Resize map when layout changes (detail panel show/hide, search clear)
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 350);
    return () => clearTimeout(timer);
  }, [selectedChain, hasActiveSearch]);

  const handleSearch = (p: RouteSearchParams) => {
    setFilterPending(false);
    setSearchParams(p);
    setSelectedItemIndex(0);
    setSelectedRouteLegs(null);
  };

  const handleSearchCleared = () => {
    setSearchParams(null);
    setSelectedItemIndex(0);
    setSelectedChain(null);
    setSelectedRouteLegs(null);
    setOriginFilter(null);
    setDestFilter(null);
  };

  const handleClearSearch = () => {
    handleSearchCleared();
    setFilterResetKey((k) => k + 1);
  };

  const handleSelectIndex = useCallback((index: number, legs?: DrawableRouteLeg[]) => {
    setSelectedItemIndex(index);
    setSelectedRouteLegs(legs ?? null);
  }, []);

  const [commentsDialog, setCommentsDialog] = useState<{ orderId: string; comments: string; loading: boolean } | null>(null);

  const handleShowComments = useCallback(async (orderId: string) => {
    if (!activeCompanyId) return;
    setCommentsDialog({ orderId, comments: "", loading: true });
    try {
      const order = await fetchApi<{ comments?: string }>(`orders/${activeCompanyId}/${orderId}`);
      setCommentsDialog({ orderId, comments: order.comments || "No comments available.", loading: false });
    } catch {
      setCommentsDialog({ orderId, comments: "Failed to load comments.", loading: false });
    }
  }, [activeCompanyId]);

  const handleRouteSelect = useCallback((index: number, chain: RouteChain | null) => {
    setSelectedItemIndex(index);
    setSelectedChain(chain);
    if (chain) {
      setSelectedRouteLegs(chain.legs as DrawableRouteLeg[]);
    } else {
      setSelectedRouteLegs(null);
    }
  }, []);

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
    <div className="flex flex-col overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
      {/* Filter bar — full width */}
      <div className="bg-sidebar p-3 w-full shrink-0">
        <SearchFilters
          onSearch={handleSearch}
          onClearSearch={handleSearchCleared}
          onOriginChange={setOriginFilter}
          onDestinationChange={setDestFilter}
          onFilterPending={() => setFilterPending(true)}
          isOnboarding={isTourActive}
          hasHome={hasHomeBase}
          resetKey={filterResetKey}
        />
      </div>

      {/* 3-column area */}
      <div className="flex flex-1 min-h-0">
        {/* Column 1: Route list */}
        {hasActiveSearch && (
          <div className="w-[35%] min-w-[280px] max-w-[450px] shrink-0 min-h-0">
            {isLoading && progress && progress.pairs_total > 0 && (
              <div className="px-4 pt-3 pb-1 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (progress.pairs_checked / progress.pairs_total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Checking {progress.pairs_checked.toLocaleString()} / {progress.pairs_total.toLocaleString()} pairs
                  {progress.routes_found > 0 && ` — ${progress.routes_found} routes found`}
                </p>
              </div>
            )}
            <RouteList
              chains={displayLocation.routeChains}
              selectedIndex={selectedItemIndex}
              onSelectIndex={handleRouteSelect}
              onClearFilters={hasActiveSearch ? handleClearSearch : undefined}
              isLoading={!ready || isLoading || filterPending || (hasPersistedFilters && !hasActiveSearch && !hasSearchedOnce.current)}
              onWatchlistChange={handleWatchlistChange}
            />
          </div>
        )}

        {/* Column 2: Route details */}
        {hasActiveSearch && (
          <RouteDetailPanel
            chain={selectedChain}
            originCity={originFilter?.city}
            destCity={destFilter?.city}
            costPerMile={(settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE}
            orderUrlTemplate={orderUrlTemplate}
            onHoverLeg={(idx) => hoverLegRef.current?.(idx)}
            onShowComments={handleShowComments}
            isWatchlisted={watchlistSet.has(selectedRouteKey)}
            onToggleWatchlist={selectedRouteKey ? () => toggleWatchlistRef.current?.(selectedRouteKey) : undefined}
            departureTime={(() => {
              // Fall back to chain's suggested departure (pickup minus deadhead)
              if (selectedChain?.suggested_departure) {
                return new Date(selectedChain.suggested_departure);
              }
              return undefined;
            })()}
          />
        )}

        {/* Column 3: Map */}
        <div className="flex-1 min-h-0 relative">
          <RouteMap
            selectedRoute={ready ? selectedRoute : undefined}
            originCoords={originFilter}
            destCoords={destFilter}
            onHoverLegRef={hoverLegRef}
          />
        </div>
      </div>

      <Dialog open={commentsDialog !== null} onOpenChange={() => setCommentsDialog(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments — {commentsDialog?.orderId}</DialogTitle>
          </DialogHeader>
          {commentsDialog?.loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
            </div>
          ) : (
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {commentsDialog?.comments}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
