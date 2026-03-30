"use client";

import { BookmarkIcon } from "lucide-react";
import type { RoundTripChain } from "@/core/types";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatRpm } from "@/core/utils/route-helpers";

interface RouteRowProps {
  chain: RoundTripChain;
  isSelected: boolean;
  onClick: () => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  routeIdx?: number;
}

export function RouteRow({
  chain,
  isSelected,
  onClick,
  isWatchlisted,
  onToggleWatchlist,
  routeIdx,
}: RouteRowProps) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const firmLegs = chain.legs.filter((leg) => leg.type === "firm");
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);
  const suggestedDep = chain.suggested_departure
    ? new Date(chain.suggested_departure)
    : null;
  const depLabel = suggestedDep
    ? `Leave ${suggestedDep.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${suggestedDep.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : null;

  return (
    <div
      data-route-idx={routeIdx}
      className={`cursor-pointer transition-colors ${
        isSelected ? "bg-surface-elevated" : "hover:bg-surface-elevated/50"
      }`}
      onClick={onClick}
    >
      {depLabel && (
        <p className="px-4 pt-2 text-xs text-muted-foreground">{depLabel}</p>
      )}
      <div className="flex justify-around text-center items-start px-4 py-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">$/Day</p>
          <p className={`text-lg font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)} bg-black px-2 py-0.5 inline-block`}>
            {formatCurrency(chain.daily_net_profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{chain.estimated_days.toFixed(1)} days est.</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Profit</p>
          <p className={`text-lg font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)} bg-black px-2 py-0.5 inline-block`}>
            {formatCurrency(profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{formatCurrency(chain.total_pay)} gross</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-text-secondary">Net/mi</p>
          <p className={`text-lg font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)} bg-black px-2 py-0.5 inline-block`}>
            {formatRpm(chain.effective_rpm)}
          </p>
          {avgLoadedRpm !== null && (
            <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">${avgLoadedRpm.toFixed(2)}/mi loaded</p>
          )}
        </div>
        <div className="hidden">
          <p className="text-sm uppercase tracking-wide text-text-secondary">Miles</p>
          <p className="text-lg font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
          <p className="text-xs tabular-nums mt-0.5 text-text-tertiary">{chain.deadhead_pct.toFixed(0)}% DH</p>
        </div>
      </div>
    </div>
  );
}
