"use client";

import { MapPin, TrendingUp, Truck } from "lucide-react";
import { cn } from "@/core/utils";
import type { RouteChain, RoundTripChain } from "@/core/types";

interface RouteCardProps {
  chain: RouteChain | RoundTripChain;
  isRoundTrip: boolean;
  onClick: () => void;
  className?: string;
}

function getOriginCity(chain: RouteChain | RoundTripChain): string {
  const firstLeg = chain.legs[0];
  if (!firstLeg) return "Unknown";
  return firstLeg.origin_city ?? "Unknown";
}

function getDestCity(chain: RouteChain | RoundTripChain): string {
  const lastLeg = chain.legs[chain.legs.length - 1];
  if (!lastLeg) return "Unknown";
  return lastLeg.destination_city ?? "Unknown";
}

function getTotalMiles(chain: RouteChain | RoundTripChain): number {
  return chain.legs.reduce((sum, leg) => sum + (leg.miles ?? 0), 0);
}

function getDailyProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("daily_net_profit" in chain && typeof chain.daily_net_profit === "number") {
    return chain.daily_net_profit;
  }
  return null;
}

function getDeadheadPct(chain: RouteChain | RoundTripChain): number | null {
  if ("deadhead_pct" in chain && typeof chain.deadhead_pct === "number") {
    return chain.deadhead_pct;
  }
  return null;
}

export function RouteCard({ chain, isRoundTrip, onClick, className }: RouteCardProps) {
  const origin = getOriginCity(chain);
  const dest = getDestCity(chain);
  const miles = getTotalMiles(chain);
  const dailyProfit = getDailyProfit(chain);
  const deadhead = getDeadheadPct(chain);
  const legCount = chain.legs.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-white/10 bg-card p-4 transition-colors active:bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium truncate">
          {origin} → {dest}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {isRoundTrip ? "Round trip" : "One way"}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {dailyProfit !== null && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className={cn("font-semibold", dailyProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
              ${Math.round(dailyProfit)}/day
            </span>
          </span>
        )}
        <span>{miles.toLocaleString()} mi</span>
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {legCount} {legCount === 1 ? "leg" : "legs"}
        </span>
        {deadhead !== null && (
          <span>{Math.round(deadhead)}% DH</span>
        )}
      </div>
    </button>
  );
}
