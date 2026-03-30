# Three-Column Desktop Routes Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the desktop routes view from a single sidebar (list + inline details) overlaying a map into a 3-column layout: route list | route details | map.

**Architecture:** Extract the route summary rows and detail/segment rendering from the monolithic `LocationSidebar` into two new components (`RouteList` and `RouteDetailPanel`). The parent `desktop-routes-view.tsx` manages the 3-column grid layout and passes the selected route's chain data to the detail panel. Column 2 is a narrow strip when no route is selected, expanding with a CSS transition when one is.

**Tech Stack:** React, Tailwind CSS v4, Next.js

**Spec:** `docs/superpowers/specs/2026-03-29-three-column-routes-layout-design.md`

---

### Task 1: Create RouteRow Component

**Files:**
- Create: `src/features/routes/views/desktop/route-row.tsx`

This extracts the metrics summary section from `RoundTripChainCard` into a standalone row component. It renders $/Day, Profit, Net/mi, Miles, and a bookmark button. No expansion, no details.

- [ ] **Step 1: Create route-row.tsx**

```tsx
"use client";

import { BookmarkIcon } from "lucide-react";
import type { RoundTripChain } from "@/core/types";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatRpm } from "@/core/utils/route-helpers";

interface RouteRowProps {
  chain: RoundTripChain;
  isSelected: boolean;
  onClick: () => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  routeIdx?: number;
}

export function RouteRow({
  chain,
  isSelected,
  onClick,
  isWatchlisted,
  onToggleWatchlist,
  routeIdx,
}: RouteRowProps) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const firmLegs = chain.legs.filter((leg) => leg.type === "firm");
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);

  return (
    <div
      data-route-idx={routeIdx}
      className={`border-b border-border cursor-pointer transition-colors ${
        isSelected ? "bg-surface-elevated" : "hover:bg-surface-elevated"
      }`}
      onClick={onClick}
    >
      <div className="flex justify-around text-center items-start px-4 py-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">$/Day</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatCurrency(chain.daily_net_profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{chain.estimated_days.toFixed(1)} days est.</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Profit</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatCurrency(profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{formatCurrency(chain.total_pay)} gross</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Net/mi</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatRpm(chain.effective_rpm)}
          </p>
          {avgLoadedRpm !== null && (
            <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">${avgLoadedRpm.toFixed(2)}/mi loaded</p>
          )}
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Miles</p>
          <p className="text-xl font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{chain.deadhead_pct.toFixed(0)}% DH</p>
        </div>
        {onToggleWatchlist && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleWatchlist(); }}
            className="shrink-0 p-1 rounded transition-colors hover:bg-white/10"
          >
            <BookmarkIcon className={`h-6 w-6 ${isWatchlisted ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/views/desktop/route-row.tsx
git commit -m "feat: create RouteRow component for 3-column layout"
```

---

### Task 2: Create RouteList Component

**Files:**
- Create: `src/features/routes/views/desktop/route-list.tsx`

This extracts the sort bar, loading skeletons, empty state, and scrollable list from `LocationSidebar`. It renders `RouteRow` components instead of `RoundTripChainCard`.

- [ ] **Step 1: Create route-list.tsx**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BookmarkIcon } from "lucide-react";
import type { RouteChain, RoundTripChain, LocationGroup } from "@/core/types";
import { ROUTE_SORT_OPTIONS, DEFAULT_SORT_KEY } from "@mwbhtx/haulvisor-core";
import type { RouteSortKey } from "@mwbhtx/haulvisor-core";
import { sortRouteChains, sortRoundTripChains } from "@/features/routes/utils/sort-options";
import { RouteRow } from "./route-row";

/** Unique key for a route chain based on its leg order IDs */
function routeKey(legs: { order_id?: string }[]): string {
  return legs.map((l) => l.order_id ?? "spec").join("|");
}

/** Convert one-way RouteChain to RoundTripChain shape for unified rendering */
function routeChainToRoundTrip(route: RouteChain): RoundTripChain {
  return {
    rank: 0,
    total_pay: route.total_pay,
    total_miles: route.total_miles,
    total_deadhead_miles: route.total_deadhead_miles,
    estimated_deadhead_cost: route.estimated_deadhead_cost,
    firm_profit: route.profit,
    estimated_total_profit: route.profit,
    rate_per_mile: route.effective_rpm,
    risk_score: 0,
    deadhead_pct: route.deadhead_pct,
    effective_rpm: route.effective_rpm,
    estimated_days: route.estimated_days,
    daily_net_profit: route.daily_net_profit,
    cost_breakdown: route.cost_breakdown,
    legs: route.legs.map((leg, i) => ({
      leg_number: i + 1,
      type: "firm" as const,
      order_id: leg.order_id,
      origin_city: leg.origin_city,
      origin_state: leg.origin_state,
      origin_lat: leg.origin_lat,
      origin_lng: leg.origin_lng,
      destination_city: leg.destination_city,
      destination_state: leg.destination_state,
      destination_lat: leg.destination_lat,
      destination_lng: leg.destination_lng,
      pay: leg.pay,
      miles: leg.miles,
      deadhead_miles: leg.deadhead_miles,
      trailer_type: leg.trailer_type,
      weight: leg.weight,
      pickup_date_early: leg.pickup_date_early,
      pickup_date_late: leg.pickup_date_late,
      delivery_date_early: leg.delivery_date_early,
      delivery_date_late: leg.delivery_date_late,
      lane_rank: leg.lane_rank,
    })),
    timeline: route.timeline,
    trip_summary: route.trip_summary,
  };
}

interface RouteListProps {
  location: LocationGroup;
  selectedIndex: number;
  onSelectIndex: (index: number, chain: RoundTripChain | null) => void;
  onClearFilters?: () => void;
  isLoading?: boolean;
}

export function RouteList({
  location,
  selectedIndex,
  onSelectIndex,
  onClearFilters,
  isLoading,
}: RouteListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<RouteSortKey>(DEFAULT_SORT_KEY);
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("hv-watchlist");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const toggleWatchlist = useCallback((key: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem("hv-watchlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isRoundTripMode = location.roundTripChains.length > 0;
  const isOneWayMode = !isRoundTripMode && location.routeChains.length > 0;
  const hasResults = isRoundTripMode || isOneWayMode;

  const allSortedRoundTrips = isRoundTripMode ? sortRoundTripChains(location.roundTripChains, sortBy) : [];
  const allSortedRoutes = isOneWayMode ? sortRouteChains(location.routeChains, sortBy) : [];

  const sortedRoundTrips = showWatchlistOnly
    ? allSortedRoundTrips.filter((c) => watchlist.has(routeKey(c.legs)))
    : allSortedRoundTrips;
  const sortedRoutes = showWatchlistOnly
    ? allSortedRoutes.filter((r) => watchlist.has(routeKey(r.legs)))
    : allSortedRoutes;

  // Get the chain list as unified RoundTripChain[]
  const chains: RoundTripChain[] = isRoundTripMode
    ? sortedRoundTrips
    : sortedRoutes.map(routeChainToRoundTrip);

  // Sync the map to show the correct sorted route when index is 0
  useEffect(() => {
    if (selectedIndex !== 0 || isLoading) return;
    const firstChain = chains[0];
    if (firstChain) {
      onSelectIndex(0, firstChain);
    }
  }, [selectedIndex, isLoading, sortBy, chains, onSelectIndex]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex < 0 || !scrollRef.current) return;
    const row = scrollRef.current?.querySelector(`[data-route-idx="${selectedIndex}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-sidebar">
      {/* Sort bar */}
      {hasResults && !isLoading && (
        <div className="flex items-center gap-1.5 p-3 bg-sidebar shrink-0">
          <span className="text-sm text-muted-foreground mr-1">Sort</span>
          {ROUTE_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortBy(opt.key)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                sortBy === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-input hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {watchlist.size > 0 && (
            <button
              type="button"
              onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
              className={`rounded-full px-3 py-1 text-sm transition-colors flex items-center gap-1 ${
                showWatchlistOnly
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "border border-input hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <BookmarkIcon className="h-3 w-3" />
              {watchlist.size}
            </button>
          )}
        </div>
      )}

      {/* Scrollable route list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted/50 rounded-lg p-4 space-y-3 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-56 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="flex gap-3">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <p className="text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap">0 Routes Found</p>
            <p className="mt-3 text-base text-foreground/70 leading-relaxed whitespace-nowrap">No routes found matching your filters.<br />Try adjusting your origin, destination,<br />or filter settings.</p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-5 h-9 px-5 rounded-full border border-white/20 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          chains.map((chain, i) => (
            <RouteRow
              key={`${chain.legs[0]?.order_id ?? i}-${i}`}
              chain={chain}
              routeIdx={i}
              isSelected={i === selectedIndex}
              onClick={() => onSelectIndex(i === selectedIndex ? -1 : i, i === selectedIndex ? null : chain)}
              isWatchlisted={watchlist.has(routeKey(chain.legs))}
              onToggleWatchlist={() => toggleWatchlist(routeKey(chain.legs))}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/views/desktop/route-list.tsx
git commit -m "feat: create RouteList component for 3-column layout"
```

---

### Task 3: Create RouteDetailPanel Component

**Files:**
- Create: `src/features/routes/views/desktop/route-detail-panel.tsx`

This extracts the expanded detail content (cost breakdown, segments, deadheads) from `RoundTripChainCard` and adds the `RouteInspector` as a collapsible section at the bottom.

- [ ] **Step 1: Create route-detail-panel.tsx**

```tsx
"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, FlameIcon, ClipboardListIcon } from "lucide-react";
import { Badge } from "@/platform/web/components/ui/badge";
import type { RoundTripChain, RoundTripLeg } from "@/core/types";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { LEG_COLORS } from "@/core/utils/route-colors";
import { rateColor, routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatDateRange, formatRpm } from "@/core/utils/route-helpers";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="default">High confidence</Badge>;
  if (score >= 40) return <Badge variant="secondary">Moderate</Badge>;
  return <Badge variant="outline">Low confidence</Badge>;
}

interface RouteDetailPanelProps {
  chain: RoundTripChain | null;
  originCity?: string;
  destCity?: string;
  costPerMile: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
  onShowComments?: (orderId: string) => void;
}

export function RouteDetailPanel({
  chain,
  originCity,
  destCity,
  costPerMile,
  orderUrlTemplate,
  onHoverLeg,
  onShowComments,
}: RouteDetailPanelProps) {
  const [showCosts, setShowCosts] = useState(false);
  const [showInspector, setShowInspector] = useState(false);

  const hasChain = chain !== null;

  return (
    <div
      className="h-full flex flex-col overflow-hidden border-l border-r border-border transition-[width] duration-300 ease-in-out"
      style={{ width: hasChain ? 400 : 48 }}
    >
      {!hasChain ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground -rotate-90 whitespace-nowrap">Select a route</p>
        </div>
      ) : (
        <RouteDetailContent
          chain={chain}
          originCity={originCity}
          destCity={destCity}
          costPerMile={costPerMile}
          orderUrlTemplate={orderUrlTemplate}
          onHoverLeg={onHoverLeg}
          onShowComments={onShowComments}
          showCosts={showCosts}
          setShowCosts={setShowCosts}
          showInspector={showInspector}
          setShowInspector={setShowInspector}
        />
      )}
    </div>
  );
}

function RouteDetailContent({
  chain,
  originCity,
  destCity,
  costPerMile,
  orderUrlTemplate,
  onHoverLeg,
  onShowComments,
  showCosts,
  setShowCosts,
  showInspector,
  setShowInspector,
}: {
  chain: RoundTripChain;
  originCity?: string;
  destCity?: string;
  costPerMile: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
  onShowComments?: (orderId: string) => void;
  showCosts: boolean;
  setShowCosts: (v: boolean) => void;
  showInspector: boolean;
  setShowInspector: (v: boolean) => void;
}) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const firmLegs = chain.legs.filter((leg) => leg.type === "firm");
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);

  const costPerDhMile = chain.total_deadhead_miles > 0
    ? chain.estimated_deadhead_cost / chain.total_deadhead_miles
    : 0;
  const firstLeg = chain.legs[0];
  const lastLeg = chain.legs[chain.legs.length - 1];
  const startDh = firstLeg?.deadhead_miles ?? 0;
  const betweenDh = chain.legs.slice(1).reduce((sum, l) => sum + l.deadhead_miles, 0);
  const returnDh = Math.max(0, chain.total_deadhead_miles - startDh - betweenDh);
  const origin = originCity || "Origin";
  const returnCity = destCity || origin;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Metrics summary */}
      <div className="flex justify-around text-center items-start px-4 py-3 border-b border-border">
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">$/Day</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatCurrency(chain.daily_net_profit)}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Profit</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatCurrency(profit)}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Net/mi</p>
          <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatRpm(chain.effective_rpm)}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Miles</p>
          <p className="text-xl font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
        </div>
      </div>

      {/* Cost breakdown toggle */}
      <div className="border-b border-border">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm transition-colors w-full px-4 py-2.5 text-text-secondary"
          onClick={() => setShowCosts(!showCosts)}
        >
          <span>Cost breakdown</span>
          {showCosts ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
        </button>
        {showCosts && (
          <div className="px-4 pb-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm text-text-body">
            <span>Fuel</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.fuel)}</span>
            <span>Maintenance</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.maintenance)}</span>
            <span>Tires</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.tires)}</span>
            <span>Daily costs</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.daily_costs)}</span>
            <span className="font-medium border-t border-border pt-1.5">Total</span>
            <span className="text-right tabular-nums font-medium border-t border-border pt-1.5">{formatCurrency(chain.cost_breakdown.total)}</span>
          </div>
        )}
      </div>

      {/* Segments header */}
      <div className="px-4 pt-3 pb-1.5 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Segments</p>
      </div>

      {/* Start deadhead */}
      {startDh > 0 && firstLeg.origin_city !== origin && (
        <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-border bg-surface-elevated">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-px flex-1 bg-white/[0.07]" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
            <div className="w-px flex-1 bg-white/[0.07]" />
          </div>
          <div className="flex items-center flex-1 gap-3 py-3">
            <span className="flex-1 text-base text-text-body">{origin} → {firstLeg.origin_city}</span>
            <span className="text-base tabular-nums text-negative">−{formatCurrency(startDh * costPerDhMile)} DH</span>
          </div>
        </div>
      )}

      {/* Legs */}
      {chain.legs.map((leg: RoundTripLeg, legIdx: number) => {
        const color = LEG_COLORS[legIdx % LEG_COLORS.length];
        const showBetweenDh = leg.deadhead_miles > 0 && legIdx > 0;
        return (
          <div key={leg.leg_number}>
            {showBetweenDh && (
              <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-border bg-surface-elevated">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-px flex-1 bg-white/[0.07]" />
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
                  <div className="w-px flex-1 bg-white/[0.07]" />
                </div>
                <div className="flex items-center flex-1 gap-3 py-3">
                  <span className="flex-1 text-base text-text-body">
                    {chain.legs[legIdx - 1].destination_city} → {leg.origin_city}
                  </span>
                  <span className="text-base tabular-nums text-negative">
                    −{formatCurrency(leg.deadhead_miles * costPerDhMile)} DH
                  </span>
                </div>
              </div>
            )}
            <div
              className="flex items-stretch gap-3 pl-4 pr-4 border-b border-border"
              onMouseEnter={() => onHoverLeg?.(legIdx)}
              onMouseLeave={() => onHoverLeg?.(null)}
            >
              <div className="flex flex-col items-center shrink-0">
                <div className="w-px flex-1 bg-white/[0.07]" />
                <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="w-px flex-1 bg-white/[0.07]" />
              </div>
              <div className="flex-1 py-3">
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-base font-semibold flex items-center gap-1.5 min-w-0" style={{ color }}>
                    {leg.order_id && orderUrlTemplate ? (
                      <a
                        href={orderUrlTemplate.replace('{{ORDER_ID}}', leg.order_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-primary transition-colors truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {leg.origin_city} → {leg.destination_city}
                      </a>
                    ) : (
                      <span className="truncate">{leg.origin_city} → {leg.destination_city}</span>
                    )}
                    {leg.lane_rank != null && <FlameIcon className="h-4 w-4 text-primary shrink-0" />}
                    {leg.order_id && leg.type === "firm" && onShowComments && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onShowComments(leg.order_id!); }}
                        className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                        title="View comments"
                      >
                        <ClipboardListIcon className="h-4 w-4" />
                      </button>
                    )}
                  </p>
                  <span className={`shrink-0 text-base font-semibold tabular-nums ${
                    leg.type === "speculative" ? "text-text-body" : "text-positive"
                  }`}>
                    {leg.type === "speculative" ? `~${formatCurrency(leg.pay)}` : formatCurrency(leg.pay)}
                  </span>
                </div>
                {leg.type === "firm" ? (
                  <div className="text-sm mt-1 space-y-0.5 text-text-body">
                    <p>
                      {[leg.weight != null ? `${leg.weight.toLocaleString()} lbs` : null, leg.miles != null ? `${leg.miles.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}
                      {leg.miles > 0 && <>{" · "}<span className={rateColor(leg.pay / leg.miles, costPerMile)}>${(leg.pay / leg.miles).toFixed(2)}/mi</span></>}
                    </p>
                    {(leg.pickup_date_early || leg.delivery_date_early) && (
                      <div>
                        {leg.pickup_date_early && <p>Pickup: {formatDateRange(leg.pickup_date_early, leg.pickup_date_late)}</p>}
                        {leg.delivery_date_early && <p>Delivery: {formatDateRange(leg.delivery_date_early, leg.delivery_date_late)}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm mt-1 text-text-body">
                    {[`${leg.miles.toLocaleString()} mi`, leg.lane_confidence ? `${leg.lane_confidence.loads_per_week.toFixed(1)} loads/wk` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                {leg.type === "speculative" && leg.lane_confidence && (
                  <div className="mt-1.5">
                    <ConfidenceBadge score={leg.lane_confidence.confidence_score} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Return deadhead */}
      {returnDh > 0 && lastLeg.destination_city !== returnCity && (
        <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-border bg-surface-elevated">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-px flex-1 bg-white/[0.07]" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
            <div className="w-px flex-1 bg-white/[0.07]" />
          </div>
          <div className="flex items-center flex-1 gap-3 py-3">
            <span className="flex-1 text-base text-text-body">{lastLeg.destination_city} → {returnCity}</span>
            <span className="text-base tabular-nums text-negative">−{formatCurrency(returnDh * costPerDhMile)} DH</span>
          </div>
        </div>
      )}

      {/* Segment Details — collapsed by default */}
      {chain.timeline && chain.timeline.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm transition-colors w-full px-4 py-2.5 text-text-secondary"
            onClick={() => setShowInspector(!showInspector)}
          >
            <span>Segment Details</span>
            {showInspector ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </button>
          {showInspector && (
            <RouteInspector
              chain={chain}
              originCity={origin}
              returnCity={returnCity}
              onClose={() => setShowInspector(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/views/desktop/route-detail-panel.tsx
git commit -m "feat: create RouteDetailPanel component for 3-column layout"
```

---

### Task 4: Update desktop-routes-view.tsx to 3-Column Layout

**Files:**
- Modify: `src/features/routes/views/desktop/desktop-routes-view.tsx`

Replace the current overlay layout with a 3-column flex layout below the filter bar.

- [ ] **Step 1: Update imports**

Replace the `LocationSidebar` import with the new components:

```tsx
// Remove:
import { LocationSidebar } from "./location-sidebar";

// Add:
import { RouteList } from "./route-list";
import { RouteDetailPanel } from "./route-detail-panel";
```

- [ ] **Step 2: Add state for selected chain**

After the existing `selectedItemIndex` state, add a ref to track the selected chain:

```tsx
const [selectedChain, setSelectedChain] = useState<RoundTripChain | null>(null);
```

Add the import for `RoundTripChain`:
```tsx
import type { RoundTripChain } from "@/core/types";
```

- [ ] **Step 3: Create a handler for route selection**

Replace the existing `handleSelectIndex` usage. Create a new handler that sets both the index and the chain:

```tsx
const handleRouteSelect = useCallback((index: number, chain: RoundTripChain | null) => {
  setSelectedItemIndex(index);
  setSelectedChain(chain);
  if (chain) {
    setSelectedRoute({ legs: chain.legs });
  } else {
    setSelectedRoute(undefined);
  }
}, []);
```

- [ ] **Step 4: Replace the layout JSX**

Replace everything inside the return starting from the root `<div>`:

```tsx
return (
  <div className="flex flex-col overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
    {/* Filter bar — full width */}
    <div className="bg-sidebar p-3 w-full shrink-0">
      <SearchFilters
        onSearch={handleSearch}
        onSearchRoundTrip={handleSearchRoundTrip}
        onClearSearch={handleSearchCleared}
        onTripModeChange={setTripMode}
        onOriginChange={setOriginFilter}
        onDestinationChange={setDestFilter}
        onFilterPending={() => setFilterPending(true)}
        isOnboarding={isTourActive}
        hasHome={hasHomeBase}
        resetKey={filterResetKey}
        initialTripType="round-trip"
      />
    </div>

    {/* 3-column area */}
    <div className="flex flex-1 min-h-0">
      {/* Column 1: Route list */}
      {hasActiveSearch && (
        <div className="w-[300px] shrink-0 min-h-0">
          <RouteList
            location={displayLocation}
            selectedIndex={selectedItemIndex}
            onSelectIndex={handleRouteSelect}
            onClearFilters={hasActiveSearch ? handleClearSearch : undefined}
            isLoading={!ready || isLoading || isRoundTripLoading || filterPending || (hasPersistedFilters && !hasActiveSearch && !hasSearchedOnce.current)}
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
        />
      )}

      {/* Column 3: Map */}
      <div className="flex-1 min-h-0 relative">
        <RouteMap
          selectedRoute={ready ? selectedRoute : undefined}
          originCoords={originFilter}
          destCoords={destFilter}
          tripMode={tripMode}
          onHoverLegRef={hoverLegRef}
        />
      </div>
    </div>
  </div>
);
```

- [ ] **Step 5: Remove old layout code**

Remove the old overlay-based layout JSX that was replaced in Step 4. Also remove any now-unused imports (`LocationSidebar`).

- [ ] **Step 6: Add map resize on column transition**

The map needs to be told to resize when column 2 transitions. Add a `useEffect` that listens for the `selectedChain` changing and triggers a resize after the transition completes:

After the existing effects in the component, add:

```tsx
// Resize map when detail panel transitions
useEffect(() => {
  const timer = setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 350); // slightly after the 300ms transition
  return () => clearTimeout(timer);
}, [selectedChain]);
```

- [ ] **Step 7: Commit**

```bash
git add src/features/routes/views/desktop/desktop-routes-view.tsx
git commit -m "feat: restructure desktop routes to 3-column layout"
```

---

### Task 5: Add Comments Dialog to desktop-routes-view.tsx

**Files:**
- Modify: `src/features/routes/views/desktop/desktop-routes-view.tsx`

The comments dialog was previously inside `LocationSidebar`. Move it to the parent view and wire it to `RouteDetailPanel`.

- [ ] **Step 1: Add comments dialog state and handler**

Add these imports:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/platform/web/components/ui/dialog";
import { fetchApi } from "@/core/services/api";
import { useAuth } from "@/core/services/auth-provider";
```

Note: `useAuth` is likely already imported. Check and avoid duplicates.

Add state and handler inside the component:

```tsx
const { activeCompanyId } = useAuth();
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
```

- [ ] **Step 2: Pass onShowComments to RouteDetailPanel**

Add the prop to the `RouteDetailPanel` JSX:

```tsx
<RouteDetailPanel
  chain={selectedChain}
  originCity={originFilter?.city}
  destCity={destFilter?.city}
  costPerMile={(settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE}
  orderUrlTemplate={orderUrlTemplate}
  onHoverLeg={(idx) => hoverLegRef.current?.(idx)}
  onShowComments={handleShowComments}
/>
```

- [ ] **Step 3: Add the Dialog JSX**

Add just before the closing `</div>` of the root element:

```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add src/features/routes/views/desktop/desktop-routes-view.tsx
git commit -m "feat: move comments dialog to desktop-routes-view"
```

---

### Task 6: Build Check and Cleanup

**Files:**
- No new files — verification and cleanup only

- [ ] **Step 1: Build check**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Verify the old LocationSidebar is no longer imported on desktop**

```bash
grep -r "LocationSidebar\|location-sidebar" src/features/routes/views/desktop/ --include="*.tsx"
```

Expected: No results (or only the file itself if it still exists). The desktop route view should only import `RouteList` and `RouteDetailPanel`.

Note: `location-sidebar.tsx` may still be used by mobile views. Do NOT delete it — only verify the desktop view no longer depends on it.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Check:
- 3-column layout renders: route list on left, detail panel in center (collapsed when no selection), map on right
- Clicking a route row selects it, populates column 2, and highlights the route on the map
- Clicking the selected route again deselects it, column 2 collapses
- Cost breakdown expands/collapses in column 2
- Segment Details section at bottom of column 2 expands/collapses
- Map resizes when column 2 transitions
- Sort pills work
- Watchlist toggling works
- Comments dialog works (click clipboard icon on a leg)
- Leg hover highlights on map still work

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: cleanup and fixes for 3-column layout"
```
