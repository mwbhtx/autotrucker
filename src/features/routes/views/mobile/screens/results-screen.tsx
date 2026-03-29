"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { RouteCard } from "@/features/routes/components/route-card";
import type { RouteChain, RoundTripChain } from "@/core/types";

type SortKey = "profit" | "daily_profit" | "net_per_mile";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "daily_profit", label: "$/Day" },
  { key: "profit", label: "Profit" },
  { key: "net_per_mile", label: "Net/mi" },
];

function sortChains(chains: (RouteChain | RoundTripChain)[], sortBy: SortKey): (RouteChain | RoundTripChain)[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "profit":
      sorted.sort((a, b) => {
        const ap = "firm_profit" in a ? a.firm_profit : a.profit;
        const bp = "firm_profit" in b ? b.firm_profit : b.profit;
        return bp - ap;
      });
      break;
    case "daily_profit":
      sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit);
      break;
    case "net_per_mile":
      sorted.sort((a, b) => b.effective_rpm - a.effective_rpm);
      break;
  }
  return sorted;
}

interface ResultsScreenProps {
  searchText: string;
  chains: (RouteChain | RoundTripChain)[];
  isRoundTrip: boolean;
  isLoading: boolean;
  onSearchBarTap: () => void;
  onFiltersTap: () => void;
  onRouteSelect: (index: number) => void;
}

export function ResultsScreen({
  searchText,
  chains,
  isRoundTrip,
  isLoading,
  onSearchBarTap,
  onFiltersTap,
  onRouteSelect,
}: ResultsScreenProps) {
  const [sortBy, setSortBy] = useState<SortKey>("daily_profit");
  const sortedChains = useMemo(() => sortChains(chains, sortBy), [chains, sortBy]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2">
        <div
          role="button"
          tabIndex={0}
          onClick={onSearchBarTap}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSearchBarTap(); }}
          className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-card px-4 py-3 text-left cursor-pointer"
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm truncate">{searchText}</span>
        </div>
      </div>

      {/* Sort bar */}
      {!isLoading && chains.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-sm text-muted-foreground mr-0.5">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortBy(opt.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                sortBy === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-input hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onFiltersTap}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-full bg-white shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4 text-black" />
          </button>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-2">
        {isLoading && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </>
        )}

        {!isLoading && chains.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground/70 mb-1">No routes found</p>
            <p className="text-xs text-muted-foreground/40">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading &&
          sortedChains.map((chain, i) => (
            <RouteCard
              key={i}
              chain={chain}
              isRoundTrip={isRoundTrip}
              onClick={() => onRouteSelect(i)}
            />
          ))}
      </div>
    </div>
  );
}
