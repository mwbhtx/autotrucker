"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, LabelList } from "recharts";
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
import { useAnalyticsTrailerBreakdown } from "@/lib/hooks/use-analytics";

const chartConfig = {
  count: {
    label: "Orders",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

export function TrailerTypeChart({
  companyId,
  from,
  to,
}: {
  companyId: string;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, isError } = useAnalyticsTrailerBreakdown(
    companyId,
    from,
    to,
  );

  const chartData = (data ?? [])
    .slice(0, 10)
    .map((entry) => ({ type: entry.key, count: entry.count }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Top Trailer Types</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton className="h-full h-[200px] w-full" />
        ) : isError || chartData.length === 0 ? (
          <div className="flex h-full h-[200px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full h-[200px]"
          >
            <BarChart
              data={chartData}
              layout="vertical"
              accessibilityLayer
              margin={{ left: 8, right: 48 }}
            >
              <YAxis
                dataKey="type"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <XAxis type="number" tickLine={false} axisLine={false} hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill="var(--color-count)" />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-muted-foreground text-xs"
                  formatter={(v: number) => v.toLocaleString()}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
