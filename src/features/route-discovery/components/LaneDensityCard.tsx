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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useLaneDensity } from "../hooks/use-lane-density";

interface Props {
  query: {
    origin_lat: number;
    origin_lng: number;
    destination_lat: number;
    destination_lng: number;
    radius_miles: number;
  } | null;
}

export function LaneDensityCard({ query }: Props) {
  const { data, isLoading, error } = useLaneDensity(query);

  return (
    <Card id="route-discovery-lane-density">
      <CardHeader>
        <CardTitle className="text-base">Lane Density</CardTitle>
      </CardHeader>
      <CardContent>
        {!isLoading && !error && !query && (
          <p className="text-xs text-muted-foreground">
            Pick a route to view per-order density.
          </p>
        )}
        {isLoading && <Skeleton className="h-40 w-full" />}
        {error && (
          <p className="text-sm text-destructive">Failed to load lane density.</p>
        )}
        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Avg / day</div>
                <div className="text-xl font-semibold tabular-nums">
                  {data.avg_per_day.toFixed(2)}
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">
                  Avg / {data.wait_tolerance_days}d window
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {data.avg_per_window.toFixed(2)}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={data.daily}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="text-xs text-muted-foreground">
              {data.total_count} orders over 90 days · {data.zero_days} zero-days
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
