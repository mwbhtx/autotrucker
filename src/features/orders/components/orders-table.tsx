"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/web/components/ui/table";
import { Button } from "@/platform/web/components/ui/button";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { Badge } from "@/platform/web/components/ui/badge";
import { Separator } from "@/platform/web/components/ui/separator";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { StopoffsTable } from "@/features/orders/components/stopoffs-table";
import { useOrder, useTask } from "@/core/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import type { Order } from "@/core/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateRange(early?: string | null, late?: string | null): string {
  if (!early) return "—";
  const fmtDateTime = (d: string) => {
    const date = new Date(d);
    const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${day} ${time}`;
  };
  if (!late) return fmtDateTime(early);
  return `${fmtDateTime(early)} – ${fmtDateTime(late)}`;
}

function formatWeight(lbs: number | undefined): string {
  if (lbs == null) return "—";
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`;
  return String(lbs);
}

interface OrdersTableProps {
  companyId: string;
  orders: Order[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onClearFilters?: () => void;
  error: Error | null;
  orderUrlTemplate?: string;
  /** Dim rows with order_status='closed'. On the Board this signals a
   *  closed load in a mixed list. On the Driver page every row is closed
   *  (past loads), so dimming them hides everything — set false there. */
  dimClosed?: boolean;
}

export function OrdersTable({
  companyId,
  orders,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onClearFilters,
  error,
  orderUrlTemplate,
  dimClosed = true,
}: OrdersTableProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="rounded-lg border p-8 text-center text-destructive">
        Failed to load data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Order #</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Pickup</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead className="text-right">Pay</TableHead>
            <TableHead className="text-right">Miles</TableHead>
            <TableHead className="text-right">$/Mi</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead>Trailer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: 11 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center">
                <div className="space-y-2">
                  <p className="text-muted-foreground">No orders found.</p>
                  {onClearFilters && (
                    <Button variant="outline" size="sm" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.order_id;
            const isClosed = dimClosed && order.order_status === "closed";
            return (
              <Fragment key={order.order_id}>
                <TableRow
                  className={`cursor-pointer hover:bg-muted/50 ${isClosed ? "opacity-50" : ""}`}
                  onClick={() =>
                    setExpandedOrderId(isExpanded ? null : order.order_id)
                  }
                >
                  <TableCell className="w-8 px-2">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {orderUrlTemplate ? (
                      <a
                        href={orderUrlTemplate.replace("{{ORDER_ID}}", order.order_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.order_id}
                      </a>
                    ) : (
                      order.order_id
                    )}
                  </TableCell>
                  <TableCell>
                    {order.origin_city}, {order.origin_state}
                  </TableCell>
                  <TableCell>
                    {order.destination_city}, {order.destination_state}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateRange(order.pickup_date_early_local, order.pickup_date_late_local)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateRange(order.delivery_date_early_local, order.delivery_date_late_local)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.pay)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.miles?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.rate_per_mile)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatWeight(order.weight)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.trailer_type?.split(" - ")[0] ?? order.trailer_type}</Badge>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow key={`${order.order_id}-detail`}>
                    <TableCell colSpan={11} className="bg-muted/30 p-0">
                      <InlineDetail companyId={companyId} order={order} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {hasNextPage && orders.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

function InlineDetail({ companyId, order }: { companyId: string; order: Order }) {
  const queryClient = useQueryClient();
  const { data: fullOrder } = useOrder(companyId, order.order_id);
  const [taskId, setTaskId] = useState<string | null>(null);
  const { data: task } = useTask(taskId);

  // If the order response indicates a task was created, begin polling
  useEffect(() => {
    if (fullOrder?.task_status === "task_created" && fullOrder.task_id) {
      setTaskId(fullOrder.task_id);
    }
  }, [fullOrder?.task_status, fullOrder?.task_id]);

  // When task completes, refetch the order
  useEffect(() => {
    if (task?.task_status === "completed") {
      setTaskId(null);
      queryClient.invalidateQueries({
        queryKey: ["orders", companyId, order.order_id],
      });
    }
  }, [task?.task_status, companyId, order.order_id, queryClient]);

  const isTaskPending =
    taskId != null && task?.task_status !== "completed" && task?.task_status !== "failed";
  const taskFailed = task?.task_status === "failed";
  const hasDetails = fullOrder?.has_details === true;
  const isRemoved = fullOrder?.order_status === "closed";

  return (
    <div className="p-4 space-y-4">
      {/* Order attributes grid */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <DetailField label="Route" value={`${order.origin_city}, ${order.origin_state} → ${order.destination_city}, ${order.destination_state}`} />
        <DetailField label="Pay / Rate" value={`${formatCurrency(order.pay)} (${formatCurrency(order.rate_per_mile)}/mi)`} />
        <DetailField label="Miles" value={order.miles?.toLocaleString() ?? "—"} />
        <DetailField label="Weight" value={order.weight != null ? `${order.weight.toLocaleString()} lbs` : "—"} />
        <DetailField label="Trailer" value={order.trailer_type ?? "—"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <DetailField label="Pickup Early" value={formatDateRange(order.pickup_date_early_local)} />
        <DetailField label="Pickup Late" value={formatDateRange(order.pickup_date_late_local)} />
        <DetailField label="Delivery Early" value={formatDateRange(order.delivery_date_early_local)} />
        <DetailField label="Delivery Late" value={formatDateRange(order.delivery_date_late_local)} />
        <DetailField label="Status" value={order.order_status === "closed" ? "Closed" : "Open"} />
      </div>

      {/* Boolean flags */}
      <div className="flex flex-wrap gap-2">
        {order.hazmat && <Badge variant="destructive">Hazmat</Badge>}
        {order.twic && <Badge variant="secondary">TWIC</Badge>}
        {order.team_load && <Badge variant="secondary">Team</Badge>}
        {order.ltl && <Badge variant="secondary">LTL</Badge>}
        {order.ramps_required && <Badge variant="secondary">Ramps</Badge>}
        {order.top_100_customer && <Badge variant="secondary">Top 100</Badge>}
        {order.tarp_height != null && <Badge variant="secondary">Tarp {order.tarp_height}&quot;</Badge>}
      </div>

      <Separator />

      {/* Task polling */}
      {isTaskPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Fetching order details...
        </div>
      )}

      {taskFailed && (
        <p className="text-sm text-destructive">
          Failed to fetch details{task?.error ? `: ${task.error}` : "."}
        </p>
      )}

      {/* Enriched detail fields */}
      {!isTaskPending && hasDetails && fullOrder && (
        <div className="space-y-4">
          {fullOrder.commodity && (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <DetailField label="Commodity" value={fullOrder.commodity} />
              {fullOrder.feet_remaining && <DetailField label="Feet Remaining" value={fullOrder.feet_remaining} />}

            </div>
          )}

          {fullOrder.comments && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Comments</p>
                <p className="text-sm whitespace-pre-wrap">{fullOrder.comments}</p>
              </div>
            </>
          )}

          {fullOrder.stopoffs && fullOrder.stopoffs.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Stops</p>
                <StopoffsTable stopoffs={fullOrder.stopoffs} />
              </div>
            </>
          )}
        </div>
      )}

      {isRemoved && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="destructive">Unavailable</Badge>
          <span className="text-muted-foreground">
            This order is no longer available — it may have been picked up by a driver.
          </span>
        </div>
      )}

      {!isTaskPending && !hasDetails && !taskFailed && !isRemoved && (
        <p className="text-sm text-muted-foreground">
          Details not yet available for this order.
        </p>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
