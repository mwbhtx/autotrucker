// src/features/driver/routes/components/AddRouteDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { listAssignedOrders } from "@/features/driver/assigned-orders/api";
import type { AssignedOrder } from "@/features/driver/assigned-orders/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/platform/web/components/ui/dialog";
import { Button } from "@/platform/web/components/ui/button";
import type { DriverRouteErrorCode } from "../types";

const ERROR_MESSAGES: Record<DriverRouteErrorCode, string> = {
  INVALID_ORDER_COUNT: "You must select exactly 2 orders.",
  DUPLICATE_ORDERS: "Please select two different orders.",
  ORDER_NOT_ASSIGNED_TO_USER: "One of the selected orders is not assigned to you. Refresh and try again.",
  ORDER_NOT_SETTLED: "One of the selected orders is no longer settled. Refresh and try again.",
  ORDER_MISSING_DETAILS: "One of the selected orders is missing detail data. Try refreshing order details first.",
};

export interface AddRouteDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (orderIds: [string, string]) => Promise<void>;
}

export function AddRouteDialog({ open, onClose, onCreated }: AddRouteDialogProps) {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected([]);
    listAssignedOrders()
      .then((data) => {
        if (cancelled) return;
        const eligible = data.orders.filter((o) => o.status === "settled" && o.has_order_details);
        setOrders(eligible);
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  function toggle(orderId: string) {
    setSelected((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId);
      if (prev.length >= 2) return prev; // hard cap
      return [...prev, orderId];
    });
  }

  async function submit() {
    if (selected.length !== 2) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreated([selected[0], selected[1]]);
      onClose();
    } catch (err) {
      const message = (err as Error).message || "Could not save route";
      const match = message.match(/"code":"(\w+)"/);
      const code = match?.[1] as DriverRouteErrorCode | undefined;
      setError(code ? ERROR_MESSAGES[code] : message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSave = selected.length === 2 && !submitting;
  const selectionFull = selected.length >= 2;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Route</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground mb-2">
          Pick 2 settled orders to group as a completed route.
        </div>

        {error && <div className="mb-2 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No settled orders with details are available. Ensure at least two orders have been synced and settled.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-accent/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2 text-left">Order</th>
                  <th className="px-2 py-2 text-left">Origin</th>
                  <th className="px-2 py-2 text-left">Destination</th>
                  <th className="px-2 py-2 text-left">Pickup</th>
                  <th className="px-2 py-2 text-right">Pay</th>
                  <th className="px-2 py-2 text-right">Miles</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isSelected = selected.includes(o.order_id);
                  const disabled = !isSelected && selectionFull;
                  return (
                    <tr key={o.order_id} className={disabled ? "opacity-40" : ""}>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${o.order_id}`}
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggle(o.order_id)}
                        />
                      </td>
                      <td className="px-2 py-1">{o.order_id}</td>
                      <td className="px-2 py-1">{o.origin_city}, {o.origin_state}</td>
                      <td className="px-2 py-1">{o.destination_city}, {o.destination_state}</td>
                      <td className="px-2 py-1">{o.pickup_date ?? "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${o.pay?.toFixed(0) ?? "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{o.loaded_miles ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <div className="mr-auto text-xs text-muted-foreground">{selected.length} of 2 selected</div>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
