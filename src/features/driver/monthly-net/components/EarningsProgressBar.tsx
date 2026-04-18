"use client";

export function EarningsProgressBar({
  earned,
  target,
}: {
  earned: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 100;
  const overage = earned > target ? earned - target : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-3 w-full rounded bg-muted">
        <div
          className={`h-3 rounded transition-all ${
            earned >= target ? "bg-emerald-500" : "bg-sky-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Earned: ${earned.toFixed(2)}</span>
        <span>Target: ${target.toFixed(2)}</span>
      </div>
      {overage > 0 && (
        <div className="text-xs text-emerald-600">
          Above fees: ${overage.toFixed(2)}
        </div>
      )}
    </div>
  );
}
