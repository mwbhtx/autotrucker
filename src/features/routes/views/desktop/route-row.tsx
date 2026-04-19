"use client";

import { BookmarkIcon } from "lucide-react";
import type { RouteChain } from "@/core/types";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatRpm } from "@/core/utils/route-helpers";

interface RouteRowProps {
  chain: RouteChain;
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
  const firmLegs = chain.legs;
  const profit = chain.profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);
  return (
    <div
      data-route-idx={routeIdx}
      className={`cursor-pointer transition-colors ${
        isSelected ? "bg-surface-elevated" : "hover:bg-surface-elevated/50"
      }`}
      onClick={onClick}
    >
      <div className="flex justify-around text-center items-start px-4 py-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">$/Day</p>
          <p className={`text-lg font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)} bg-black px-2 py-0.5 inline-block`}>
            {formatCurrency(chain.daily_net_profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{chain.estimated_days.toFixed(1)} days est.</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Profit</p>
          <p className={`text-lg font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)} bg-black px-2 py-0.5 inline-block`}>
            {formatCurrency(profit)}
          </p>
          <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{formatCurrency(chain.total_pay)} gross</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Net/mi</p>
          <p className="text-lg font-bold tabular-nums text-white bg-black px-2 py-0.5 inline-block">
            {formatRpm(chain.effective_rpm)}
          </p>
          {avgLoadedRpm !== null && (
            <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">${avgLoadedRpm.toFixed(2)}/mi loaded</p>
          )}
        </div>
        <div className="hidden">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Miles</p>
          <p className="text-lg font-bold tabular-nums">{chain.total_miles.toLocaleString()}</p>
          <p className="text-xs tabular-nums mt-0.5 text-muted-foreground">{chain.deadhead_pct.toFixed(0)}% DH</p>
        </div>
      </div>
    </div>
  );
}
