"use client";

import { XIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { RouteDetailPanel } from "@/features/routes/views/desktop/route-detail-panel";
import { useSimulate } from "@/core/hooks/use-simulate";
import { useSettings } from "@/core/hooks/use-settings";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";
import type { Order } from "@/core/types";

/**
 * Sort two orders into the most temporally feasible sequence and detect
 * obvious window incompatibilities before hitting the backend.
 *
 * Feasibility test: for A→B to be possible, A must be deliverable (at its
 * earliest) before B's pickup window closes. If neither A→B nor B→A passes
 * this test, the combination is flagged as infeasible.
 */
function sortForSimulation(a: Order, b: Order): {
  sorted: [Order, Order];
  isInfeasible: boolean;
} {
  const canAB = (() => {
    if (!a.delivery_date_early_utc || !b.pickup_date_late_utc) return true;
    return new Date(a.delivery_date_early_utc) <= new Date(b.pickup_date_late_utc);
  })();

  const canBA = (() => {
    if (!b.delivery_date_early_utc || !a.pickup_date_late_utc) return true;
    return new Date(b.delivery_date_early_utc) <= new Date(a.pickup_date_late_utc);
  })();

  const isInfeasible = !canAB && !canBA;

  if (canAB && !canBA) return { sorted: [a, b], isInfeasible };
  if (canBA && !canAB) return { sorted: [b, a], isInfeasible };

  const aPickup = a.pickup_date_early_utc ? new Date(a.pickup_date_early_utc).getTime() : Infinity;
  const bPickup = b.pickup_date_early_utc ? new Date(b.pickup_date_early_utc).getTime() : Infinity;
  return { sorted: aPickup <= bPickup ? [a, b] : [b, a], isInfeasible };
}

interface SimulatePanelProps {
  selectedOrders: Order[];
  onClose: () => void;
}

export function SimulatePanel({ selectedOrders, onClose }: SimulatePanelProps) {
  const { data: settings } = useSettings();
  const hasHomeBase = !!settings?.home_base_lat && !!settings?.home_base_lng;
  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  const [orderA, orderB] = selectedOrders;
  const { sorted, isInfeasible } = orderA && orderB
    ? sortForSimulation(orderA, orderB)
    : { sorted: [orderA, orderB] as [Order, Order], isInfeasible: false };

  const orderIds = sorted.filter(Boolean).map((o) => o.order_id);

  const canFetch = !isInfeasible && hasHomeBase && orderIds.length === 2;
  const { data: chain, isLoading, error } = useSimulate(orderIds, canFetch);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[600px] bg-background border-l shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Route Simulation
            </p>
            {sorted[0] && sorted[1] && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {sorted[0].origin_city}, {sorted[0].origin_state}
                {" → "}
                {sorted[0].destination_city}, {sorted[0].destination_state}
                {" → "}
                {sorted[1].destination_city}, {sorted[1].destination_state}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {!hasHomeBase && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertCircleIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Set your home base location in Settings to use Route Simulation.
              </p>
            </div>
          )}

          {hasHomeBase && isInfeasible && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertCircleIcon className="h-8 w-8 text-amber-500" />
              <p className="text-sm font-medium">Incompatible time windows</p>
              <p className="text-sm text-muted-foreground">
                These two orders have pickup and delivery windows that cannot
                be combined into a route — neither ordering allows the first
                delivery to complete before the second pickup window closes.
              </p>
            </div>
          )}

          {hasHomeBase && !isInfeasible && isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Simulating route...</p>
            </div>
          )}

          {hasHomeBase && !isInfeasible && !isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertCircleIcon className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                These orders could not be simulated due to scheduling conflicts.
              </p>
            </div>
          )}

          {hasHomeBase && !isInfeasible && !isLoading && !error && chain && (
            <RouteDetailPanel
              chain={chain}
              costPerMile={costPerMile}
              searchParams={null}
              fullWidth
            />
          )}
        </div>
      </div>
    </>
  );
}
