"use client";

import { Search, SlidersHorizontal, ArrowRight, Clock } from "lucide-react";
import { useRecentSearches, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";

interface HomeScreenProps {
  onSearchBarTap: () => void;
  onFiltersTap: () => void;
  onRecentTap: (search: RecentSearch) => void;
}

function formatTripMode(mode: "one_way" | "round_trip"): string {
  return mode === "round_trip" ? "Round trip" : "One way";
}

export function HomeScreen({ onSearchBarTap, onFiltersTap, onRecentTap }: HomeScreenProps) {
  const { data: recentSearches, isLoading } = useRecentSearches();

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
          <span className="flex-1 text-sm text-muted-foreground">Search Routes</span>
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

      {/* Recent Searches */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Recent Searches
        </h2>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (!recentSearches || recentSearches.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground/50">No recent searches</p>
          </div>
        )}

        {!isLoading && recentSearches && recentSearches.length > 0 && (
          <div className="space-y-2">
            {recentSearches.map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => onRecentTap(search)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-card p-3 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {formatTripMode(search.tripMode)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="truncate">{search.origin.label}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{search.destination.label}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
