"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsAvailability } from "@/lib/hooks/use-analytics";

const chartConfig = {
  avg_hours: {
    label: "Avg Hours",
    color: "#f59e0b",
  },
  median_hours: {
    label: "Median Hours",
    color: "#a855f7",
  },
} satisfies ChartConfig;

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function AvailabilityChart({
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
  const { data, isLoading, isError } = useAnalyticsAvailability(
    companyId,
    from,
    to,
    bucket,
  );

  const chartData = (data ?? []).map((entry) => ({
    period: new Date(entry.period).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }),
    avg_hours: entry.avg_hours,
    median_hours: entry.median_hours,
  }));

  // Compute overall average for the header
  const totalEntries = data ?? [];
  const overallAvg =
    totalEntries.length > 0
      ? totalEntries.reduce((sum, e) => sum + e.avg_hours * e.closed_count, 0) /
        totalEntries.reduce((sum, e) => sum + e.closed_count, 0) || 0
      : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Avg Order Availability</CardTitle>
        {overallAvg > 0 && (
          <p className="text-2xl font-bold tabular-nums">{formatHours(overallAvg)}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton className="h-full min-h-[200px] w-full" />
        ) : isError || chartData.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full h-[200px]"
          >
            <AreaChart
              data={chartData}
              accessibilityLayer
              margin={{ left: 0, right: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={formatHours}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatHours(Number(value))}
                  />
                }
              />
              <Area
                dataKey="avg_hours"
                type="monotone"
                fill="var(--color-avg_hours)"
                fillOpacity={0.2}
                stroke="var(--color-avg_hours)"
                strokeWidth={2}
              />
              <Area
                dataKey="median_hours"
                type="monotone"
                fill="var(--color-median_hours)"
                fillOpacity={0.1}
                stroke="var(--color-median_hours)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
