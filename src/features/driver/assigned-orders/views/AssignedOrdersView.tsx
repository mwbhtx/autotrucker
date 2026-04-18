"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/platform/web/components/ui/input";
import { listAssignedOrders } from "../api";
import type { AssignedOrder } from "../types";
import { AssignedOrdersTable } from "../components/AssignedOrdersTable";

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function AssignedOrdersView() {
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listAssignedOrders(from, to)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [from, to]);

  const summary = useMemo(() => {
    const totalPay = orders.reduce((a, o) => a + (o.truck_pay ?? 0), 0);
    const totalMiles = orders.reduce((a, o) => a + (o.loaded_miles ?? 0), 0);
    const avgRate = totalMiles > 0 ? totalPay / totalMiles : 0;
    return { totalPay, totalMiles, avgRate };
  }, [orders]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">From</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">To</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-6 rounded-md border border-border bg-accent/30 px-4 py-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Truck Pay
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
      ) : orders.length === 0 ? (
        <div className="text-sm text-muted-foreground">No orders in range.</div>
      ) : (
        <AssignedOrdersTable orders={orders} />
      )}
    </div>
  );
}
