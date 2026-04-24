"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BookmarkIcon, DownloadIcon } from "lucide-react";
import type { RouteChain } from "@/core/types";
import { ROUTE_SORT_OPTIONS, DEFAULT_SORT_KEY } from "@mwbhtx/haulvisor-core";
import type { RouteSortKey } from "@mwbhtx/haulvisor-core";
import { sortRouteChains } from "@/features/routes/utils/sort-options";
import { downloadRoutesCsv, type RouteEngine } from "@/features/routes/utils/export-csv";
import { RouteRow } from "./route-row";

/** Unique key for a route chain based on its leg order IDs */
function routeKey(legs: { order_id?: string }[]): string {
  return legs.map((l) => l.order_id ?? "spec").join("|");
}

interface RouteListProps {
  chains: RouteChain[];
  selectedIndex: number;
  onSelectIndex: (index: number, chain: RouteChain | null) => void;
  isLoading?: boolean;
  onClearFilters?: () => void;
  onWatchlistChange?: (watchlist: Set<string>, toggle: (key: string) => void) => void;
  engine?: RouteEngine;
}

export function RouteList({
  chains,
  selectedIndex,
  onSelectIndex,
  isLoading,
  onClearFilters,
  onWatchlistChange,
  engine = "v1",
}: RouteListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<RouteSortKey>(DEFAULT_SORT_KEY);
  const [isExporting, setIsExporting] = useState(false);

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

  useEffect(() => {
    onWatchlistChange?.(watchlist, toggleWatchlist);
  }, [watchlist, toggleWatchlist, onWatchlistChange]);

  const hasResults = chains.length > 0;

  const allSorted = sortRouteChains(chains, sortBy);

  const sorted = showWatchlistOnly
    ? allSorted.filter((c) => watchlist.has(routeKey(c.legs)))
    : allSorted;

  // Reset selection to first row whenever sort order changes
  const prevSortByRef = useRef(sortBy);
  useEffect(() => {
    if (prevSortByRef.current === sortBy) return;
    prevSortByRef.current = sortBy;
    const firstChain = sorted[0] ?? null;
    if (firstChain) onSelectIndex(0, firstChain);
  }, [sortBy, sorted, onSelectIndex]);

  // Scroll selected row into view after selection
  useEffect(() => {
    if (selectedIndex < 0 || !scrollRef.current) return;
    const timer = setTimeout(() => {
      const row = scrollRef.current?.querySelector(`[data-route-idx="${selectedIndex}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  // Sync detail panel / map to show the first *sorted* route
  useEffect(() => {
    if (selectedIndex !== 0 || isLoading) return;
    const firstChain = sorted[0] ?? null;
    if (firstChain) {
      onSelectIndex(0, firstChain);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, isLoading, sortBy, chains]);

  return (
    <div className="flex h-full w-full bg-sidebar flex-col overflow-hidden">
      {/* Sort bar + watchlist toggle */}
      {hasResults && !isLoading && (
        <div className="flex items-center justify-center gap-1.5 p-3 bg-sidebar shrink-0">
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
          <button
            type="button"
            disabled={isExporting}
            onClick={() => {
              setIsExporting(true);
              try { downloadRoutesCsv(allSorted, engine); } finally { setIsExporting(false); }
            }}
            className="rounded-full px-3 py-1 text-sm transition-colors flex items-center gap-1 border border-input hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <DownloadIcon className="h-3 w-3" />
            Export
          </button>
        </div>
      )}

      {/* Scrollable route list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ scrollPadding: "8px" }}>
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
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
            <p className="mt-3 text-base text-foreground/70 leading-relaxed">
              No routes found matching your filters.<br />
              Try adjusting your origin, destination,<br />
              or filter settings.
            </p>
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
        }
      </div>
    </div>
  );
}
