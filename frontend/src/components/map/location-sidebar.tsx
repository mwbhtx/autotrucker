"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { XIcon, ChevronDownIcon, ChevronUpIcon, FlameIcon, BookmarkIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { fetchApi } from "@/lib/api";
import type { RouteChain, RoundTripChain, RoundTripLeg, LocationGroup } from "@/lib/types";
import { LEG_COLORS } from "@/lib/route-colors";

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
}

type SortKey = "score" | "profit" | "daily_profit" | "deadhead";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "profit", label: "Profit" },
  { key: "daily_profit", label: "$/Day" },
  { key: "deadhead", label: "DH %" },
];

function sortRouteChains(chains: RouteChain[], sortBy: SortKey): RouteChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "score": sorted.sort((a, b) => b.route_score - a.route_score); break;
    case "profit": sorted.sort((a, b) => b.profit - a.profit); break;
    case "daily_profit": sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit); break;
    case "deadhead": sorted.sort((a, b) => a.deadhead_pct - b.deadhead_pct); break;
  }
  return sorted;
}

function sortRoundTripChains(chains: RoundTripChain[], sortBy: SortKey): RoundTripChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "score": sorted.sort((a, b) => b.route_score - a.route_score); break;
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

export function LocationSidebar({ location, selectedIndex, onSelectIndex, onClose, onClearFilters, orderCount, maxWeight, isLoading, originFilter, destFilter, costPerMile = 1.5, orderUrlTemplate }: LocationSidebarProps) {
  const { activeCompanyId } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<SortKey>("score");
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

  const itemCount = isRoundTripMode
    ? sortedRoundTrips.length
    : sortedRoutes.length;

  return (
    <div className="flex h-full w-full bg-black/80 border border-white/10 rounded-2xl flex-col overflow-hidden">

      {/* Sort bar + watchlist toggle */}
      {hasResults && !isLoading && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-black/80 rounded-xl mx-2 mt-2">
          <span className="text-xs text-muted-foreground mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortBy(opt.key)}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
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
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors flex items-center gap-1 ${
                showWatchlistOnly
                  ? "bg-amber-500/15 border border-amber-500/30 text-amber-500"
                  : "border border-input hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <BookmarkIcon className="h-3 w-3" />
              {watchlist.size}
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
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
          ? sortedRoundTrips.map((chain, i) => (
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
              />
            ))
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
    route_score: route.route_score,
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

  // Compute overall date range (first pickup to last delivery)
  const startDates = chain.legs
    .flatMap((l) => [l.pickup_date_early])
    .filter(Boolean) as string[];
  const endDates = chain.legs
    .flatMap((l) => [l.delivery_date_late, l.delivery_date_early, l.pickup_date_late])
    .filter(Boolean) as string[];
  const dateRange = startDates.length > 0 && endDates.length > 0
    ? formatPickupDates(
        startDates.reduce((a, b) => (a < b ? a : b)),
        endDates.reduce((a, b) => (a > b ? a : b)),
      )
    : "";

  const [showCosts, setShowCosts] = useState(false);
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;

  return (
    <div
      data-route-idx={routeIdx}
      onClick={onClick}
      className={`rounded-xl bg-black/80 cursor-pointer transition-colors ${
        isSelected ? "ring-1 ring-cyan-500" : "hover:bg-black/90"
      }`}
    >
      <div className="p-3">
        {/* Best match badge */}
        {rank === 1 && (
          <div className="mb-3">
            <span className="shrink-0 inline-block rounded-full bg-green-500/15 border border-green-500/30 px-2.5 py-0.5 text-xs font-medium text-green-500">
              Best match
            </span>
          </div>
        )}

        {/* 5 key metrics + bookmark */}
        <div className="flex justify-around text-center items-center">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
            <p className={`text-lg font-bold tabular-nums ${chain.route_score >= 70 ? "text-green-500" : chain.route_score >= 40 ? "text-yellow-500" : "text-red-500"}`}>{chain.route_score}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className={`text-lg font-bold tabular-nums ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">$/Day</p>
            <p className={`text-lg font-bold tabular-nums ${chain.daily_net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(chain.daily_net_profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">DH %</p>
            <p className={`text-lg font-bold tabular-nums ${chain.deadhead_pct > 30 ? "text-yellow-500" : ""}`}>
              {chain.deadhead_pct.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(chain.total_pay)}</p>
          </div>
          {onToggleWatchlist && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleWatchlist(); }}
              className="shrink-0 p-1 rounded transition-colors hover:bg-muted"
            >
              <BookmarkIcon className={`h-6 w-6 ${isWatchlisted ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>

        {/* Secondary info pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
            {formatRpm(chain.effective_rpm)} net
          </span>
          <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
            {chain.estimated_days} day{chain.estimated_days !== 1 ? "s" : ""} · {chain.total_miles.toLocaleString()} mi
          </span>
          {dateRange && (
            <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
              {dateRange}
            </span>
          )}
        </div>
      </div>

      {/* Route timeline (expanded) */}
      {isSelected && (() => {
        const costPerDhMile = chain.total_deadhead_miles > 0
          ? chain.estimated_deadhead_cost / chain.total_deadhead_miles
          : 0;
        const firstLeg = chain.legs[0];
        const lastLeg = chain.legs[chain.legs.length - 1];
        const startDh = firstLeg?.deadhead_miles ?? 0;
        // Return deadhead = total - start - sum of between-leg deadheads
        const betweenDh = chain.legs.slice(1).reduce((sum, l) => sum + l.deadhead_miles, 0);
        const returnDh = Math.max(0, chain.total_deadhead_miles - startDh - betweenDh);
        const origin = originCity || "Origin";
        const returnCity = destCity || origin;

        return (
          <div className="border-t p-3 space-y-3">
            {/* Cost breakdown */}
            <div className="text-sm space-y-2">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={(e) => { e.stopPropagation(); setShowCosts(!showCosts); }}
              >
                <span>Cost breakdown</span>
                {showCosts ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
              </button>
              {showCosts && (
                <div className="pl-4 inline-grid grid-cols-[8rem_auto] gap-x-4 gap-y-1 text-muted-foreground">
                  <span>Fuel</span><span className="text-right">{formatCurrency(chain.cost_breakdown.fuel)}</span>
                  <span>Maintenance</span><span className="text-right">{formatCurrency(chain.cost_breakdown.maintenance)}</span>
                  <span>Tires</span><span className="text-right">{formatCurrency(chain.cost_breakdown.tires)}</span>
                  <span>Daily costs</span><span className="text-right">{formatCurrency(chain.cost_breakdown.daily_costs)}</span>
                  <span className="font-medium text-foreground border-t border-border pt-1">Total</span>
                  <span className="text-right font-medium text-foreground border-t border-border pt-1">{formatCurrency(chain.cost_breakdown.total)}</span>
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-muted-foreground">Route</p>
            <div className="relative ml-[7px]">
              <div className="absolute left-0 top-[6px] bottom-[6px] w-px bg-muted-foreground/30" />

              {/* Start deadhead: origin → first pickup */}
              {startDh > 0 && (
                <div className="flex items-center gap-3 py-2 relative">
                  <div className="relative z-10 -ml-[3px] h-2 w-2 rounded-full border-2 border-muted-foreground bg-card shrink-0" />
                  <div className="flex-1 flex items-center justify-between text-base text-muted-foreground">
                    <span>{origin} → {firstLeg.origin_city}</span>
                    <span className="text-yellow-500">−{formatCurrency(startDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}

              {chain.legs.map((leg: RoundTripLeg, legIdx: number) => {
                const color = LEG_COLORS[legIdx % LEG_COLORS.length];
                const showBetweenDh = leg.deadhead_miles > 0 && legIdx > 0;

                return (
                  <div key={leg.leg_number}>
                    {/* Between-leg deadhead */}
                    {showBetweenDh && (
                      <div className="flex items-center gap-3 py-2 relative">
                        <div className="relative z-10 -ml-[3px] h-2 w-2 rounded-full border-2 border-muted-foreground bg-card shrink-0" />
                        <div className="flex-1 flex items-center justify-between text-base text-muted-foreground">
                          <span>{chain.legs[legIdx - 1].destination_city} → {leg.origin_city}</span>
                          <span className="text-yellow-500">−{formatCurrency(leg.deadhead_miles * costPerDhMile)} DH</span>
                        </div>
                      </div>
                    )}

                    {/* Leg */}
                    <div className="flex items-start gap-3 py-2 relative">
                      <div
                        className="relative z-10 -ml-[4px] mt-1 h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-base flex items-center gap-1">
                            {leg.order_id && orderUrlTemplate ? (
                              <a
                                href={orderUrlTemplate.replace('{{ORDER_ID}}', leg.order_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {leg.origin_city} → {leg.destination_city}
                              </a>
                            ) : (
                              <>{leg.origin_city} → {leg.destination_city}</>
                            )}
                            {leg.lane_rank != null && <FlameIcon className="h-5 w-5 text-orange-400" />}
                            {leg.order_id && leg.type === "firm" && onShowComments && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onShowComments(leg.order_id!); }}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="View comments"
                              >
                                <ClipboardListIcon className="h-4 w-4" />
                              </button>
                            )}
                          </p>
                          <span className={`shrink-0 text-base font-semibold ${
                            leg.type === "speculative" ? "text-muted-foreground" : "text-green-500"
                          }`}>
                            {leg.type === "speculative" ? `~${formatCurrency(leg.pay)}` : formatCurrency(leg.pay)}
                          </span>
                        </div>
                        {leg.type === "firm" ? (
                          <div className="text-base text-muted-foreground mt-0.5 space-y-0.5">
                            <p>{[leg.weight != null ? `${leg.weight.toLocaleString()} lbs` : null, leg.miles != null ? `${leg.miles.toLocaleString()} mi` : null, leg.miles > 0 ? `$${(leg.pay / leg.miles).toFixed(2)}/mi` : null, leg.order_id].filter(Boolean).join(" · ")}</p>
                            {(leg.pickup_date_early || leg.delivery_date_early) && (
                              <div className="text-sm">
                                {leg.pickup_date_early && <p>Pickup: {formatDateRange(leg.pickup_date_early, leg.pickup_date_late)}</p>}
                                {leg.delivery_date_early && <p>Delivery: {formatDateRange(leg.delivery_date_early, leg.delivery_date_late)}</p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-base text-muted-foreground mt-0.5">
                            {[`${leg.miles.toLocaleString()} mi`, leg.lane_confidence ? `${leg.lane_confidence.loads_per_week.toFixed(1)} loads/wk` : null].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {leg.type === "speculative" && leg.lane_confidence && (
                          <div className="mt-1">
                            <ConfidenceBadge score={leg.lane_confidence.confidence_score} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Return deadhead: last dropoff → origin (round-trip) or → destination (one-way) */}
              {returnDh > 0 && (
                <div className="flex items-center gap-3 py-2 relative">
                  <div className="relative z-10 -ml-[3px] h-2 w-2 rounded-full border-2 border-muted-foreground bg-card shrink-0" />
                  <div className="flex-1 flex items-center justify-between text-base text-muted-foreground">
                    <span>{lastLeg.destination_city} → {returnCity}</span>
                    <span className="text-yellow-500">−{formatCurrency(returnDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
