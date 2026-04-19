"use client";

import { Button } from "@/platform/web/components/ui/button";

export type AssignedOrdersFilter = "all" | "dispatched" | "settled";

const OPTIONS: { value: AssignedOrdersFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dispatched", label: "Dispatched" },
  { value: "settled", label: "Settled" },
];

export function AssignedOrdersFilterStrip({
  value,
  onChange,
}: {
  value: AssignedOrdersFilter;
  onChange: (v: AssignedOrdersFilter) => void;
}) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
