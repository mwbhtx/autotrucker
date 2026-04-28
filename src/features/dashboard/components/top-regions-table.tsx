"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
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
import { useAnalyticsTopRegions } from "@/core/hooks/use-analytics";
import type {
  AnalyticsSide,
  AnalyticsTopPlacesSort,
  AnalyticsTopRegionEntry,
} from "@/core/types";

const REGION_FIELD: Record<AnalyticsTopPlacesSort, keyof AnalyticsTopRegionEntry> = {
  loads_per_day: "loads_per_day",
  rate_per_mile: "median_rate_per_mile",
  entropy_h: "entropy_h",
};

const currency2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const OPENED_PER_DAY_TOOLTIP =
  "Loads whose opened_at timestamp falls inside the selected window, divided by window length in days. Window-averaged. Sub-hour windows are normalized as if the window were one hour.";

const DIVERSITY_TOOLTIP =
  "Shannon entropy of the partner distribution, in nats. Higher = more diverse partners (robust); lower = concentrated on a few partners (brittle). 0 means all loads go to (or come from) a single partner. Each region is a ~35mi × 35mi freight market zone; the label shows the most common city in that zone.";

export function TopRegionsTable({
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
  const [sort, setSort] = useState<AnalyticsTopPlacesSort>("loads_per_day");
  const { data, isLoading, isError } = useAnalyticsTopRegions(companyId, side, from, to);

  const title = side === "origin" ? "Top Export Regions" : "Top Import Regions";
  const diversityHeader = side === "origin" ? "Outbound Diversity" : "Inbound Diversity";

  const rows = useMemo(() => {
    if (!data) return [];
    const fieldKey = REGION_FIELD[sort];
    return [...data].sort((a, b) => {
      const av = a[fieldKey] as number | null;
      const bv = b[fieldKey] as number | null;
      // NULLS LAST: nulls always sort to the bottom regardless of direction
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av; // DESC
    });
  }, [data, sort]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSort("loads_per_day")}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      >
                        <span>Opened/day</span>
                        <span
                          className={
                            sort === "loads_per_day"
                              ? "opacity-100"
                              : "opacity-0"
                          }
                        >
                          ▼
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {OPENED_PER_DAY_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => setSort("rate_per_mile")}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>$/mi</span>
                    <span
                      className={
                        sort === "rate_per_mile" ? "opacity-100" : "opacity-0"
                      }
                    >
                      ▼
                    </span>
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSort("entropy_h")}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      >
                        <span>{diversityHeader}</span>
                        <span
                          className={
                            sort === "entropy_h" ? "opacity-100" : "opacity-0"
                          }
                        >
                          ▼
                        </span>
                      </button>
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
                  <TableRow key={`${r.cell_lat},${r.cell_lng}`}>
                    <TableCell className="text-right tabular-nums">{i + 1}</TableCell>
                    <TableCell>{r.display_city}, {r.display_state}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.loads_per_day.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.median_rate_per_mile === null ? "—" : currency2.format(r.median_rate_per_mile)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.entropy_h.toFixed(2)}</TableCell>
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
