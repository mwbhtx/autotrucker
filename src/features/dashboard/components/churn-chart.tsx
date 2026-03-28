"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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
import { useAnalyticsChurn } from "@/lib/hooks/use-analytics";

const chartConfig = {
  churn_rate: {
    label: "Churn Rate",
    color: "#f59e0b",
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
  const value = payload[0]?.value;
  return (
    <div className="rounded-md border bg-card p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{formatDate(label)}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        <span className="text-muted-foreground">Churn:</span>
        <span className="font-medium">
          {value != null ? `${(value * 100).toFixed(1)}%` : "--"}
        </span>
      </div>
    </div>
  );
}

export function ChurnChart({
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
  const { data, isLoading, isError } = useAnalyticsChurn(
    companyId,
    from,
    to,
    bucket,
  );

  const chartData = (data ?? []).filter((d) => d.churn_rate != null);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Churn Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton className="h-full h-[200px] w-full" />
        ) : isError || chartData.length === 0 ? (
          <div className="flex h-full h-[200px] items-center justify-center text-muted-foreground">
            No data available
          </div>
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
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="churn_rate"
                name="Churn Rate"
                stroke="#f59e0b"
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
