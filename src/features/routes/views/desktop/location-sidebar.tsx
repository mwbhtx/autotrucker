"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { XIcon, ChevronRightIcon, ChevronLeftIcon, FlameIcon, BookmarkIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/platform/web/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/platform/web/components/ui/tooltip";
import { useAuth } from "@/core/services/auth-provider";
import { fetchApi } from "@/core/services/api";
import type { RouteChain, RouteLeg, LocationGroup } from "@/core/types";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { DEFAULT_COST_PER_MILE, calcAvgLoadedRpm, ROUTE_SORT_OPTIONS, DEFAULT_SORT_KEY } from "@mwbhtx/haulvisor-core";
import type { RouteSortKey } from "@mwbhtx/haulvisor-core";
import { LEG_COLORS } from "@/core/utils/route-colors";
import { rateColor, netRateColor, routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatDateTime, formatDateRange, formatDate, formatRpm } from "@/core/utils/route-helpers";
import { sortRouteChains } from "@/features/routes/utils/sort-options";

function formatPickupDates(early?: string, late?: string): string {
  if (!early) return "";
  const e = formatDate(early);
  if (!late || late === early) return e;
  const l = formatDate(late);
  return e === l ? e : `${e}–${l}`;
}

interface LocationSidebarProps {
  location: LocationGroup;
  selectedIndex: number;
  onSelectIndex: (index: number, legs?: import("@/core/utils/map/draw-route").DrawableRouteLeg[]) => void;
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



/** Unique key for a route chain based on its leg order IDs */
function routeKey(legs: { order_id?: string }[]): string {
  return legs.map((l) => l.order_id ?? "spec").join("|");
}

export function LocationSidebar({ location, selectedIndex, onSelectIndex, onClose, onClearFilters, orderCount, maxWeight, isLoading, originFilter, destFilter, costPerMile = DEFAULT_COST_PER_MILE, orderUrlTemplate, onHoverLeg }: LocationSidebarProps) {
  const { activeCompanyId } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<RouteSortKey>(DEFAULT_SORT_KEY);
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
  const hasResults = location.routeChains.length > 0;

  const allSorted = sortRouteChains(location.routeChains, sortBy);

  const sorted = showWatchlistOnly
    ? allSorted.filter((c) => watchlist.has(routeKey(c.legs)))
    : allSorted;

  const itemCount = sorted.length;

  // Sync the map to show the correct sorted route when index is 0
  // (parent can't know sort order, so sidebar pushes the sorted legs)
  useEffect(() => {
    if (selectedIndex !== 0 || isLoading) return;
    const firstChain = sorted[0];
    if (firstChain) {
      onSelectIndex(0, firstChain.legs);
    }
  }, [selectedIndex, isLoading, sortBy, sorted, onSelectIndex]);

  return (
    <div className="flex h-full w-full bg-card/95 backdrop-blur flex-col overflow-hidden relative">

      {/* Sort bar + watchlist toggle */}
      {hasResults && !isLoading && (
        <div className="flex items-center gap-1.5 p-3 bg-sidebar">
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

      {/* Scrollable order/route list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ scrollPadding: "8px" }}>
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
            <p className="text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap">0 Matches</p>
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
        ) : sorted.map((chain, i) => (
              <RouteChainCard
                key={`${chain.legs[0]?.order_id ?? i}-${i}`}
                chain={chain}
                rank={i + 1}
                routeIdx={i}
                isSelected={i === selectedIndex}
                onClick={() => onSelectIndex(i === selectedIndex ? -1 : i, i === selectedIndex ? undefined : chain.legs)}
                maxWeight={maxWeight}
                originCity={originFilter?.city ?? location.city}
                destCity={destFilter?.city}
                isWatchlisted={watchlist.has(routeKey(chain.legs))}
                onToggleWatchlist={() => toggleWatchlist(routeKey(chain.legs))}
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

/* ---- Route chain card ---- */

function RouteChainCard({
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
  chain: RouteChain;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
  maxWeight?: number | null;
  originCity?: string;
  /** Destination city label. When set, return DH targets this instead of origin. */
  destCity?: string;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  routeIdx?: number;
  orderUrlTemplate?: string;
  onShowComments?: (orderId: string) => void;
  onHoverLeg?: (legIndex: number | null) => void;
  costPerMile: number;
}) {
  const firmLegs = chain.legs;

  // Compute overall date range: first pickup → estimated arrival at final destination
  const startDates = chain.legs
    .flatMap((l) => [l.pickup_date_early_local])
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
      .flatMap((l) => [l.delivery_date_late_local, l.delivery_date_early_local, l.pickup_date_late_local])
      .filter(Boolean) as string[];
    return endDates.length > 0 ? endDates.reduce((a, b) => (a > b ? a : b)) : undefined;
  })();
  const dateRange = firstPickup
    ? formatPickupDates(firstPickup, estimatedEnd ?? fallbackEnd)
    : "";

  const [showInspector, setShowInspector] = useState(false);
  const profit = chain.profit;

  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);

  useEffect(() => {
    if (!isSelected) setShowInspector(false);
  }, [isSelected]);

  return (
    <div
      data-route-idx={routeIdx}
      className={`relative flex overflow-hidden border-b border-border ${
        isSelected ? "bg-surface-elevated" : ""
      }`}
    >
      {/* Route details */}
      <div
        className={`flex-1 min-w-0 transition-colors ${
          isSelected ? "" : "hover:bg-surface-elevated"
        }`}
      >
        {/* Key metrics + bookmark — click here to toggle selection */}
        <div onClick={onClick} className="flex justify-around text-center items-start px-4 py-3 border-b border-white/[0.05] cursor-pointer">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">$/Day</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatCurrency(chain.daily_net_profit)}
            </p>
            <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{chain.estimated_days.toFixed(1)} days est.</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Profit</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{formatCurrency(chain.total_pay)} gross</p>
            <p className="text-xs tabular-nums text-muted-foreground">{formatCurrency(chain.cost_breakdown.total)} costs</p>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">$/mi deadhead</p>
            <p className={`text-xl font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
              {formatRpm(chain.gross_rpm_total)}
            </p>
            {avgLoadedRpm !== null && (
              <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">${avgLoadedRpm.toFixed(2)}/mi loaded</p>
            )}
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Miles</p>
            <p className="text-xl font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
            <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{chain.deadhead_pct.toFixed(0)}% DH</p>
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


        {/* Route detail (expanded) */}
        {(() => {
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
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isSelected ? "1fr" : "0fr" }}
            >
            <div className="overflow-hidden">
            <div className="border-t border-white/[0.05] bg-surface-overlay">
              {/* Routes header */}
              <div className="px-4 pt-3 pb-1.5 border-b border-white/[0.05]">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Route</p>
              </div>

              {/* Start deadhead */}
              {startDh > 0 && firstLeg.origin_city !== origin && (
                <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-surface-elevated">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px flex-1 bg-white/[0.07]" />
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
                    <div className="w-px flex-1 bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center flex-1 gap-3 py-3">
                    <span className="flex-1 text-base text-muted-foreground">{origin} → {firstLeg.origin_city}</span>
                    <span className="text-base tabular-nums text-negative">−{formatCurrency(startDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}

              {chain.legs.map((leg: RouteLeg, legIdx: number) => {
                const color = LEG_COLORS[legIdx % LEG_COLORS.length];
                const showBetweenDh = leg.deadhead_miles > 0 && legIdx > 0;
                return (
                  <div key={leg.leg_number}>
                    {showBetweenDh && (
                      <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-surface-elevated">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-px flex-1 bg-white/[0.07]" />
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
                          <div className="w-px flex-1 bg-white/[0.07]" />
                        </div>
                        <div className="flex items-center flex-1 gap-3 py-3">
                          <span className="flex-1 text-base text-muted-foreground">
                            {chain.legs[legIdx - 1].destination_city} → {leg.origin_city}
                          </span>
                          <span className="text-base tabular-nums text-negative">
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
                            {leg.order_id && onShowComments && (
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
                          <span className="shrink-0 text-base font-semibold tabular-nums text-positive">
                            {formatCurrency(leg.pay)}
                          </span>
                        </div>
                        <div className="text-sm mt-1 space-y-0.5 text-muted-foreground">
                            <p>
                              {[leg.weight != null ? `${leg.weight.toLocaleString()} lbs` : null, leg.miles != null ? `${leg.miles.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}
                              {leg.miles > 0 && <>{" · "}<span className={rateColor(leg.pay / leg.miles, chain.effective_cost_per_mile ?? costPerMile)}>${(leg.pay / leg.miles).toFixed(2)}/mi</span></>}
                            </p>
                            {(leg.pickup_date_early_local || leg.delivery_date_early_local) && (
                              <div>
                                {leg.pickup_date_early_local && <p>Pickup: {formatDateRange(leg.pickup_date_early_local, leg.pickup_date_late_local)}</p>}
                                {leg.delivery_date_early_local && <p>Delivery: {formatDateRange(leg.delivery_date_early_local, leg.delivery_date_late_local)}</p>}
                              </div>
                            )}
                          </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {returnDh > 0 && lastLeg.destination_city !== returnCity && (
                <div className="flex items-stretch gap-3 pl-4 pr-4 border-b border-white/[0.05] bg-surface-elevated">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px flex-1 bg-white/[0.07]" />
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 bg-surface-elevated shrink-0" />
                    <div className="w-px flex-1 bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center flex-1 gap-3 py-3">
                    <span className="flex-1 text-base text-muted-foreground">{lastLeg.destination_city} → {returnCity}</span>
                    <span className="text-base tabular-nums text-negative">−{formatCurrency(returnDh * costPerDhMile)} DH</span>
                  </div>
                </div>
              )}
            </div>
            </div>
            </div>
          );
        })()}
      </div>

      {/* Right-edge handle — visible when selected, drawer is closed */}
      {isSelected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowInspector(true); }}
          className="flex items-center justify-center w-7 shrink-0 rounded-r-xl bg-surface-elevated hover:bg-surface-overlay border-l border-white/[0.05] transition-colors"
          title="View segment breakdown"
        >
          <ChevronLeftIcon className="h-4 w-4 text-muted-foreground" />
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
            className="flex items-center justify-center w-7 shrink-0 bg-surface-muted hover:bg-surface-muted-hover border-r border-white/[0.05] transition-colors"
            title="Back to route"
          >
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          </button>
          {/* Inspector content */}
          <div className="flex-1 min-w-0 overflow-hidden bg-surface-muted">
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
