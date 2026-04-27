"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/platform/web/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/web/components/ui/table";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/web/components/ui/tooltip";
import { useAnalyticsTopLanes } from "@/core/hooks/use-analytics";
import type { AnalyticsLaneGranularity } from "@/core/types";

const currency2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const currency0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const OPENED_PER_DAY_TOOLTIP =
  "Loads whose opened_at timestamp falls inside the selected window, divided by window length in days. Window-averaged. Sub-hour windows are normalized as if the window were one hour.";

export function TopLanesTable({
  companyId,
  granularity,
  from,
  to,
}: {
  companyId: string;
  granularity: AnalyticsLaneGranularity;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, isError } = useAnalyticsTopLanes(
    companyId,
    granularity,
    from,
    to,
  );

  const title =
    granularity === "city"
      ? "Top Lanes (City → City)"
      : "Top Lanes (State → State)";

  const rows = data ?? [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Origin → Destination</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>Opened/day</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {OPENED_PER_DAY_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">$/mi</TableHead>
                <TableHead className="text-right">Median Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError || rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.origin_label}->${r.destination_label}`}>
                    <TableCell className="text-right tabular-nums">{i + 1}</TableCell>
                    <TableCell>{r.origin_label} → {r.destination_label}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.loads_per_day.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.median_rate_per_mile === null ? "—" : currency2.format(r.median_rate_per_mile)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.median_pay === null ? "—" : currency0.format(Math.round(r.median_pay))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
