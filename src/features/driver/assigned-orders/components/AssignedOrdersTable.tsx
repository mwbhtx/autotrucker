"use client";

import type { AssignedOrder } from "../types";

export function AssignedOrdersTable({ orders }: { orders: AssignedOrder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Order #</th>
            <th className="py-2 pr-3 font-medium">Unit</th>
            <th className="py-2 pr-3 font-medium">Trailer</th>
            <th className="py-2 pr-3 font-medium">Origin</th>
            <th className="py-2 pr-3 font-medium">Destination</th>
            <th className="py-2 pr-3 font-medium">Dispatch</th>
            <th className="py-2 pr-3 font-medium">Pickup</th>
            <th className="py-2 pr-3 text-right font-medium">Miles</th>
            <th className="py-2 pr-3 text-right font-medium">Rate/Mi</th>
            <th className="py-2 text-right font-medium">Truck Pay</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.carrier_order_id} className="border-b border-border/50">
              <td className="py-2 pr-3 tabular-nums">{o.carrier_order_id}</td>
              <td className="py-2 pr-3">{o.unit_number ?? "—"}</td>
              <td className="py-2 pr-3">{o.trailer ?? "—"}</td>
              <td className="py-2 pr-3">
                {o.origin_city && o.origin_state
                  ? `${o.origin_city}, ${o.origin_state}`
                  : "—"}
              </td>
              <td className="py-2 pr-3">
                {o.destination_city && o.destination_state
                  ? `${o.destination_city}, ${o.destination_state}`
                  : "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">
                {o.dispatch_date?.slice(0, 10) ?? "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">
                {o.pickup_date?.slice(0, 10) ?? "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {o.loaded_miles ?? "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {o.rate_per_mile != null ? `$${o.rate_per_mile.toFixed(2)}` : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">
                {o.truck_pay != null ? `$${o.truck_pay.toFixed(2)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
