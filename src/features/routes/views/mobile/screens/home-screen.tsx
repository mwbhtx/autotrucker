"use client";

import { Search, Clock } from "lucide-react";
import { useRecentSearches, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";

interface HomeScreenProps {
  onSearchBarTap: () => void;
  onFiltersTap: () => void;
  onRecentTap: (search: RecentSearch) => void;
}

function formatTripMode(mode: "one_way" | "round_trip"): string {
  return mode === "round_trip" ? "Round trip" : "One way";
}

/** Strip country from place label — "Houston, Texas, United States" → "Houston, Texas" */
function shortLabel(label: string): string {
  return label.split(",").slice(0, 2).map(s => s.trim()).join(", ");
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
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
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
          <div className="space-y-3">
            {recentSearches.map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => onRecentTap(search)}
                className="flex w-full rounded-xl border border-white/10 bg-card p-4 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <span className="text-sm font-bold text-primary uppercase tracking-wider">
                    {formatTripMode(search.tripMode)}
                  </span>
                  <div className="text-base">
                    <div>
                      <span className="text-muted-foreground">Origin: </span>
                      <span className="font-medium">{shortLabel(search.origin.label)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Destination: </span>
                      <span className="font-medium">{shortLabel(search.destination.label)}</span>
                    </div>
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
