"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, FlameIcon, BookmarkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function formatRpm(value: number): string {
  return `$${value.toFixed(2)}/mi`;
}

/** Convert a one-way RouteChain to RoundTripChain shape for the unified card */
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

/** Unique key for a route chain based on its leg order IDs */
function routeKey(legs: { order_id?: string }[]): string {
  return legs.map((l) => l.order_id ?? "spec").join("|");
}

type SortKey = "score" | "profit" | "daily_profit" | "deadhead";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "profit", label: "Profit" },
  { key: "daily_profit", label: "$/Day" },
  { key: "deadhead", label: "DH %" },
];

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

export type { SortKey };
export { SORT_OPTIONS };

interface MobileCarouselProps {
  location: LocationGroup;
  selectedIndex: number;
  onSelectIndex: (index: number, legs?: import("@/lib/map/draw-route").DrawableRouteLeg[]) => void;
  originCity?: string;
  destCity?: string;
  sortBy: SortKey;
  orderUrlTemplate?: string;
}

export function MobileCarousel({ location, selectedIndex, onSelectIndex, originCity, destCity, sortBy, orderUrlTemplate }: MobileCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Normalize and sort
  const rawChains: RoundTripChain[] = isRoundTripMode
    ? location.roundTripChains
    : location.routeChains.map(routeChainToRoundTrip);

  const sorted = sortRoundTripChains(rawChains, sortBy);
  const chains = showWatchlistOnly
    ? sorted.filter((c) => watchlist.has(routeKey(c.legs)))
    : sorted;

  const itemCount = chains.length;

  // Scroll to selected index when it changes externally
  // +1 offset to skip leading spacer element
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.children[selectedIndex + 1] as HTMLElement | undefined;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedIndex]);

  // Detect which card snapped into view (skip spacer elements at index 0 and last)
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    let closestIndex = 0;
    let closestDist = Infinity;
    const childCount = container.children.length;
    // Skip first and last children (spacers)
    for (let i = 1; i < childCount - 1; i++) {
      const child = container.children[i] as HTMLElement;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - (scrollLeft + containerWidth / 2));
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i - 1; // map back to chain index
      }
    }
    if (closestIndex !== selectedIndex) {
      onSelectIndex(closestIndex, chains[closestIndex]?.legs);
    }
  }, [selectedIndex, onSelectIndex, chains]);

  // Use scrollend for snap detection (with fallback timeout for Safari)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const target = container as EventTarget & HTMLDivElement;

    let scrollTimer: ReturnType<typeof setTimeout>;
    const onScrollEnd = () => handleScroll();
    const onScrollFallback = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleScroll, 150);
    };

    if ("onscrollend" in (target as unknown as Record<string, unknown>)) {
      target.addEventListener("scrollend", onScrollEnd);
    } else {
      target.addEventListener("scroll", onScrollFallback);
    }

    return () => {
      target.removeEventListener("scrollend", onScrollEnd);
      target.removeEventListener("scroll", onScrollFallback);
      clearTimeout(scrollTimer);
    };
  }, [handleScroll]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable carousel */}
      <div
        ref={scrollRef}
        className="flex-1 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none items-end pb-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Leading spacer to center first card */}
        <div className="shrink-0" style={{ width: "calc((100% - 92%) / 2 - 6px)" }} />
        {chains.map((chain, i) => (
          <FullDetailCard
            key={i}
            chain={chain}
            rank={i + 1}
            originCity={originCity}
            destCity={destCity}
            isWatchlisted={watchlist.has(routeKey(chain.legs))}
            onToggleWatchlist={() => toggleWatchlist(routeKey(chain.legs))}
            orderUrlTemplate={orderUrlTemplate}
          />
        ))}
        {/* Trailing spacer to center last card */}
        <div className="shrink-0" style={{ width: "calc((100% - 92%) / 2 - 6px)" }} />
      </div>
    </div>
  );
}

/* ---- Full detail card (matches desktop expanded card) ---- */

