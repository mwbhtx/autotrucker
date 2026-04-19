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

/** "2026-04" → "April 2026". */
function formatMonthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const [, year, month] = m;
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-04-12" → "Apr 12". Parses manually to avoid UTC→local shift. */
function formatPickupDate(raw: string | null): string {
  if (!raw) return "—";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  const [, year, month, day] = m;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({
  label,
  value,
  sublabel,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>
      )}
    </div>
  );
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

  const netClass =
    data && data.net >= 0 ? "text-positive" : "text-negative";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {formatMonthLabel(month)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your earnings, fees, and loads for the month.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="uppercase tracking-wide">Month</span>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </label>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Earned"
              value={`$${data.earned.toFixed(2)}`}
              sublabel={`${data.loads_count} load${data.loads_count === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Monthly fees"
              value={`$${data.fees_total.toFixed(2)}`}
              sublabel={
                data.fees_breakdown.length > 0
                  ? `${data.fees_breakdown.length} fee${data.fees_breakdown.length === 1 ? "" : "s"} configured`
                  : "No fees configured"
              }
            />
            <StatCard
              label="Net"
              value={`$${data.net.toFixed(2)}`}
              valueClass={`tabular-nums ${netClass}`}
              sublabel={
                data.paid_off
                  ? "Above monthly fees"
                  : `$${data.remaining_to_cover.toFixed(2)} to cover`
              }
            />
            <StatCard
              label="Avg per load"
              value={
                data.loads_count > 0
                  ? `$${(data.earned / data.loads_count).toFixed(2)}`
                  : "—"
              }
              sublabel={data.loads_count > 0 ? "Truck pay / load" : undefined}
            />
          </div>

          {/* Progress + fees breakdown */}
          {(data.fees_total > 0 || data.fees_breakdown.length > 0) && (
            <div className="flex flex-col gap-4 rounded-md border border-border bg-background p-4">
              <EarningsProgressBar earned={data.earned} target={data.fees_total} />
              <div className="border-t border-border pt-3">
                <FeesBreakdown fees={data.fees_breakdown} />
              </div>
            </div>
          )}

          {data.fees_total === 0 && data.fees_breakdown.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              No fees configured. Set them up in Settings → Driver Fees to see your net.
            </div>
          )}

          {/* Orders table */}
          {data.orders.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border bg-accent/30 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="font-medium">Orders this month</span>
                <span className="tabular-nums">
                  {data.orders.length} load{data.orders.length === 1 ? "" : "s"}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Pickup</th>
                    <th className="px-4 py-2 text-left font-medium">Order</th>
                    <th className="px-4 py-2 text-left font-medium">Origin</th>
                    <th className="px-4 py-2 text-left font-medium">Destination</th>
                    <th className="px-4 py-2 text-right font-medium">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o, i) => (
                    <tr
                      key={o.order_id}
                      className={`border-b border-border last:border-0 transition-colors hover:bg-accent/40 ${
                        i % 2 === 1 ? "bg-muted/30" : ""
                      }`}
                    >
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatPickupDate(o.pickup_date)}
                      </td>
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
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {o.pay != null ? `$${o.pay.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
