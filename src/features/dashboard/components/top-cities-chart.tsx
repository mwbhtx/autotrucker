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
import { useAnalyticsTopCities } from "@/lib/hooks/use-analytics";

const chartConfig = {
  avg_count: {
    label: "Orders",
    color: "#22c55e",
  },
} satisfies ChartConfig;

export function TopCitiesChart({
  companyId,
  from,
  to,
}: {
  companyId: string;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, isError } = useAnalyticsTopCities(
    companyId,
    from,
    to,
  );

  const chartData = (data ?? [])
    .slice(0, 10)
    .map((entry) => ({
      city: `${entry.city}, ${entry.state}`,
      avg_count: entry.avg_count,
    }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Top Cities</CardTitle>
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
            <BarChart
              data={chartData}
              layout="vertical"
              accessibilityLayer
              margin={{ left: 8, right: 48 }}
            >
              <YAxis
                dataKey="city"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={100}
              />
              <XAxis type="number" tickLine={false} axisLine={false} hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="avg_count"
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill="var(--color-avg_count)" />
                ))}
                <LabelList
                  dataKey="avg_count"
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
