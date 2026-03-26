"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsHistory } from "@/lib/hooks/use-analytics";

const chartConfig = {
  avg_rate_per_mile: {
    label: "Rate/Mile",
    color: "#22c55e",
  },
  avg_pay: {
    label: "Avg Pay",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "numeric" })
    );
  } catch {
    return dateStr;
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{formatDate(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            $
            {entry.value?.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex items-center gap-4 justify-end">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CollectingDataState() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
      <svg
        className="h-10 w-10 mb-3 opacity-40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
      <p className="font-medium text-sm">Collecting data</p>
      <p className="text-xs mt-1 max-w-[220px] text-center">
        Rate &amp; Pay trends populate after 48 hours of continuous activity.
      </p>
    </div>
  );
}

export function RatePayChart({
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
  const { data, isLoading, isError } = useAnalyticsHistory(
    companyId,
    from,
    to,
    bucket,
  );

  const chartData = (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d) => (d as any).avg_rate_per_mile > 0,
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Rate &amp; Pay Trends</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton className="h-full h-[200px] w-full" />
        ) : isError || chartData.length === 0 ? (
          <CollectingDataState />
        ) : (
          <ChartContainer config={chartConfig} className="h-full h-[200px] w-full">
            <LineChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} strokeOpacity={0.1} />
              <XAxis
                dataKey="period"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="rpm"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `$${v}`}
                orientation="left"
              />
              <YAxis
                yAxisId="pay"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `$${v}`}
                orientation="right"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Line
                yAxisId="rpm"
                type="monotone"
                dataKey="avg_rate_per_mile"
                name="Rate/Mile"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="pay"
                type="monotone"
                dataKey="avg_pay"
                name="Avg Pay"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
