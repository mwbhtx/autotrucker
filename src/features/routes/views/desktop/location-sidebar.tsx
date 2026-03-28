"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { XIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, ChevronLeftIcon, FlameIcon, BookmarkIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth-provider";
import { fetchApi } from "@/lib/api";
import type { RouteChain, RoundTripChain, RoundTripLeg, LocationGroup } from "@/lib/types";
import { RouteInspector } from "@/components/map/route-inspector";
import { DEFAULT_COST_PER_MILE, calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { LEG_COLORS } from "@/lib/route-colors";
import { rateColor, netRateColor, routeProfitColor } from "@/lib/rate-color";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}



function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateRange(early?: string, late?: string): string {
  if (!early) return "";
  const e = formatDateTime(early);
  if (!late || late === early) return e;
  const l = formatDateTime(late);
  return `${e} – ${l}`;
}

function formatPickupDates(early?: string, late?: string): string {
  if (!early) return "";
  const e = formatDate(early);
  if (!late || late === early) return e;
  const l = formatDate(late);
  return e === l ? e : `${e}–${l}`;
}

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="default">High confidence</Badge>;
  if (score >= 40) return <Badge variant="secondary">Moderate</Badge>;
  return <Badge variant="outline">Low confidence</Badge>;
}

function RouteScoreBadge({ score }: { score: number }) {
  const color = score >= 70
    ? "bg-green-500/15 border-green-500/30 text-green-500"
    : score >= 40
    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
    : "bg-red-500/15 border-red-500/30 text-red-500";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function formatRpm(value: number): string {
  return `$${value.toFixed(2)}/mi`;
}


interface LocationSidebarProps {
  location: LocationGroup;
  selectedIndex: number;
  onSelectIndex: (index: number, legs?: import("@/lib/map/draw-route").DrawableRouteLeg[]) => void;
  onClose: () => void;
  onClearFilters?: () => void;
  orderCount?: number;
  maxWeight?: number | null;
  isLoading?: boolean;
  originFilter?: { lat: number; lng: number; city: string } | null;
  destFilter?: { lat: number; lng: number; city: string } | null;
  costPerMile?: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
}

type SortKey = "daily_profit" | "profit" | "deadhead";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "daily_profit", label: "$/Day" },
  { key: "profit", label: "Profit" },
  { key: "deadhead", label: "DH %" },
];

function sortRouteChains(chains: RouteChain[], sortBy: SortKey): RouteChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "profit": sorted.sort((a, b) => b.profit - a.profit); break;
    case "daily_profit": sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit); break;
    case "deadhead": sorted.sort((a, b) => a.deadhead_pct - b.deadhead_pct); break;
  }
  return sorted;
}

function sortRoundTripChains(chains: RoundTripChain[], sortBy: SortKey): RoundTripChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "profit": sorted.sort((a, b) => b.firm_profit - a.firm_profit); break;
    case "daily_profit": sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit); break;
    case "deadhead": sorted.sort((a, b) => a.deadhead_pct - b.deadhead_pct); break;
  }
  return sorted;
}

/** Unique key for a route chain based on its leg order IDs */
function routeKey(legs: { order_id?: string }[]): string {
  return legs.map((l) => l.order_id ?? "spec").join("|");
}

