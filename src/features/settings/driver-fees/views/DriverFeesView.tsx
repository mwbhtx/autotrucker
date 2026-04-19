"use client";

import { useEffect, useState } from "react";
import { PlusIcon, ReceiptIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import {
  listDriverFees,
  createDriverFee,
  deleteDriverFee,
  updateDriverFee,
} from "../api";
import type { DriverFee } from "../types";
import { DriverFeeRow } from "../components/DriverFeeRow";
import { AddDriverFeeDialog } from "../components/AddDriverFeeDialog";

export function DriverFeesView() {
  const [fees, setFees] = useState<DriverFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    listDriverFees()
      .then(setFees)
      .finally(() => setLoading(false));
  }, []);

  const total = fees.reduce((a, f) => a + f.monthly_amount, 0);

  async function handleAdd(input: { name: string; monthly_amount: number }) {
    const created = await createDriverFee(input);
    setFees((prev) => [...prev, created]);
  }
  async function handleUpdate(id: string, patch: Partial<DriverFee>) {
    const updated = await updateDriverFee(id, patch);
    setFees((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }
  async function handleDelete(id: string) {
    await deleteDriverFee(id);
    setFees((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading) {
    return (
      <div className="flex max-w-2xl flex-col gap-2">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <>
        <div className="flex max-w-2xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ReceiptIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No fees configured yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add your recurring monthly carrier charges — trailer lease, insurance, ELD, etc. — to power the Monthly Net dashboard.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 mt-1">
            <PlusIcon className="h-4 w-4" />
            <span>Add Your First Fee</span>
          </Button>
        </div>

        <AddDriverFeeDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onAdd={handleAdd}
        />
      </>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {fees.length} fee{fees.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add Fee</span>
          </Button>
        </div>
        <div className="divide-y divide-border">
          {fees.map((f) => (
            <DriverFeeRow
              key={f.id}
              fee={f}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total monthly
          </span>
          <span className="text-sm font-semibold tabular-nums">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      <AddDriverFeeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
