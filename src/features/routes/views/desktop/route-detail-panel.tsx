"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon, FlameIcon, ClipboardListIcon, BookmarkIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/platform/web/components/ui/tooltip";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { useTimeline } from "@/core/hooks/use-timeline";
import { useAuth } from "@/core/services/auth-provider";
import { calcAvgLoadedRpm, DEFAULT_LOADED_SPEED_MPH } from "@mwbhtx/haulvisor-core";

function estDriveTime(miles: number, speed: number): string {
  const hours = miles / speed;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

import { formatCurrency, formatDateTime, formatRpm } from "@/core/utils/route-helpers";
import { routeProfitColor } from "@/core/utils/rate-color";
import type { RouteChain, RouteLeg } from "@/core/types";
import type { Stopoff } from "@mwbhtx/haulvisor-core";

export interface RouteDetailPanelProps {
  chain: RouteChain | null;
  originCity?: string;
  destCity?: string;
  costPerMile: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
  onShowComments?: (orderId: string) => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  departureTime?: Date;
  returnByTime?: Date;
  searchParams?: {
    origin_lat: number;
    origin_lng: number;
    departure_date: string;
    destination_lat?: number;
    destination_lng?: number;
    destination_city?: string;
    cost_per_mile?: number;
    avg_driving_hours_per_day?: number;
    work_start_hour?: number;
    work_end_hour?: number;
  } | null;
}

export function RouteDetailPanel({
  chain,
  originCity,
  destCity,
  costPerMile,
  orderUrlTemplate,
  onHoverLeg,
  onShowComments,
  isWatchlisted,
  onToggleWatchlist,
  departureTime,
  returnByTime,
  searchParams,
}: RouteDetailPanelProps) {
  const showInspector = true;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset inspector and scroll to top when route changes
  const chainKey = chain?.legs.map(l => l.order_id).join(",") ?? "";
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [chainKey]);

  const isExpanded = chain !== null;

  return (
    <div
      className="flex flex-col h-full bg-surface-elevated overflow-hidden shrink-0 transition-[width] duration-300 ease-in-out"
      style={{ width: isExpanded ? '40%' : 48, maxWidth: 600 }}
    >
      {/* Collapsed state — rotated label */}
      {!isExpanded && (
        <div className="flex h-full items-center justify-center">
          <p
            className="text-sm text-muted-foreground whitespace-nowrap select-none"
            style={{ transform: "rotate(-90deg)" }}
          >
            Select a route
          </p>
        </div>
      )}

      {/* Expanded state */}
      {isExpanded && (
        <div className="flex flex-col h-full overflow-hidden">
          <RouteDetailContent
            chain={chain}
            originCity={originCity}
            destCity={destCity}
            costPerMile={costPerMile}
            orderUrlTemplate={orderUrlTemplate}
            onHoverLeg={onHoverLeg}
            onShowComments={onShowComments}
            isWatchlisted={isWatchlisted}
            onToggleWatchlist={onToggleWatchlist}
            showInspector={true}
            departureTime={departureTime}
            returnByTime={returnByTime}
            searchParams={searchParams}
            scrollRef={scrollRef}
          />
        </div>
      )}
    </div>
  );
}

/* ---- Inner content split out to keep RouteDetailPanel clean ---- */

interface RouteDetailContentProps {
  chain: RouteChain;
  originCity?: string;
  destCity?: string;
  costPerMile: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
  onShowComments?: (orderId: string) => void;
  showInspector: boolean;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  departureTime?: Date;
  returnByTime?: Date;
  searchParams?: {
    origin_lat: number;
    origin_lng: number;
    departure_date: string;
    destination_lat?: number;
    destination_lng?: number;
    destination_city?: string;
    cost_per_mile?: number;
    avg_driving_hours_per_day?: number;
    work_start_hour?: number;
    work_end_hour?: number;
  } | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

function RouteDetailContent({
  chain,
  originCity,
  destCity,
  costPerMile,
  orderUrlTemplate,
  onHoverLeg,
  onShowComments,
  showInspector,
  isWatchlisted,
  onToggleWatchlist,
  departureTime,
  returnByTime,
  searchParams,
  scrollRef,
}: RouteDetailContentProps) {
  const { activeCompanyId } = useAuth();
  const { data: timelineData, isLoading: timelineLoading } = useTimeline(
    activeCompanyId ?? "",
    chain,
    searchParams ?? null,
    showInspector,
  );
  const firmLegs = chain.legs;
  const profit = chain.profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);
  const needsTarp = chain.legs.some(
    (l) => l.tarp_height != null && parseInt(l.tarp_height, 10) > 0,
  );
  const deliversEarly = chain.trip_summary?.delivers_early === true;

