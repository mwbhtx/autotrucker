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
import { useAnalyticsTopCities } from "@/core/hooks/use-analytics";
import type { AnalyticsSide } from "@/core/types";

const currency2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatLoadsPerDay(v: number): string {
  return v.toFixed(1);
}
function formatRatePerMile(v: number | null): string {
  return v === null ? "—" : currency2.format(v);
}
function formatEntropy(v: number): string {
  return v.toFixed(2);
}

const OPENED_PER_DAY_TOOLTIP =
  "Loads whose opened_at timestamp falls inside the selected window, divided by window length in days. Window-averaged — a 90-day window will smear a lane that's been hot only recently. Sub-hour windows are normalized as if the window were one hour.";

const DIVERSITY_TOOLTIP =
  "Shannon entropy of the partner distribution, in nats (natural log). Higher = more diverse partners (robust); lower = concentrated on a few partners (brittle). 0 means all loads go to (or come from) a single partner. Translation: e^H is roughly the effective number of partners — H = 2.8 ≈ 16 effective destinations. Entropy is statistically less reliable for low-volume rows.";

export function TopCitiesTable({
  companyId,
  side,
  from,
  to,
}: {
  companyId: string;
  side: AnalyticsSide;
  from?: string;
  to?: string;
}) {
  const { data, isLoading, isError } = useAnalyticsTopCities(
    companyId,
    side,
    from,
    to,
  );

  const title =
    side === "origin" ? "Top Origin Cities" : "Top Destination Cities";
  const diversityHeader =
    side === "origin" ? "Outbound Diversity" : "Inbound Diversity";

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
                <TableHead>City</TableHead>
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
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{diversityHeader}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {DIVERSITY_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
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
                  <TableRow key={`${r.city}-${r.state}`}>
                    <TableCell className="text-right tabular-nums">{i + 1}</TableCell>
                    <TableCell>{r.city}, {r.state}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatLoadsPerDay(r.loads_per_day)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRatePerMile(r.median_rate_per_mile)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEntropy(r.entropy_h)}</TableCell>
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
