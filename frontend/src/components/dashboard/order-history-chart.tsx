"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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

const activeConfig = {
  active_orders: {
    label: "Active",
    color: "#06b6d4",
  },
} satisfies ChartConfig;

const flowConfig = {
  added: {
    label: "Added",
    color: "#8b5cf6",
  },
  removed: {
    label: "Removed",
    color: "#ef4444",
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
          <span className="font-medium">{entry.value?.toLocaleString()}</span>
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

interface ChartProps {
  companyId: string;
  from?: string;
  to?: string;
  bucket?: string;
}

/** Active orders over time — area chart */
export function ActiveOrdersChart({ companyId, from, to, bucket }: ChartProps) {
  const { data, isLoading, isError } = useAnalyticsHistory(companyId, from, to, bucket);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Available Orders</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError || !data || data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={activeConfig} className="h-full w-full">
            <AreaChart data={data} accessibilityLayer>
              <defs>
                <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.1} />
              <XAxis
                dataKey="period"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="active_orders"
                name="Active"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#gradActive)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Added vs Removed orders — area chart */
export function OrderFlowChart({ companyId, from, to, bucket }: ChartProps) {
  const { data, isLoading, isError } = useAnalyticsHistory(companyId, from, to, bucket);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Added / Removed Orders</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError || !data || data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={flowConfig} className="h-full w-full">
            <AreaChart data={data} accessibilityLayer>
              <defs>
                <linearGradient id="gradAdded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradRemoved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.1} />
              <XAxis
                dataKey="period"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Area
                type="monotone"
                dataKey="added"
                name="Added"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gradAdded)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="removed"
                name="Removed"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradRemoved)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
