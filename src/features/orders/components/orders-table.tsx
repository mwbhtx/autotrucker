"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { StopoffsTable } from "@/components/orders/stopoffs-table";
import { useOrder, useTask } from "@/lib/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import type { Order } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPickupDate(early: string, late: string): string {
  const fmt = (d: string) => {
    const date = new Date(d);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${m}/${day}`;
  };
  if (early === late) return fmt(early);
  return `${fmt(early)} - ${fmt(late)}`;
}

function formatWeight(lbs: number): string {
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
            <TableHead className="text-right">Pay</TableHead>
            <TableHead className="text-right">Miles</TableHead>
            <TableHead className="text-right">$/M</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead>Trailer</TableHead>
            <TableHead>LTL</TableHead>
            <TableHead>TWIC</TableHead>
            <TableHead>Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: 10 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={13} className="h-24 text-center">
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
            return (
              <Fragment key={order.order_id}>
                <TableRow
                  className={`cursor-pointer hover:bg-muted/50 ${order.order_status === "closed" ? "opacity-50" : ""}`}
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
                  <TableCell className="font-medium">{order.order_id}</TableCell>
                  <TableCell>
                    {order.origin_city}, {order.origin_state}
                  </TableCell>
                  <TableCell>
                    {order.destination_city}, {order.destination_state}
                  </TableCell>
                  <TableCell>
                    {formatPickupDate(order.pickup_date_early, order.pickup_date_late)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.pay)}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.miles?.toLocaleString() ?? '—'}
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
                  <TableCell>{order.ltl ? "Yes" : "No"}</TableCell>
                  <TableCell>{order.twic ? "Yes" : "No"}</TableCell>
                  <TableCell>{order.team_load ? "Yes" : "No"}</TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow key={`${order.order_id}-detail`}>
                    <TableCell colSpan={13} className="bg-muted/30 p-0">
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
  const isRemoved = fullOrder?.order_status === 'closed';

  return (
    <div className="p-4 space-y-4">
      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Route</p>
          <p className="text-sm">
            {order.origin_city}, {order.origin_state} → {order.destination_city}, {order.destination_state}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pickup</p>
          <p className="text-sm">
            {formatPickupDate(order.pickup_date_early, order.pickup_date_late)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pay / Rate</p>
          <p className="text-sm font-medium">
            {formatCurrency(order.pay)} ({formatCurrency(order.rate_per_mile)}/mi)
          </p>
        </div>
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

      {/* Detail fields */}
      {!isTaskPending && hasDetails && fullOrder && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 text-sm">
            {fullOrder.commodity && (
              <DetailField label="Commodity" value={fullOrder.commodity} />
            )}
            {fullOrder.tarp_height != null && (
              <DetailField label="Tarp Height" value={`${fullOrder.tarp_height}"`} />
            )}
            <DetailField label="Weight" value={fullOrder.weight != null ? `${fullOrder.weight.toLocaleString()} lbs` : '—'} />
            <DetailField label="Ramps" value={fullOrder.ramps_required ? "Yes" : "No"} />
            <DetailField label="TWIC" value={fullOrder.twic ? "Yes" : "No"} />
            <DetailField label="Team" value={fullOrder.team_load ? "Yes" : "No"} />
            <DetailField label="LTL" value={fullOrder.ltl ? "Yes" : "No"} />
            <DetailField label="Top 100" value={fullOrder.top_100_customer ? "Yes" : "No"} />
          </div>

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
      <p className="font-medium">{value}</p>
    </div>
  );
}
