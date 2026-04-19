"use client";

import { useEffect, useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
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
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setDialogOpen(true)}>Add Fee</Button>
      </div>

      {fees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fees configured yet. Add your recurring monthly carrier charges
          (trailer lease, insurances, ELD, etc.) to power the Monthly Net
          dashboard.
        </p>
      ) : (
        <div className="flex flex-col">
          {fees.map((f) => (
            <DriverFeeRow
              key={f.id}
              fee={f}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <div className="text-right text-sm text-muted-foreground">
        Total monthly fees:{" "}
        <span className="font-medium text-foreground tabular-nums">
          ${total.toFixed(2)}
        </span>
      </div>

      <AddDriverFeeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
