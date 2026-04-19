"use client";

import { useEffect, useState } from "react";
import { Input } from "@/platform/web/components/ui/input";
import { getMonthlyNet } from "../api";
import type { MonthlyNet } from "../types";
import { EarningsProgressBar } from "../components/EarningsProgressBar";
import { FeesBreakdown } from "../components/FeesBreakdown";
import { useSettings } from "@/core/hooks/use-settings";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyNetView() {
  const { data: settings } = useSettings();
  const orderUrlTemplate = settings?.order_url_template as string | undefined;
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

      {data && data.orders.length > 0 && (
        <div className="max-w-2xl overflow-hidden rounded-md border border-border bg-background">
          <div className="border-b border-border bg-accent/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Orders this month
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Origin</th>
                <th className="px-4 py-2 text-left font-medium">Destination</th>
                <th className="px-4 py-2 text-right font-medium">Pay</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.order_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono">
                    {orderUrlTemplate ? (
                      <a
                        href={orderUrlTemplate.replace("{{ORDER_ID}}", o.order_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {o.order_id}
                      </a>
                    ) : (
                      o.order_id
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {o.origin_city && o.origin_state
                      ? `${o.origin_city}, ${o.origin_state}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {o.destination_city && o.destination_state
                      ? `${o.destination_city}, ${o.destination_state}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {o.pay != null ? `$${o.pay.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