function FullDetailCard({
  chain,
  rank,
  originCity,
  destCity,
  isWatchlisted,
  onToggleWatchlist,
  orderUrlTemplate,
}: {
  chain: RoundTripChain;
  rank: number;
  originCity?: string;
  destCity?: string;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  orderUrlTemplate?: string;
}) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;

  const allPickupDates = chain.legs.map((l) => l.pickup_date_early).filter(Boolean) as string[];
  const allEndDates = chain.legs.flatMap((l) => [l.delivery_date_late, l.delivery_date_early, l.pickup_date_late]).filter(Boolean) as string[];
  const startDate = allPickupDates.length > 0 ? formatDate(allPickupDates.reduce((a, b) => (a < b ? a : b))) : "";
  const endDate = allEndDates.length > 0 ? formatDate(allEndDates.reduce((a, b) => (a > b ? a : b))) : "";

  const [showCosts, setShowCosts] = useState(false);


  return (
    <div className="snap-center shrink-0 w-[92%] h-full bg-card border rounded-2xl overflow-y-auto flex flex-col">
      <div className="p-4">
        {/* Score badge + bookmark */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <RouteScoreBadge score={chain.route_score} />
            {startDate && (
              <span className="text-sm text-muted-foreground">{startDate}{endDate ? ` – ${endDate}` : ""}</span>
            )}
          </div>
          {onToggleWatchlist && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleWatchlist(); }}
              className="shrink-0 p-1.5 rounded transition-colors hover:bg-muted"
            >
              <BookmarkIcon className={`h-6 w-6 ${isWatchlisted ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>

        {/* 4 stats in a row — larger */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className={`text-xl font-bold tabular-nums ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>{formatCurrency(profit)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">$/Day</p>
            <p className={`text-xl font-bold tabular-nums ${chain.daily_net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>{formatCurrency(chain.daily_net_profit)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">$/Mi</p>
            <p className="text-xl font-bold tabular-nums">{formatRpm(chain.effective_rpm)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(chain.total_pay)}</p>
          </div>
        </div>

        {/* Route summary pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {chain.total_miles.toLocaleString()} mi total
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {chain.estimated_days}d est.
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-xs ${chain.deadhead_pct > 30 ? "text-yellow-500" : "text-muted-foreground"}`}>
            {chain.deadhead_pct.toFixed(0)}% deadhead
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            {chain.total_deadhead_miles.toLocaleString()} mi DH
          </span>
        </div>
      </div>

      {/* Leg details — full info per leg */}
      <div className="border-t border-border/50 flex-1 flex flex-col gap-3 p-4">
        {chain.legs.map((leg: RoundTripLeg, legIdx: number) => {
          const color = LEG_COLORS[legIdx % LEG_COLORS.length];
          const legLabel = leg.order_id && orderUrlTemplate ? (
            <a
              href={orderUrlTemplate.replace('{{ORDER_ID}}', leg.order_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
            </a>
          ) : (
            <>{leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}</>
          );
          const rpmLeg = leg.miles > 0 ? leg.pay / leg.miles : 0;

          return (
            <div key={leg.leg_number} className="rounded-xl bg-muted/20 border border-border/30 p-3.5">
              {/* Leg header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <p className="font-semibold text-sm leading-tight">{legLabel}</p>
                {leg.lane_rank != null && (
                  <span className="ml-auto text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">#{leg.lane_rank} lane</span>
                )}
              </div>

              {/* Leg stats grid */}
              <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pay</p>
                  <p className="text-base font-semibold tabular-nums">{formatCurrency(leg.pay)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Miles</p>
                  <p className="text-base font-semibold tabular-nums">{leg.miles.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rate</p>
                  <p className="text-base font-semibold tabular-nums">{formatRpm(rpmLeg)}</p>
                </div>
                {leg.weight != null && leg.weight > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p>
                    <p className="text-sm font-medium tabular-nums">{leg.weight.toLocaleString()} lbs</p>
                  </div>
                )}
                {leg.trailer_type && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trailer</p>
                    <p className="text-sm font-medium">{leg.trailer_type}</p>
                  </div>
                )}
                {leg.deadhead_miles > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deadhead</p>
                    <p className="text-sm font-medium tabular-nums">{Math.round(leg.deadhead_miles)} mi</p>
                  </div>
                )}
              </div>

              {/* Dates */}
              {(leg.pickup_date_early || leg.delivery_date_early) && (
                <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-2 gap-2 text-xs">
                  {leg.pickup_date_early && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pickup</p>
                      <p className="text-muted-foreground">{formatDateRange(leg.pickup_date_early, leg.pickup_date_late)}</p>
                    </div>
                  )}
                  {leg.delivery_date_early && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Delivery</p>
                      <p className="text-muted-foreground">{formatDateRange(leg.delivery_date_early, leg.delivery_date_late)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Cost breakdown */}
        {chain.cost_breakdown && (
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3.5">
            <button
              type="button"
              onClick={() => setShowCosts(!showCosts)}
              className="flex items-center justify-between w-full text-xs text-muted-foreground"
            >
              <span className="uppercase tracking-wide font-medium">Est. Costs: {formatCurrency(chain.cost_breakdown.total)}</span>
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${showCosts ? "rotate-180" : ""}`} />
            </button>
            {showCosts && (
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel</span>
                  <span className="tabular-nums">{formatCurrency(chain.cost_breakdown.fuel)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maintenance</span>
                  <span className="tabular-nums">{formatCurrency(chain.cost_breakdown.maintenance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tires</span>
                  <span className="tabular-nums">{formatCurrency(chain.cost_breakdown.tires)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily costs</span>
                  <span className="tabular-nums">{formatCurrency(chain.cost_breakdown.daily_costs)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
