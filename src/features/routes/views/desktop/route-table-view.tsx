"use client";

import { useState, Fragment } from "react";
import { ChevronDownIcon, ChevronRightIcon, ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CalendarClockIcon } from "lucide-react";
import type { RouteChain } from "@/core/types";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { formatCurrency } from "@/core/utils/route-helpers";
import { DEFAULT_SORT_KEY } from "@mwbhtx/haulvisor-core";
import type { RouteSortKey } from "@mwbhtx/haulvisor-core";
import { sortRouteChains } from "@/features/routes/utils/sort-options";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/web/components/ui/table";
import { RouteDetailPanel } from "./route-detail-panel";
import type { ExportOrigin, ExportDest } from "@/features/routes/utils/export-csv";

type TableSortCol = "daily_net_profit" | "profit" | "gross_pay" | "all_in_gross_rpm" | "loaded_rpm" | "total_miles" | "deadhead_pct" | "estimated_days";

function SortIcon({ col, sortCol, sortDir }: { col: TableSortCol; sortCol: TableSortCol | null; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUpIcon className="ml-1 inline h-3 w-3" />
    : <ArrowDownIcon className="ml-1 inline h-3 w-3" />;
}

function sortByCol(chains: RouteChain[], col: TableSortCol | null, dir: "asc" | "desc"): RouteChain[] {
  if (!col) return chains;
  return [...chains].sort((a, b) => {
    let aVal: number;
    let bVal: number;
    switch (col) {
      case "daily_net_profit": aVal = a.daily_net_profit; bVal = b.daily_net_profit; break;
      case "profit": aVal = a.profit; bVal = b.profit; break;
      case "gross_pay": aVal = a.gross_pay; bVal = b.gross_pay; break;
      case "all_in_gross_rpm": aVal = a.all_in_gross_rpm; bVal = b.all_in_gross_rpm; break;
      case "loaded_rpm": aVal = calcAvgLoadedRpm(a.legs) ?? 0; bVal = calcAvgLoadedRpm(b.legs) ?? 0; break;
      case "total_miles": aVal = a.loaded_miles + a.deadhead_miles; bVal = b.loaded_miles + b.deadhead_miles; break;
      case "deadhead_pct": aVal = a.deadhead_pct; bVal = b.deadhead_pct; break;
      case "estimated_days": aVal = a.estimated_days; bVal = b.estimated_days; break;
      default: return 0;
    }
    return dir === "asc" ? aVal - bVal : bVal - aVal;
  });
}

function routeLabel(chain: RouteChain): string {
  const first = chain.legs[0];
  const last = chain.legs[chain.legs.length - 1];
  if (!first) return "—";
  const origin = `${first.origin_city}, ${first.origin_state}`;
  const dest = `${last.destination_city}, ${last.destination_state}`;
  return origin === dest ? origin : `${origin} → ${dest}`;
}

function hasTarp(chain: RouteChain): boolean {
  return chain.legs.some((l) => l.tarp_height != null && parseInt(l.tarp_height, 10) > 0);
}

function hasProjectedWindow(chain: RouteChain): boolean {
  return chain.legs.some((l) => l.window_projected === true);
}

interface RouteTableViewProps {
  chains: RouteChain[];
  isLoading?: boolean;
  costPerMile: number;
  orderUrlTemplate?: string;
  originCity?: string;
  destCity?: string;
  searchParams?: {
    origin_lat: number;
    origin_lng: number;
    departure_date: string;
    destination_lat?: number;
    destination_lng?: number;
    destination_city?: string;
    cost_per_mile?: number;
    max_driving_hours_per_day?: number;
    max_on_duty_hours_per_day?: number;
    earliest_on_duty_hour?: number;
    latest_on_duty_hour?: number;
  } | null;
  onShowComments?: (orderId: string) => void;
}

const COL_COUNT = 11;

export function RouteTableView({
  chains,
  isLoading,
  costPerMile,
  orderUrlTemplate,
  originCity,
  destCity,
  searchParams,
  onShowComments,
}: RouteTableViewProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<TableSortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(col: TableSortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function chainKey(chain: RouteChain): string {
    return chain.legs.map((l) => l.order_id ?? "spec").join("|");
  }

  const sorted = sortByCol(chains, sortCol, sortDir);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-2xl font-bold">0 Matches</p>
        <p className="mt-3 text-base text-foreground/70">No routes found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-sidebar">
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Route</TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("daily_net_profit")}>
              $/Day <SortIcon col="daily_net_profit" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("profit")}>
              Net <SortIcon col="profit" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("gross_pay")}>
              Gross <SortIcon col="gross_pay" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("all_in_gross_rpm")}>
              $/mi all-in <SortIcon col="all_in_gross_rpm" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("loaded_rpm")}>
              $/mi loaded <SortIcon col="loaded_rpm" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("total_miles")}>
              Total mi <SortIcon col="total_miles" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("deadhead_pct")}>
              DH% <SortIcon col="deadhead_pct" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("estimated_days")}>
              Days <SortIcon col="estimated_days" sortCol={sortCol} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-center">Tarp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((chain) => {
            const key = chainKey(chain);
            const isExpanded = expandedKey === key;
            const avgLoadedRpm = calcAvgLoadedRpm(chain.legs);
            const totalMiles = chain.loaded_miles + chain.deadhead_miles;
            const tarp = hasTarp(chain);

            return (
              <Fragment key={key}>
                <TableRow
                  className="cursor-pointer hover:bg-surface-elevated/50 transition-colors"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <TableCell className="w-8 text-muted-foreground">
                    {isExpanded
                      ? <ChevronDownIcon className="h-4 w-4" />
                      : <ChevronRightIcon className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {routeLabel(chain)}
                      {hasProjectedWindow(chain) && (
                        <span title="Pickup dates estimated — verify before booking">
                          <CalendarClockIcon className="h-3.5 w-3.5 text-warning shrink-0" />
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCurrency(chain.daily_net_profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCurrency(chain.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(chain.gross_pay)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    ${chain.all_in_gross_rpm.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {avgLoadedRpm != null ? `$${avgLoadedRpm.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{totalMiles.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {chain.deadhead_pct.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {chain.estimated_days > 0 ? chain.estimated_days.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {tarp ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-warning bg-black px-1.5 py-0.5">
                        TARP
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COL_COUNT} className="p-0 border-b border-border">
                      <div className="max-h-[600px] overflow-y-auto bg-surface-elevated">
                        <RouteDetailPanel
                          chain={chain}
                          originCity={originCity}
                          destCity={destCity}
                          costPerMile={costPerMile}
                          orderUrlTemplate={orderUrlTemplate}
                          onShowComments={onShowComments}
                          searchParams={searchParams}
                          fullWidth
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
