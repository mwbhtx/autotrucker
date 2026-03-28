"use client";

import { BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
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
import { useAnalyticsTopLanes } from "@/lib/hooks/use-analytics";

const chartConfig = {
  count: {
    label: "Orders",
    color: "#f97316",
  },
} satisfies ChartConfig;

export function TopLanesChart({
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
  const { data, isLoading, isError } = useAnalyticsTopLanes(
    companyId,
    from,
    to,
    bucket,
  );

  // Aggregate lanes across all periods, summing counts
  const chartData = (() => {
    if (!data || data.length === 0) return [];
    const map = new Map<string, number>();
    for (const entry of data) {
      map.set(entry.lane, (map.get(entry.lane) ?? 0) + entry.count);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lane, count]) => ({ lane, count }));
  })();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Top Lanes</CardTitle>
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
                dataKey="lane"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={70}
              />
              <XAxis type="number" tickLine={false} axisLine={false} hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 4, 4, 0]}
              >
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