export function LocationSidebar({ location, selectedIndex, onSelectIndex, onClose, onClearFilters, orderCount, maxWeight, isLoading, originFilter, destFilter, costPerMile = DEFAULT_COST_PER_MILE, orderUrlTemplate, onHoverLeg }: LocationSidebarProps) {
  const { activeCompanyId } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<SortKey>("daily_profit");
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

  // Scroll selected card into view after it expands
  useEffect(() => {
    if (selectedIndex < 0 || !scrollRef.current) return;
    const timer = setTimeout(() => {
      const card = scrollRef.current?.querySelector(`[data-route-idx="${selectedIndex}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 200); // delay to let the card fully expand first
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("hv-watchlist");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [showSingleLeg, setShowSingleLeg] = useState(false);

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

  // Split round-trip results into multi-leg and single-leg groups
  const multiLegChains = sortedRoundTrips.filter((c) => c.legs.length > 1);
  const singleLegChains = sortedRoundTrips.filter((c) => c.legs.length === 1);

  const itemCount = isRoundTripMode
    ? (showSingleLeg ? sortedRoundTrips.length : multiLegChains.length)
    : sortedRoutes.length;

  return (
    <div className="flex h-full w-full bg-[#111111e8] border border-white/10 rounded-2xl flex-col overflow-hidden relative">

      {/* Sort bar + watchlist toggle */}
      {hasResults && !isLoading && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#111111e8] rounded-xl mx-2 mt-2">
          <span className="text-sm text-muted-foreground mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => (
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
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {itemCount} route{itemCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Scrollable order/route list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2" style={{ scrollPadding: "8px" }}>
        {isLoading ? (
          <div className="space-y-2">
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
        ) : isRoundTripMode
          ? (() => {
              const visible = showSingleLeg ? [...multiLegChains, ...singleLegChains] : multiLegChains;
              const items: React.ReactNode[] = [];
              visible.forEach((chain, i) => {
                if (showSingleLeg && i === multiLegChains.length && singleLegChains.length > 0) {
                  items.push(
                    <button
                      key="single-leg-divider"
                      type="button"
                      onClick={() => setShowSingleLeg(false)}
                      className="w-full flex items-center gap-3 py-2 px-1 group"
                    >
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap group-hover:text-foreground transition-colors">
                        Single Load Routes &times;
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </button>,
                  );
                }
                items.push(
                  <RoundTripChainCard
                    key={`${chain.legs[0]?.order_id ?? i}-${i}`}
                    chain={chain}
                    rank={i + 1}
                    routeIdx={i}
                    isSelected={i === selectedIndex}
                    onClick={() => onSelectIndex(i, chain.legs)}
                    maxWeight={maxWeight}
                    originCity={location.city}
                    isWatchlisted={watchlist.has(routeKey(chain.legs))}
                    onToggleWatchlist={() => toggleWatchlist(routeKey(chain.legs))}
                    orderUrlTemplate={orderUrlTemplate}
                    onShowComments={handleShowComments}
                    onHoverLeg={onHoverLeg}
                    costPerMile={costPerMile}
                  />,
                );
              });
              // Show reveal button for single-leg results
              if (singleLegChains.length > 0 && !showSingleLeg) {
                items.push(
                  <button
                    key="show-single-leg"
                    type="button"
                    onClick={() => setShowSingleLeg(true)}
                    className="w-full rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-5 py-5 text-center transition-colors"
                  >
                    <p className="text-base font-semibold text-foreground">Show Single Load Routes</p>
                    <p className="text-sm text-muted-foreground mt-1">{singleLegChains.length} single load route{singleLegChains.length !== 1 ? "s" : ""} with return analysis</p>
                  </button>,
                );
              }
              return items;
            })()
          : sortedRoutes.map((route, i) => (
              <RoundTripChainCard
                key={`${route.legs[0]?.order_id ?? i}-${i}`}
                chain={routeChainToRoundTrip(route)}
                rank={i + 1}
                routeIdx={i}
                isSelected={i === selectedIndex}
                onClick={() => onSelectIndex(i, routeChainToRoundTrip(route).legs)}
                originCity={originFilter?.city}
                destCity={destFilter?.city}
                isWatchlisted={watchlist.has(routeKey(route.legs))}
                onToggleWatchlist={() => toggleWatchlist(routeKey(route.legs))}
                orderUrlTemplate={orderUrlTemplate}
                onShowComments={handleShowComments}
                onHoverLeg={onHoverLeg}
                costPerMile={costPerMile}
              />
            ))
        }
      </div>

      {/* Comments dialog — centered on both desktop and mobile */}
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

/* ---- Convert one-way RouteChain to RoundTripChain shape for unified card ---- */

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

/* ---- Route chain card (unified for both modes) ---- */

function RoundTripChainCard({
  chain,
  rank,
  isSelected,
  onClick,
  maxWeight,
  originCity,
  destCity,
  isWatchlisted,
  onToggleWatchlist,
  routeIdx,
  orderUrlTemplate,
  onShowComments,
  onHoverLeg,
  costPerMile,
}: {
  chain: RoundTripChain;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
  maxWeight?: number | null;
  originCity?: string;
  /** Destination city label (one-way mode). When set, return DH targets this instead of origin. */
  destCity?: string;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  routeIdx?: number;
  orderUrlTemplate?: string;
  onShowComments?: (orderId: string) => void;
  onHoverLeg?: (legIndex: number | null) => void;
  costPerMile: number;
}) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const firmLegs = chain.legs.filter((leg) => leg.type === "firm");
  const speculativeLegs = chain.legs.filter((leg) => leg.type === "speculative");

  // Build collapsed summary line
  const highestConfidenceSpecLeg = speculativeLegs.reduce<RoundTripLeg | null>((best, leg) => {
    const score = leg.lane_confidence?.confidence_score ?? 0;
    const bestScore = best?.lane_confidence?.confidence_score ?? 0;
    return score > bestScore ? leg : best;
  }, null);

  const confidenceSummary = () => {
    if (!highestConfidenceSpecLeg?.lane_confidence) return null;
    const score = highestConfidenceSpecLeg.lane_confidence.confidence_score;
    const legNum = highestConfidenceSpecLeg.leg_number;
    if (score >= 70) return `Order ${legNum}: High confidence`;
    if (score >= 40) return `Order ${legNum}: Moderate confidence`;
    return `Order ${legNum}: Low confidence`;
  };

  // Compute overall date range: first pickup → estimated arrival at final destination
  const startDates = chain.legs
    .flatMap((l) => [l.pickup_date_early])
    .filter(Boolean) as string[];
  const firstPickup = startDates.length > 0
    ? startDates.reduce((a, b) => (a < b ? a : b))
    : undefined;
  // Use simulator total_hours to compute estimated end date from first pickup
  const estimatedEnd = firstPickup && chain.trip_summary
    ? new Date(new Date(firstPickup).getTime() + chain.trip_summary.total_hours * 3_600_000).toISOString()
    : undefined;
  // Fall back to order dates if no simulator data
  const fallbackEnd = (() => {
    const endDates = chain.legs
      .flatMap((l) => [l.delivery_date_late, l.delivery_date_early, l.pickup_date_late])
      .filter(Boolean) as string[];
    return endDates.length > 0 ? endDates.reduce((a, b) => (a > b ? a : b)) : undefined;
  })();
  const dateRange = firstPickup
    ? formatPickupDates(firstPickup, estimatedEnd ?? fallbackEnd)
    : "";

  const [showCosts, setShowCosts] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;

  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);

  useEffect(() => {
    if (!isSelected) setShowInspector(false);
  }, [isSelected]);

  return (
    <div
      data-route-idx={routeIdx}
      className={`relative flex rounded-xl overflow-hidden border ${
        isSelected ? "border-white/[0.12] shadow-[inset_2px_0_0_rgba(255,255,255,0.18)]" : "border-white/[0.10]"
      }`}
    >
      {/* Route details */}
      <div
        onClick={onClick}
        className={`flex-1 min-w-0 cursor-pointer transition-colors ${
          isSelected ? "bg-[#111111]" : "rounded-xl bg-[#111111] hover:bg-[#161616]"
        }`}
      >
        {/* Key metrics + bookmark */}
        <div className="flex justify-around text-center items-start px-4 py-3 border-b border-white/[0.05]">
          <div>
            <p className="text-sm uppercase tracking-wide" style={{ color: "rgba(205,205,205,0.5)" }}>Profit</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs tabular-nums mt-0.5" style={{ color: "rgba(205,205,205,0.4)" }}>{formatCurrency(chain.total_pay)} gross</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide" style={{ color: "rgba(205,205,205,0.5)" }}>$/Day</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatCurrency(chain.daily_net_profit)}
            </p>
            <p className="text-xs tabular-nums mt-0.5" style={{ color: "rgba(205,205,205,0.4)" }}>{chain.estimated_days.toFixed(1)} days est.</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide" style={{ color: "rgba(205,205,205,0.5)" }}>Net/mi</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatRpm(chain.effective_rpm)}
            </p>
            {avgLoadedRpm !== null && (
              <p className="text-xs tabular-nums mt-0.5" style={{ color: "rgba(205,205,205,0.4)" }}>${avgLoadedRpm.toFixed(2)}/mi loaded</p>
            )}
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide" style={{ color: "rgba(205,205,205,0.5)" }}>Miles</p>
            <p className="text-xl font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
            <p className="text-xs tabular-nums mt-0.5" style={{ color: chain.deadhead_pct > 30 ? "rgba(245,158,11,0.7)" : "rgba(205,205,205,0.4)" }}>{chain.deadhead_pct.toFixed(0)}% DH</p>
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

        {/* Date range row */}
        {dateRange && (
          <div className="flex items-center justify-end px-4 py-2">
            <span className="text-sm" style={{ color: "rgba(205,205,205,0.5)" }}>{dateRange}</span>
          </div>
        )}

        {/* Route detail (expanded) */}
        {isSelected && (() => {
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
            <div className="border-t border-white/[0.05]">
              {/* Cost breakdown toggle */}
              <div className="border-b border-white/[0.05]">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm transition-colors w-full px-4 py-2.5" style={{ color: "rgba(205,205,205,0.5)" }}
                  onClick={(e) => { e.stopPropagation(); setShowCosts(!showCosts); }}
                >
                  <span>Cost breakdown</span>
                  {showCosts ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                </button>
                {showCosts && (
                  <div className="px-4 pb-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm" style={{ color: "#cdcdcd" }}>
                    <span>Fuel</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.fuel)}</span>
                    <span>Maintenance</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.maintenance)}</span>
                    <span>Tires</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.tires)}</span>
                    <span>Daily costs</span><span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.daily_costs)}</span>
                    <span className="font-medium border-t border-white/[0.05] pt-1.5">Total</span>
                    <span className="text-right tabular-nums font-medium border-t border-white/[0.05] pt-1.5">{formatCurrency(chain.cost_breakdown.total)}</span>
                  </div>
                )}
              </div>

              {/* Segments header */}
              <div className="px-4 pt-3 pb-1.5 border-b border-white/[0.05]">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(205,205,205,0.3)" }}>Segments</p>
              </div>

              {/* Start deadhead */}
              {startDh > 0 && firstLeg.origin_city !== origin && (
                <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-[#161616]">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px flex-1 bg-white/[0.07]" />
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-[#161616] shrink-0" />
                    <div className="w-px flex-1 bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center flex-1 gap-3 py-3">
                    <span className="flex-1 text-base" style={{ color: "#cdcdcd" }}>{origin} → {firstLeg.origin_city}</span>
                    <span className="text-base tabular-nums" style={{ color: "#ff6969" }}>−{formatCurrency(startDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}

              {chain.legs.map((leg: RoundTripLeg, legIdx: number) => {
                const color = LEG_COLORS[legIdx % LEG_COLORS.length];
                const showBetweenDh = leg.deadhead_miles > 0 && legIdx > 0;
                return (
                  <div key={leg.leg_number}>
                    {showBetweenDh && (
                      <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-[#161616]">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-px flex-1 bg-white/[0.07]" />
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-[#161616] shrink-0" />
                          <div className="w-px flex-1 bg-white/[0.07]" />
                        </div>
                        <div className="flex items-center flex-1 gap-3 py-3">
                          <span className="flex-1 text-base" style={{ color: "#cdcdcd" }}>
                            {chain.legs[legIdx - 1].destination_city} → {leg.origin_city}
                          </span>
                          <span className="text-base tabular-nums" style={{ color: "#ff6969" }}>
                            −{formatCurrency(leg.deadhead_miles * costPerDhMile)} DH
                          </span>
                        </div>
                      </div>
                    )}
                    <div
                      className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05]"
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
                            leg.type === "speculative" ? "text-[#cdcdcd]" : "text-green-400"
                          }`}>
                            {leg.type === "speculative" ? `~${formatCurrency(leg.pay)}` : formatCurrency(leg.pay)}
                          </span>
                        </div>
                        {leg.type === "firm" ? (
                          <div className="text-sm mt-1 space-y-0.5" style={{ color: "#cdcdcd" }}>
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
                          <p className="text-sm mt-1" style={{ color: "#cdcdcd" }}>
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

              {returnDh > 0 && lastLeg.destination_city !== returnCity && (
                <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-[#161616]">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px flex-1 bg-white/[0.07]" />
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-[#161616] shrink-0" />
                    <div className="w-px flex-1 bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center flex-1 gap-3 py-3">
                    <span className="flex-1 text-base" style={{ color: "#cdcdcd" }}>{lastLeg.destination_city} → {returnCity}</span>
                    <span className="text-base tabular-nums" style={{ color: "#ff6969" }}>−{formatCurrency(returnDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Right-edge handle — visible when selected, drawer is closed */}
      {isSelected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowInspector(true); }}
          className="flex items-center justify-center w-7 shrink-0 rounded-r-xl bg-[#161616] hover:bg-[#1e1e1e] border-l border-white/[0.05] transition-colors"
          title="View segment breakdown"
        >
          <ChevronLeftIcon className="h-4 w-4 text-[#cdcdcd]" />
        </button>
      )}

      {/* Inspector drawer — slides in from right as an overlay */}
      {isSelected && (
        <div
          className="absolute inset-0 flex"
          style={{
            transform: showInspector ? "translateX(0)" : "translateX(100%)",
            transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Left-edge close handle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowInspector(false); }}
            className="flex items-center justify-center w-7 shrink-0 bg-[#111111] hover:bg-[#1e1e1e] border-r border-white/[0.05] transition-colors"
            title="Back to route"
          >
            <ChevronRightIcon className="h-4 w-4 text-[#cdcdcd]" />
          </button>
          {/* Inspector content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <RouteInspector
              chain={chain}
              originCity={originCity || "Origin"}
              returnCity={destCity || originCity || "Origin"}
              onClose={() => setShowInspector(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
