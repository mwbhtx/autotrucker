"use client";

export function FeesBreakdown({
  fees,
}: {
  fees: { id: string; name: string; monthly_amount: number }[];
}) {
  if (fees.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No fees configured. Set them up in Settings → Driver Fees.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {fees.map((f) => (
        <li key={f.id} className="flex justify-between">
          <span>{f.name}</span>
          <span className="tabular-nums">${f.monthly_amount.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
