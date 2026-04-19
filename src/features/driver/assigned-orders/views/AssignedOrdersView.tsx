"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listAssignedOrders } from "../api";
import type {
  ActiveSyncTask,
  AssignedOrder,
  SyncAllResponse,
} from "../types";
import { OrdersTable } from "@/features/orders/components/orders-table";
import type { Order } from "@mwbhtx/haulvisor-core";
import {
  AssignedOrdersFilterStrip,
  type AssignedOrdersFilter,
} from "../components/AssignedOrdersFilterStrip";
import { SyncAllButton } from "../components/SyncAllButton";
import { useSettings } from "@/core/hooks/use-settings";

export function AssignedOrdersView() {
  const { data: settings } = useSettings();
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [activeSyncTask, setActiveSyncTask] =
    useState<ActiveSyncTask | null>(null);
  const [nextSyncAvailableAt, setNextSyncAvailableAt] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<AssignedOrdersFilter>("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAssignedOrders();
      setOrders(data.orders);
      setActiveSyncTask(data.active_sync_task);
      setNextSyncAvailableAt(data.next_sync_available_at);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSyncStarted = useCallback((resp: SyncAllResponse) => {
    setNextSyncAvailableAt(resp.next_sync_available_at);
    setActiveSyncTask({
      task_id: resp.task_id,
      task_status: "pending",
      orders_total: resp.orders_total,
      orders_completed: 0,
      updated_at: new Date().toISOString(),
    });
  }, []);

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
        <SyncAllButton
          activeSyncTask={activeSyncTask}
          nextSyncAvailableAt={nextSyncAvailableAt}
          onSyncStarted={handleSyncStarted}
          onSyncFinished={fetchOrders}
        />
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
        <OrdersTable
          companyId=""
          orders={visibleOrders as unknown as Order[]}
          isLoading={false}
          isFetchingNextPage={false}
          hasNextPage={false}
          onLoadMore={() => {}}
          error={null}
          orderUrlTemplate={settings?.order_url_template as string | undefined}
        />
      )}
    </div>
  );
}
