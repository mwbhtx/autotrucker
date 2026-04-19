"use client";

import { useState } from "react";
import { PencilIcon, TrashIcon, XIcon } from "lucide-react";
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
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!confirm(`Delete "${fee.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(fee.id);
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fee name"
          className="h-8 flex-1"
          autoFocus
        />
        <Input
          type="number"
          step="0.01"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="h-8 w-28 text-right tabular-nums"
        />
        <div className="flex gap-1">
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/30">
      <span className="flex-1 truncate text-sm">{fee.name}</span>
      <span className="w-28 text-right text-sm tabular-nums">
        ${fee.monthly_amount.toFixed(2)}
      </span>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${fee.name}`}
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete ${fee.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
