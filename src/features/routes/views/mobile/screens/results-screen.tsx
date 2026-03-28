"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { RouteCard } from "@/features/routes/components/route-card";
import type { RouteChain, RoundTripChain } from "@/core/types";

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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFiltersTap();
            }}
            className="rounded-full p-1 hover:bg-white/10 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

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
          chains.map((chain, i) => (
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
