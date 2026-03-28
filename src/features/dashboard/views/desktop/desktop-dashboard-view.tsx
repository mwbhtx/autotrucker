"use client";

import { useState, useMemo } from "react";
import { StatsCards } from "@/features/dashboard/components/stats-cards";
import { ActiveOrdersChart, OrderFlowChart } from "@/features/dashboard/components/order-history-chart";
import { ActivityBreakdown } from "@/features/dashboard/components/activity-breakdown";
import { RatePayChart } from "@/features/dashboard/components/rate-pay-chart";
import { ChurnChart } from "@/features/dashboard/components/churn-chart";
import { StateBreakdown } from "@/features/dashboard/components/state-breakdown";
import { TrailerTypeChart } from "@/features/dashboard/components/trailer-type-chart";
import { TopLanesChart } from "@/features/dashboard/components/top-lanes-chart";
import { AvailabilityChart } from "@/features/dashboard/components/availability-chart";
import { TopCitiesChart } from "@/features/dashboard/components/top-cities-chart";
import { useAuth } from "@/core/services/auth-provider";

type TimeRange = "1h" | "24h" | "7d" | "30d" | "90d";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
{ value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

function computeTimeRange(range: TimeRange): {
  from: string;
  to: string;
  bucket: string;
} {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  let bucket: string;

  switch (range) {
    case "1h":
      from = new Date(now.getTime() - 60 * 60 * 1000);
      bucket = "hour";
      break;
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      bucket = "hour";
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      bucket = "day";
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucket = "day";
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      bucket = "month";
      break;
  }

  return { from: from.toISOString(), to, bucket };
}

function formatLastUpdated(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " " + date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function DesktopDashboardView() {
  const { activeCompanyId } = useAuth();
  const companyId = activeCompanyId ?? "";
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const { from, to, bucket } = useMemo(() => computeTimeRange(timeRange), [timeRange]);

  const lastUpdated = useMemo(() => formatLastUpdated(new Date()), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Last updated &middot; {lastUpdated}
          </p>
        )}
      </div>

      {/* Current Stats */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Current</p>
        <StatsCards companyId={companyId} />
      </div>

      {/* Historical — time range selector + charts */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Historical Trends</p>
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 text-sm">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimeRange(opt.value)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                timeRange === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Available Orders + Order Flow + Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 [&>*]:h-full">
        <div className="lg:col-span-2">
          <ActiveOrdersChart companyId={companyId} from={from} to={to} bucket={bucket} />
        </div>
        <div className="lg:col-span-2">
          <OrderFlowChart companyId={companyId} from={from} to={to} bucket={bucket} />
        </div>
        <div className="lg:col-span-1">
          <ActivityBreakdown companyId={companyId} from={from} to={to} bucket={bucket} />
        </div>
      </div>

      {/* Top Cities + States + Trailers + Lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <TopCitiesChart companyId={companyId} from={from} to={to} />
        <StateBreakdown companyId={companyId} from={from} to={to} />
        <TrailerTypeChart companyId={companyId} from={from} to={to} />
        <TopLanesChart companyId={companyId} from={from} to={to} bucket={bucket} />
      </div>

      {/* Rate & Pay + Churn + Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RatePayChart companyId={companyId} from={from} to={to} bucket={bucket} />
        <ChurnChart companyId={companyId} from={from} to={to} bucket={bucket} />
        <AvailabilityChart companyId={companyId} from={from} to={to} bucket={bucket} />
      </div>
    </div>
  );
}
