"use client";

import type { AssignedOrder } from "../types";
import { SyncOrderStubButton } from "./SyncOrderStubButton";

const MISSING_DETAILS = "Details unavailable";

function fmtLocation(city?: string, state?: string) {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return MISSING_DETAILS;
}

export function AssignedOrdersTable({ orders }: { orders: AssignedOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Order #</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Unit</th>
            <th className="py-2 pr-3 font-medium">Trailer</th>
            <th className="py-2 pr-3 font-medium">Origin</th>
            <th className="py-2 pr-3 font-medium">Destination</th>
            <th className="py-2 pr-3 font-medium">Dispatch</th>
            <th className="py-2 pr-3 font-medium">Pickup</th>
            <th className="py-2 pr-3 text-right font-medium">Miles</th>
            <th className="py-2 pr-3 text-right font-medium">Rate/Mi</th>
            <th className="py-2 pr-3 text-right font-medium">Pay</th>
            <th className="py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const linked = o.has_order_details;
            const na = linked ? "—" : MISSING_DETAILS;
            return (
              <tr key={o.order_id} className="border-b border-border/50">
                <td className="py-2 pr-3 tabular-nums">{o.order_id}</td>
                <td className="py-2 pr-3 capitalize">{o.status}</td>
                <td className="py-2 pr-3">{o.unit_number ?? na}</td>
                <td className="py-2 pr-3">{o.trailer ?? na}</td>
                <td className="py-2 pr-3">
                  {linked ? fmtLocation(o.origin_city, o.origin_state) : na}
                </td>
                <td className="py-2 pr-3">
                  {linked
                    ? fmtLocation(o.destination_city, o.destination_state)
                    : na}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {o.dispatch_date?.slice(0, 10) ?? na}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {o.pickup_date?.slice(0, 10) ?? na}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {o.loaded_miles ?? na}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {o.rate_per_mile != null
                    ? `$${o.rate_per_mile.toFixed(2)}`
                    : na}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {o.pay != null ? `$${o.pay.toFixed(2)}` : na}
                </td>
                <td className="py-2 text-right">
                  {!linked && <SyncOrderStubButton orderId={o.order_id} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
