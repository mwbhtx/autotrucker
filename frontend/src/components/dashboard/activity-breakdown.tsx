"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsHistory, useAnalyticsStats } from "@/lib/hooks/use-analytics";

interface StatRowProps {
  label: string;
  sublabel?: string;
  value: string;
  valueColor?: string;
}

function StatRow({ label, sublabel, value, valueColor }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
      <span className={`text-lg font-bold tabular-nums ${valueColor ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

export function ActivityBreakdown({
  companyId,
  from,
  to,
  bucket,
}: {
  companyId: string;
  from?: string;
  to?: string;
  bucket?: string;
}) {
  const { data: history, isLoading: historyLoading } = useAnalyticsHistory(
    companyId,
    from,
    to,
    bucket,
  );
  const { data: stats, isLoading: statsLoading } = useAnalyticsStats(
    companyId,
    from,
    to,
  );

  const isLoading = historyLoading || statsLoading;

  const derived = (() => {
    if (!history || history.length === 0 || !stats) return null;

    // Peak active
    let peakActive = 0;
    let peakPeriod = "";
    for (const h of history) {
      if (h.active_orders > peakActive) {
        peakActive = h.active_orders;
        peakPeriod = h.period;
      }
    }

    // Format peak time
    let peakTimeLabel = "";
    if (peakPeriod) {
      try {
        const d = new Date(peakPeriod);
        const isToday = new Date().toDateString() === d.toDateString();
        peakTimeLabel = isToday
          ? "Today " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          : d.toLocaleDateString([], { month: "short", day: "numeric" }) +
            " " +
            d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      } catch {
        peakTimeLabel = peakPeriod;
      }
    }

    // Avg per hour (total added / number of hours in the range)
    const totalAdded = stats.orders_added;
    const totalRemoved = stats.orders_removed;
    const periods = history.length || 1;
    const avgPerPeriod = Math.round(totalAdded / periods);

    // Net change
    const netChange = totalAdded - totalRemoved;

    // Removal rate
    const removalRate = totalAdded > 0
      ? ((totalRemoved / totalAdded) * 100).toFixed(1)
      : "0.0";

    // Fill ratio (active / added)
    const fillRatio = totalAdded > 0
      ? ((stats.total_open / totalAdded) * 100).toFixed(1)
      : "0.0";

    return { peakActive, peakTimeLabel, avgPerPeriod, netChange, removalRate, fillRatio };
  })();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !derived ? (
          <div className="flex h-full items-center justify-center text-muted-foreground py-8">
            No data available
          </div>
        ) : (
          <div>
            <StatRow
              label="Peak Active"
              sublabel={derived.peakTimeLabel}
              value={derived.peakActive.toLocaleString()}
              valueColor="text-green-500"
            />
            <StatRow
              label="Avg / Hour"
              sublabel="Last Period"
              value={derived.avgPerPeriod.toLocaleString()}
            />
            <StatRow
              label="Net Change"
              sublabel="Added − Removed"
              value={`${derived.netChange >= 0 ? "+" : ""}${derived.netChange.toLocaleString()}`}
              valueColor={derived.netChange >= 0 ? "text-green-500" : "text-red-500"}
            />
            <StatRow
              label="Removal Rate"
              sublabel="Removed / Added"
              value={`${derived.removalRate}%`}
            />
            <StatRow
              label="Fill Ratio"
              sublabel="Active / Added"
              value={`${derived.fillRatio}%`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
