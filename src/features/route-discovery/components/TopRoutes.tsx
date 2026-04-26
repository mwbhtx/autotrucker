"use client";

import type { DiscoveredRoute } from "@/core/types";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { useRouteDiscoveryStore } from "../store";
import { cn } from "@/core/utils";

interface Props {
  routes: DiscoveredRoute[];
  isLoading: boolean;
}

function reliabilityColor(r: number): string {
  if (r >= 0.8) return "text-green-600 dark:text-green-400";
  if (r >= 0.6) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function routeLabel(route: DiscoveredRoute): string {
  const anchors = route.orders.flatMap((o, i) =>
    i === 0
      ? [o.origin_anchor, o.destination_anchor]
      : [o.destination_anchor],
  );
  return anchors
    .map((a) => (a.display_city && a.display_state ? `${a.display_city}, ${a.display_state}` : "—"))
    .join(" → ");
}

export function TopRoutes({ routes, isLoading }: Props) {
  const setSelectedRow = useRouteDiscoveryStore((s) => s.setSelectedRow);
  const selectedRowIndex = useRouteDiscoveryStore((s) => s.selectedRowIndex);

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Loading top routes">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" data-testid="skeleton" />
        ))}
      </div>
    );
  }

  if (routes.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Top Routes by Reliability
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-left pb-1 w-6">#</th>
            <th className="text-left pb-1">Route</th>
            <th className="text-right pb-1 w-14">Rel</th>
            <th className="text-right pb-1 w-16">RPM</th>
            <th className="text-right pb-1 w-12">DH%</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route, i) => (
            <tr
              key={route.route_id}
              role="row"
              onClick={() => setSelectedRow(i)}
              className={cn(
                "cursor-pointer hover:bg-muted/50 border-b border-border/50",
                selectedRowIndex === i && "bg-muted",
              )}
            >
              <td className="py-1.5 text-muted-foreground pr-2">{i + 1}</td>
              <td className="py-1.5">
                <span className="truncate block max-w-xs">{routeLabel(route)}</span>
                <span className="text-xs text-muted-foreground">
                  {route.orders.length}-stop
                </span>
              </td>
              <td className={cn("py-1.5 text-right font-medium tabular-nums", reliabilityColor(route.composite_reliability))}>
                {(route.composite_reliability * 100).toFixed(0)}%
              </td>
              <td className="py-1.5 text-right tabular-nums">
                ${route.all_in_gross_rpm.toFixed(2)}
              </td>
              <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                {route.all_in_deadhead_pct.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
