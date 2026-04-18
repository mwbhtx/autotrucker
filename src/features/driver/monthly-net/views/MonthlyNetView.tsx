"use client";

import { useEffect, useState } from "react";
import { Input } from "@/platform/web/components/ui/input";
import { getMonthlyNet } from "../api";
import type { MonthlyNet } from "../types";
import { EarningsProgressBar } from "../components/EarningsProgressBar";
import { FeesBreakdown } from "../components/FeesBreakdown";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyNetView() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<MonthlyNet | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMonthlyNet(month)
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Month</span>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-40"
        />
      </label>

      {loading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-background p-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Earned this month
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                ${data.earned.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.loads_count} loads
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Monthly fees
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                ${data.fees_total.toFixed(2)}
              </div>
            </div>
          </div>

          <EarningsProgressBar earned={data.earned} target={data.fees_total} />

          <div className="border-t border-border pt-3">
            <div className="mb-2 flex justify-between text-sm">
              <span>Net</span>
              <strong
                className={`tabular-nums ${
                  data.net >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                ${data.net.toFixed(2)}
              </strong>
            </div>
            <FeesBreakdown fees={data.fees_breakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
