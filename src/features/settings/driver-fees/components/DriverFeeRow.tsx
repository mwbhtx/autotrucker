"use client";

import { useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import type { DriverFee } from "../types";

export function DriverFeeRow({
  fee,
  onUpdate,
  onDelete,
}: {
  fee: DriverFee;
  onUpdate: (id: string, patch: Partial<DriverFee>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fee.name);
  const [amount, setAmount] = useState<number>(fee.monthly_amount);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onUpdate(fee.id, { name, monthly_amount: Number(amount) });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setName(fee.name);
    setAmount(fee.monthly_amount);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 border-b border-border py-2">
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-32"
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={save} disabled={saving || !name}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{fee.name}</span>
          <span className="w-32 text-right text-sm tabular-nums">
            ${fee.monthly_amount.toFixed(2)}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(fee.id)}
            >
              Delete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
