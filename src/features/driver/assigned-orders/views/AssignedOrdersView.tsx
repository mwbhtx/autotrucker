"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAssignedOrders } from "../api";
import type { AssignedOrder } from "../types";
import { AssignedOrdersTable } from "../components/AssignedOrdersTable";
import {
  AssignedOrdersFilterStrip,
  type AssignedOrdersFilter,
} from "../components/AssignedOrdersFilterStrip";
import { RefreshButton } from "../components/RefreshButton";

export function AssignedOrdersView() {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<AssignedOrdersFilter>("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAssignedOrders();
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const visibleOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const summary = useMemo(() => {
    const withDetails = visibleOrders.filter((o) => o.has_order_details);
    const totalPay = withDetails.reduce((a, o) => a + (o.pay ?? 0), 0);
    const totalMiles = withDetails.reduce(
      (a, o) => a + (o.loaded_miles ?? 0),
      0,
    );
    const avgRate = totalMiles > 0 ? totalPay / totalMiles : 0;
    return { totalPay, totalMiles, avgRate };
  }, [visibleOrders]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <AssignedOrdersFilterStrip value={filter} onChange={setFilter} />
        <RefreshButton onRefreshed={fetchOrders} />
      </div>

      <div className="flex flex-wrap gap-6 rounded-md border border-border bg-accent/30 px-4 py-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Pay
          </div>
          <div className="text-lg font-semibold tabular-nums">
            ${summary.totalPay.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Loaded Miles
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {summary.totalMiles}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Avg Rate/Mi
          </div>
          <div className="text-lg font-semibold tabular-nums">
            ${summary.avgRate.toFixed(2)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : visibleOrders.length === 0 ? (
        <div className="text-sm text-muted-foreground">No orders.</div>
      ) : (
        <AssignedOrdersTable orders={visibleOrders} />
      )}
    </div>
  );
}