  const costPerDhMile =
    chain.total_deadhead_miles > 0
      ? chain.estimated_deadhead_cost / chain.total_deadhead_miles
      : 0;

  const firstLeg = chain.legs[0];
  const lastLeg = chain.legs[chain.legs.length - 1];
  const startDh = firstLeg?.deadhead_miles ?? 0;
  const betweenDh = chain.legs.slice(1).reduce((sum, l) => sum + l.deadhead_miles, 0);
  const returnDh = Math.max(0, chain.total_deadhead_miles - startDh - betweenDh);
  const origin = originCity || "Origin";
  const returnCity = destCity || origin;

  return (
    <>
      {/* Scrollable main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">

        {/* Route summary + bookmark */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Route Summary</p>
              {deliversEarly && <span className="font-semibold uppercase tracking-wide text-blue-400 bg-black px-1.5 py-0.5 text-xs">EARLY</span>}
            </div>
            {onToggleWatchlist && (
              <button
                type="button"
                onClick={onToggleWatchlist}
                className="shrink-0 -mt-1 flex items-center justify-center h-8 w-8 rounded-full bg-black/80 transition-colors hover:bg-black/60"
              >
                <BookmarkIcon className={`h-4 w-4 ${isWatchlisted ? "fill-primary text-primary" : "text-primary"}`} />
              </button>
            )}
          </div>
          <div className="text-sm grid grid-cols-4 gap-x-3">
            {(() => {
              const profitColor = routeProfitColor(chain.daily_net_profit);
              const profitChipClass = `tabular-nums font-bold ${profitColor} bg-black px-2 py-0.5 inline-block`;
              const rows: Array<{
                label1: string;
                value1: React.ReactNode;
                label2: string;
                value2: React.ReactNode;
                tooltip2?: string;
              }> = [
                {
                  label1: "$/Day",
                  value1: <span className={profitChipClass}>{formatCurrency(chain.daily_net_profit)}</span>,
                  label2: "Total Profit",
                  value2: <span className={profitChipClass}>{formatCurrency(profit)}</span>,
                },
                { label1: "Net/mi", value1: formatRpm(chain.effective_rpm), label2: "Expenses", value2: formatCurrency(chain.cost_breakdown.total), tooltip2: `${(chain.total_miles + chain.total_deadhead_miles).toLocaleString()} mi × $${(chain.effective_cost_per_mile ?? costPerMile).toFixed(2)}/mi` },
                { label1: "Total mi.", value1: (chain.total_miles + chain.total_deadhead_miles).toLocaleString(), label2: "Loaded mi.", value2: chain.total_miles.toLocaleString() },
                { label1: "Days", value1: chain.estimated_days.toFixed(1), label2: "DH %", value2: `${chain.deadhead_pct.toFixed(0)}%` },
                { label1: "Gross", value1: formatCurrency(chain.total_pay), label2: "DH mi.", value2: chain.total_deadhead_miles.toLocaleString() },
                { label1: "Tarp", value1: needsTarp ? "Yes" : "No", label2: "$/mi loaded", value2: avgLoadedRpm !== null ? `$${avgLoadedRpm.toFixed(2)}` : "—" },
              ];
              return rows.map((row, i) => (
                <div key={i} className={`grid grid-cols-subgrid col-span-4 px-3 py-1.5 ${i % 2 === 0 ? "bg-muted/50" : ""}`}>
                  <span className="text-muted-foreground text-left">{row.label1}</span>
                  <span className="text-right tabular-nums font-bold text-foreground">{row.value1}</span>
                  <span className="text-muted-foreground text-left">{row.label2}</span>
                  <span className="text-right">
                    {row.tooltip2 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="tabular-nums font-bold text-foreground underline decoration-dashed underline-offset-2 cursor-default">{row.value2}</span>
                          </TooltipTrigger>
                          <TooltipContent side="left">{row.tooltip2}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="tabular-nums font-bold text-foreground">{row.value2}</span>
                    )}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Orders section */}
        <div className="px-4 pt-3 pb-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Orders</p>
        </div>
        <div className="px-3 space-y-2 pb-3">
          {chain.legs.map((leg: RouteLeg, legIdx: number) => {
            const hasTarp = leg.tarp_height != null && parseInt(leg.tarp_height, 10) > 0;
            return (
              <div
                key={leg.order_id ?? legIdx}
                className="bg-card px-4 py-3 flex gap-3"
                onMouseEnter={() => onHoverLeg?.(legIdx)}
                onMouseLeave={() => onHoverLeg?.(null)}
              >
                <div className="w-[2px] shrink-0 bg-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {leg.order_id && orderUrlTemplate ? (
                        <a
                          href={orderUrlTemplate.replace("{{ORDER_ID}}", leg.order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
                        </a>
                      ) : (
                        <>{leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}</>
                      )}
                    </p>
                    <span className="text-sm font-bold text-foreground shrink-0 ml-2">{formatCurrency(leg.pay)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                    {leg.order_id && onShowComments && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onShowComments(leg.order_id!); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0" title="View comments">
                        <ClipboardListIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span>{leg.miles?.toLocaleString()} mi</span>
                    <span>{estDriveTime(leg.miles, DEFAULT_LOADED_SPEED_MPH)}</span>
                    {leg.weight != null && <span>{leg.weight.toLocaleString()} lbs</span>}
                    {leg.trailer_type && <span>{leg.trailer_type}</span>}
                    {leg.miles > 0 && <span>${(leg.pay / leg.miles).toFixed(2)}/mi</span>}
                    {hasTarp && (
                      <span className="font-semibold uppercase tracking-wide text-warning bg-black px-1.5 py-0.5">
                        TARP {leg.tarp_height}
                      </span>
                    )}
                  </div>
                  {leg.commodity && (
                    <p className="text-sm text-muted-foreground mt-1">Commodity: {leg.commodity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</p>
                  )}
                  {leg.pickup_date_early_local && (
                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-sm font-semibold text-foreground shrink-0">Pickup</span>
                      <span className="flex-1 border-b border-solid border-muted-foreground/30 relative -top-0.5" />
                      <span className="text-sm text-muted-foreground shrink-0">{formatDateTime(leg.pickup_date_early_local)}{leg.pickup_date_late_local ? ` - ${formatDateTime(leg.pickup_date_late_local)}` : ""}</span>
                    </div>
                  )}
                  {leg.delivery_date_early_local && (
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm font-semibold text-foreground shrink-0">Delivery</span>
                      <span className="flex-1 border-b border-solid border-muted-foreground/30 relative -top-0.5" />
                      <span className="text-sm text-muted-foreground shrink-0">{formatDateTime(leg.delivery_date_early_local)}{leg.delivery_date_late_local ? ` - ${formatDateTime(leg.delivery_date_late_local)}` : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stopoffs section — flattened list of every stopoff across every leg */}
        {chain.legs.some((l) => (l.stopoffs?.length ?? 0) > 0) && (
          <>
            <div className="px-4 pt-3 pb-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Stopoffs</p>
            </div>
            <div className="px-3 pb-3">
              <div className="bg-card px-4 py-3 flex gap-3">
                <div className="w-[2px] shrink-0 bg-primary" />
                <ol className="flex-1 min-w-0 space-y-1.5">
                  {chain.legs.flatMap((leg, legIdx) =>
                    (leg.stopoffs ?? []).map((s: Stopoff, i: number) => (
                      <li
                        key={`${legIdx}-${i}`}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span
                          className={`font-semibold uppercase tracking-wide text-xs w-[74px] shrink-0 ${
                            s.type === "pickup" ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {s.type === "pickup" ? "Pickup" : "Delivery"}
                        </span>
                        <span className="flex-1 truncate text-foreground">
                          {s.city}, {s.state}
                        </span>
                      </li>
                    )),
                  )}
                </ol>
              </div>
            </div>
          </>
        )}

        {/* Schedule section */}
        <div className="px-4 pt-3 pb-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Schedule</p>
        </div>

        <div className="px-3 space-y-2 pb-3">
          {/* Suggested Departure */}
          {chain.suggested_departure && (
            <div className="bg-card px-4 py-3 flex gap-3">
              <div className="w-[2px] shrink-0 bg-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider font-medium text-foreground">Suggested Departure</p>
                <p className="text-lg font-bold text-foreground">
                  {new Date(chain.suggested_departure).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(chain.suggested_departure).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
                {chain.trip_summary && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Arrive{returnCity && returnCity === origin ? " home" : ""}: {new Date(new Date(chain.suggested_departure).getTime() + chain.trip_summary.total_hours * 3_600_000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(new Date(chain.suggested_departure).getTime() + chain.trip_summary.total_hours * 3_600_000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Auto-loaded timeline */}
          <RouteInspector
            chain={chain}
            originCity={origin}
            returnCity={returnCity}
            onClose={() => {}}
            departureTime={departureTime}
            returnByTime={returnByTime}
            timelineData={timelineData}
            timelineLoading={timelineLoading}
          />
        </div>
      </div>
    </>
  );
}
