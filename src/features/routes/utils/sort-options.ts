import type { RouteChain, RoundTripChain } from "@/core/types";

export type SortKey = "profit" | "daily_profit" | "net_per_mile";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "daily_profit", label: "$/Day" },
  { key: "profit", label: "Profit" },
  { key: "net_per_mile", label: "Net/mi" },
];

export function sortRouteChains(chains: RouteChain[], sortBy: SortKey): RouteChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "profit": sorted.sort((a, b) => b.profit - a.profit); break;
    case "daily_profit": sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit); break;
    case "net_per_mile": sorted.sort((a, b) => b.effective_rpm - a.effective_rpm); break;
  }
  return sorted;
}

export function sortRoundTripChains(chains: RoundTripChain[], sortBy: SortKey): RoundTripChain[] {
  const sorted = [...chains];
  switch (sortBy) {
    case "profit": sorted.sort((a, b) => b.firm_profit - a.firm_profit); break;
    case "daily_profit": sorted.sort((a, b) => b.daily_net_profit - a.daily_net_profit); break;
    case "net_per_mile": sorted.sort((a, b) => b.effective_rpm - a.effective_rpm); break;
  }
  return sorted;
}
