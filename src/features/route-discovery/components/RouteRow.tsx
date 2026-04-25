"use client";

import type { DiscoveredRoute } from "@/core/types";
import { LEG_COLORS } from "@/core/utils/route-colors";
import { cn } from "@/core/utils";

interface Props {
  route: DiscoveredRoute;
  index: number;
  selected: boolean;
  onClick: () => void;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtRpm = (n: number) => `$${n.toFixed(2)}/mi`;

const fmtPct = (n: number) => `${Math.round(n)}%`;

export function RouteRow({ route, index, selected, onClick }: Props) {
  const orders = route.orders;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all",
        "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "bg-accent shadow-md border-l-4"
          : "bg-card border-l border-border",
      )}
      style={
        selected
          ? { borderLeftColor: LEG_COLORS[index % LEG_COLORS.length] }
          : undefined
      }
    >
      {/* Lane sequence chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {orders.map((o, i) => (
          <span key={`o-${i}`} className="contents">
            {i === 0 && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${LEG_COLORS[i % LEG_COLORS.length]}33`,
                  color: LEG_COLORS[i % LEG_COLORS.length],
                }}
              >
                {o.origin_anchor.display_city ?? "?"},{" "}
                {o.origin_anchor.display_state ?? "?"}
              </span>
            )}
            <span className="text-muted-foreground text-sm">→</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${LEG_COLORS[(i + 1) % LEG_COLORS.length]}33`,
                color: LEG_COLORS[(i + 1) % LEG_COLORS.length],
              }}
            >
              {o.destination_anchor.display_city ?? "?"},{" "}
              {o.destination_anchor.display_state ?? "?"}
            </span>
          </span>
        ))}
      </div>

      {/* Key metrics row */}
      <div className="flex flex-wrap items-baseline gap-4 text-sm">
        <span className="text-lg font-semibold">
          {fmtRpm(route.all_in_gross_rpm)} all-in
        </span>
        <span className="text-muted-foreground">
          {fmtPct(route.all_in_deadhead_pct)} deadhead
        </span>
        <span className="text-muted-foreground">
          {fmtMoney(route.total_pay)} typical
        </span>
        <span className="text-muted-foreground">
          {route.estimated_days.toFixed(1)} days
        </span>
        <span title="Predicted likelihood that all orders are available within wait tolerance">
          {fmtPct(route.composite_reliability * 100)} reliable
        </span>
      </div>
    </button>
  );
}
