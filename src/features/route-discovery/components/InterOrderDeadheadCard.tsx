"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/platform/web/components/ui/card";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useLegDeadhead } from "../hooks/use-leg-deadhead";

interface Props {
  query: {
    drop_lat: number;
    drop_lng: number;
    pickup_lat: number;
    pickup_lng: number;
    radius_miles: number;
  } | null;
}

export function InterOrderDeadheadCard({ query }: Props) {
  const { data, isLoading, error } = useLegDeadhead(query);

  const chartData =
    data?.histogram?.map((b) => ({
      range: `${Math.round(b.bucket_start)}–${Math.round(b.bucket_end)}`,
      count: b.count,
    })) ?? [];

  return (
    <Card id="route-discovery-leg-deadhead">
      <CardHeader>
        <CardTitle className="text-base">Inter-Order Deadhead</CardTitle>
      </CardHeader>
      <CardContent>
        {!isLoading && !error && !query && (
          <p className="text-xs text-muted-foreground">
            Click an order on the map (or a button above) to view its deadhead distribution.
          </p>
        )}
        {isLoading && <Skeleton className="h-40 w-full" />}
        {error && (
          <p className="text-sm text-destructive">
            Failed to load deadhead distribution.
          </p>
        )}
        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Median deadhead</div>
                <div className="text-xl font-semibold tabular-nums">
                  {data.median_miles.toFixed(1)} mi
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Sample size</div>
                <div className="text-xl font-semibold tabular-nums">
                  {data.sample_size}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>

            <div className="text-xs text-muted-foreground tabular-nums">
              P25 {data.p25_miles.toFixed(0)} · P50 {data.median_miles.toFixed(0)} ·
              P75 {data.p75_miles.toFixed(0)} · min {data.min_miles.toFixed(0)} ·
              max {data.max_miles.toFixed(0)}
            </div>

            {data.warning && (
              <div className="text-xs p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100">
                {data.warning}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
