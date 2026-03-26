"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Order } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface OrderSummaryCardProps {
  order: Order;
}

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Order #{order.order_id}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{order.trailer_type}</Badge>
            {order.ltl && <Badge variant="outline">LTL</Badge>}
            {order.twic && <Badge variant="outline">TWIC</Badge>}
            {order.team_load && <Badge variant="outline">Team</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Route */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Route</p>
            <p className="text-sm font-medium">
              {order.origin_city}, {order.origin_state}
            </p>
            <p className="text-xs text-muted-foreground">to</p>
            <p className="text-sm font-medium">
              {order.destination_city}, {order.destination_state}
            </p>
          </div>

          {/* Dates */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Pickup Window
            </p>
            <p className="text-sm">
              {formatDate(order.pickup_date_early)}
            </p>
            {order.pickup_date_early !== order.pickup_date_late && (
              <p className="text-sm">
                to {formatDate(order.pickup_date_late)}
              </p>
            )}
          </div>

          {/* Pay & Rate */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Pay</p>
            <p className="text-lg font-bold">{formatCurrency(order.pay)}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(order.rate_per_mile)}/mi
            </p>
          </div>

          {/* Miles & Weight */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Miles / Weight
            </p>
            <p className="text-sm">
              {order.miles?.toLocaleString() ?? '—'} miles
            </p>
            <p className="text-sm">
              {order.weight?.toLocaleString() ?? '—'} lbs
            </p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
