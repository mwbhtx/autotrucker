"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderSummaryCard } from "@/components/orders/order-summary-card";
import { StopoffsTable } from "@/components/orders/stopoffs-table";
import { useOrder, useTask } from "@/lib/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";

export function OrderDetail({
  companyId,
  orderId,
}: {
  companyId: string;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
  } = useOrder(companyId, orderId);

  // Task polling state: when the order response indicates a task was created,
  // we poll the task endpoint until it completes or fails.
  const [taskId, setTaskId] = useState<string | null>(null);
  const { data: task } = useTask(taskId);

  // When order returns with task_created status, begin polling
  useEffect(() => {
    if (order?.task_status === "task_created" && order.task_id) {
      setTaskId(order.task_id);
    }
  }, [order?.task_status, order?.task_id]);

  // When task completes, refetch the order
  useEffect(() => {
    if (task?.task_status === "completed") {
      setTaskId(null);
      queryClient.invalidateQueries({
        queryKey: ["orders", companyId, orderId],
      });
    }
  }, [task?.task_status, companyId, orderId, queryClient]);

  const isTaskPending =
    taskId != null && task?.task_status !== "completed" && task?.task_status !== "failed";
  const taskFailed = task?.task_status === "failed";

  if (orderLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="space-y-4">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            Back to orders
          </Button>
        </Link>
        <div className="rounded-lg border p-8 text-center text-destructive">
          {orderError
            ? `Failed to load order: ${orderError.message}`
            : "Order not found."}
        </div>
      </div>
    );
  }

  const hasDetails = order.has_details === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            Back to orders
          </Button>
        </Link>
      </div>

      {/* Summary Card */}
      <OrderSummaryCard order={order} />

      {/* Task polling indicator */}
      {isTaskPending && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">
              Fetching order details... This may take a moment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Task failure message */}
      {taskFailed && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              Failed to fetch order details
              {task?.error ? `: ${task.error}` : "."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail section */}
      {!isTaskPending && hasDetails ? (
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {order.commodity && (
                  <InfoItem label="Commodity" value={order.commodity} />
                )}
                <InfoItem
                  label="Weight"
                  value={order.weight != null ? `${order.weight.toLocaleString()} lbs` : '—'}
                />
                {order.tarp_height != null && (
                  <InfoItem label="Tarp Height" value={`${order.tarp_height}"`} />
                )}
                <InfoItem
                  label="Ramps Required"
                  value={order.ramps_required ? "Yes" : "No"}
                />
                <InfoItem label="TWIC" value={order.twic ? "Yes" : "No"} />
                <InfoItem label="Team Load" value={order.team_load ? "Yes" : "No"} />
                <InfoItem label="LTL" value={order.ltl ? "Yes" : "No"} />
                <InfoItem
                  label="Top 100 Customer"
                  value={order.top_100_customer ? "Yes" : "No"}
                />
              </div>

              {/* Comments */}
              {order.comments && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Comments
                    </p>
                    <p className="whitespace-pre-wrap text-sm">
                      {order.comments}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stopoffs */}
          {order.stopoffs && order.stopoffs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stops</CardTitle>
              </CardHeader>
              <CardContent>
                <StopoffsTable stopoffs={order.stopoffs} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : !isTaskPending && !hasDetails ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <p className="text-muted-foreground">
              Details have not yet been fetched for this order.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
