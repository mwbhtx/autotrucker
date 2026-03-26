"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsStats, useAnalyticsHistory } from "@/lib/hooks/use-analytics";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface StatCardProps {
  title: string;
  value: string;
  indicator?: "green" | "red";
  sparklineData?: number[];
  sparklineColor?: string;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div className="h-8 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ title, value, indicator, sparklineData, sparklineColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-1.5 mb-1">
          {indicator && (
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                indicator === "green" ? "bg-green-500" : "bg-red-500"
              }`}
            />
          )}
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {sparklineData && sparklineData.length > 1 && sparklineColor && (
          <Sparkline data={sparklineData} color={sparklineColor} />
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

export function StatsCards({ companyId }: { companyId: string }) {
  // Always show current state — not tied to the chart time range
  const { data, isLoading, isError } = useAnalyticsStats(companyId);

  // Sparklines use a fixed 24h window so there's always meaningful context
  const [sparklineFrom, sparklineTo] = useMemo(() => {
    const now = new Date();
    return [
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      now.toISOString(),
    ];
  }, []);
  const { data: history } = useAnalyticsHistory(companyId, sparklineFrom, sparklineTo, "hour");

  const sparklines = (() => {
    if (!history || history.length === 0) return null;
    return {
      active: history.map((h) => h.active_orders),
      added: history.map((h) => h.added),
      removed: history.map((h) => h.removed),
      avgRate: history.map((h) => h.avg_rate_per_mile),
      avgPay: history.map((h) => h.avg_pay),
    };
  })();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Active Orders" value="No data yet" />
        <StatCard title="Avg Rate/Mile" value="No data yet" indicator="green" />
        <StatCard title="Avg Pay / Order" value="No data yet" />
        <StatCard title="Orders Added" value="No data yet" indicator="green" />
        <StatCard title="Orders Removed" value="No data yet" indicator="red" />
      </div>
    );
  }

  const hasData = data.total_open > 0 || data.orders_removed > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Active Orders"
        value={hasData ? data.total_open.toLocaleString() : "No data yet"}
        sparklineData={sparklines?.active}
        sparklineColor="#06b6d4"
      />
      <StatCard
        title="Avg Rate / Mile"
        value={
          hasData && data.avg_rate_per_mile > 0
            ? `$${data.avg_rate_per_mile.toFixed(2)}`
            : "No data yet"
        }
        indicator="green"
        sparklineData={sparklines?.avgRate}
        sparklineColor="#22c55e"
      />
      <StatCard
        title="Avg Pay / Order"
        value={
          hasData && data.avg_pay > 0
            ? `$${data.avg_pay.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`
            : "No data yet"
        }
        sparklineData={sparklines?.avgPay}
        sparklineColor="#a78bfa"
      />
      <StatCard
        title="Orders Added"
        value={hasData ? data.orders_added.toLocaleString() : "No data yet"}
        indicator="green"
        sparklineData={sparklines?.added}
        sparklineColor="#8b5cf6"
      />
      <StatCard
        title="Orders Removed"
        value={hasData ? data.orders_removed.toLocaleString() : "No data yet"}
        indicator="red"
        sparklineData={sparklines?.removed}
        sparklineColor="#ef4444"
      />
    </div>
  );
}
