"use client";

import { MapPin, TrendingUp } from "lucide-react";
import { cn } from "@/core/utils";
import { routeProfitColor } from "@/core/utils/rate-color";
import type { RouteChain, RoundTripChain } from "@/core/types";

interface RouteCardProps {
  chain: RouteChain | RoundTripChain;
  isRoundTrip: boolean;
  onClick: () => void;
  className?: string;
}

function getOriginCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[0]?.origin_city ?? "Unknown";
}

function getDestCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[chain.legs.length - 1]?.destination_city ?? "Unknown";
}

function getDailyProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("daily_net_profit" in chain && typeof chain.daily_net_profit === "number") {
    return chain.daily_net_profit;
  }
  return null;
}

function getNetProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("firm_profit" in chain && typeof chain.firm_profit === "number") return chain.firm_profit;
  if ("profit" in chain && typeof chain.profit === "number") return chain.profit;
  return null;
}

function getNetPerMile(chain: RouteChain | RoundTripChain): number | null {
  if ("effective_rpm" in chain && typeof chain.effective_rpm === "number") return chain.effective_rpm;
  return null;
}

export function RouteCard({ chain, isRoundTrip, onClick, className }: RouteCardProps) {
  const origin = getOriginCity(chain);
  const dest = getDestCity(chain);
  const dailyProfit = getDailyProfit(chain);
  const netProfit = getNetProfit(chain);
  const netPerMile = getNetPerMile(chain);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-white/10 bg-card p-4 transition-colors active:bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="text-base font-medium truncate">
          {origin} → {dest}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {isRoundTrip ? "Round trip" : "One way"}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {dailyProfit !== null && (
          <span className="flex items-center gap-1.5">
            <TrendingUp className={cn("h-4 w-4", routeProfitColor(dailyProfit))} />
            <span className={cn("font-semibold", routeProfitColor(dailyProfit))}>
              ${Math.round(dailyProfit)}/day
            </span>
          </span>
        )}
        {netProfit !== null && (
          <span className={cn("font-semibold", dailyProfit !== null ? routeProfitColor(dailyProfit) : "text-muted-foreground")}>
            ${Math.round(netProfit).toLocaleString()}
          </span>
        )}
        {netPerMile !== null && (
          <span className={cn("font-semibold", dailyProfit !== null ? routeProfitColor(dailyProfit) : "text-muted-foreground")}>
            ${netPerMile.toFixed(2)}/mi
          </span>
        )}
      </div>
    </button>
  );
}
