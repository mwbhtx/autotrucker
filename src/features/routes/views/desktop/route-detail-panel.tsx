"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, FlameIcon, ClipboardListIcon, BookmarkIcon } from "lucide-react";
import { Badge } from "@/platform/web/components/ui/badge";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { calcAvgLoadedRpm } from "@mwbhtx/haulvisor-core";
import { LEG_COLORS } from "@/core/utils/route-colors";
import { rateColor, routeProfitColor } from "@/core/utils/rate-color";
import { formatCurrency, formatDateRange, formatRpm } from "@/core/utils/route-helpers";
import type { RoundTripChain, RoundTripLeg } from "@/core/types";

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="default">High confidence</Badge>;
  if (score >= 40) return <Badge variant="secondary">Moderate</Badge>;
  return <Badge variant="outline">Low confidence</Badge>;
}

export interface RouteDetailPanelProps {
  chain: RoundTripChain | null;
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
}: RouteDetailPanelProps) {
  const [showCosts, setShowCosts] = useState(false);
  const [showInspector, setShowInspector] = useState(true);

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
            className="text-sm text-text-secondary whitespace-nowrap select-none"
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
            showCosts={showCosts}
            onToggleCosts={() => setShowCosts((v) => !v)}
            showInspector={showInspector}
            onToggleInspector={() => setShowInspector((v) => !v)}
            departureTime={departureTime}
            returnByTime={returnByTime}
          />
        </div>
      )}
    </div>
  );
}

/* ---- Inner content split out to keep RouteDetailPanel clean ---- */

interface RouteDetailContentProps {
  chain: RoundTripChain;
  originCity?: string;
  destCity?: string;
  costPerMile: number;
  orderUrlTemplate?: string;
  onHoverLeg?: (legIndex: number | null) => void;
  onShowComments?: (orderId: string) => void;
  showCosts: boolean;
  onToggleCosts: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  isWatchlisted?: boolean;
  onToggleWatchlist?: () => void;
  departureTime?: Date;
  returnByTime?: Date;
}

function RouteDetailContent({
  chain,
  originCity,
  destCity,
  costPerMile,
  orderUrlTemplate,
  onHoverLeg,
  onShowComments,
  showCosts,
  onToggleCosts,
  showInspector,
  onToggleInspector,
  isWatchlisted,
  onToggleWatchlist,
  departureTime,
  returnByTime,
}: RouteDetailContentProps) {
  const hasSpeculative = chain.legs.some((leg) => leg.type === "speculative");
  const firmLegs = chain.legs.filter((leg) => leg.type === "firm");
  const profit = hasSpeculative ? chain.estimated_total_profit : chain.firm_profit;
  const avgLoadedRpm = calcAvgLoadedRpm(firmLegs);
  const needsTarp = chain.legs.some(
    (l) => l.tarp_height != null && parseInt(l.tarp_height, 10) > 0,
  );

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
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Route summary + bookmark */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Route Summary</p>
            {onToggleWatchlist && (
              <button
                type="button"
                onClick={onToggleWatchlist}
                className="shrink-0 p-1 -mt-1 rounded transition-colors hover:bg-white/10"
              >
                <BookmarkIcon className={`h-5 w-5 ${isWatchlisted ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
              </button>
            )}
          </div>
          <div className="text-sm grid grid-cols-4 gap-x-3">
            {[
              { label1: "$/Day", value1: formatCurrency(chain.daily_net_profit), color1: routeProfitColor(chain.daily_net_profit), label2: "Profit", value2: formatCurrency(profit), color2: routeProfitColor(chain.daily_net_profit) },
              { label1: "Net/mi", value1: formatRpm(chain.effective_rpm), color1: routeProfitColor(chain.daily_net_profit), label2: "Gross", value2: formatCurrency(chain.total_pay), color2: "" },
              { label1: "Miles", value1: chain.total_miles.toLocaleString(), color1: "", label2: "DH %", value2: `${chain.deadhead_pct.toFixed(0)}%`, color2: "" },
              { label1: "Days", value1: chain.estimated_days.toFixed(1), color1: "", label2: "$/mi loaded", value2: avgLoadedRpm !== null ? `$${avgLoadedRpm.toFixed(2)}` : "—", color2: "" },
              { label1: "Tarp", value1: needsTarp ? "Yes" : "No", color1: needsTarp ? "text-negative" : "", label2: "Loads", value2: String(chain.legs.filter(l => l.type === "firm").length), color2: "" },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-subgrid col-span-4 px-3 py-1.5 ${i % 2 === 0 ? "bg-[#ebeced] dark:bg-[#232323]" : ""}`}>
                <span className="text-text-secondary text-left">{row.label1}</span>
                <span className="text-right">{row.color1 ? <span className={`tabular-nums font-medium ${row.color1} bg-black px-1.5 py-0.5`}>{row.value1}</span> : <span className="tabular-nums font-medium text-text-body">{row.value1}</span>}</span>
                <span className="text-text-secondary text-left">{row.label2}</span>
                <span className="text-right">{row.color2 ? <span className={`tabular-nums font-medium ${row.color2} bg-black px-1.5 py-0.5`}>{row.value2}</span> : <span className="tabular-nums font-medium text-text-body">{row.value2}</span>}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost breakdown (collapsible) */}
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm transition-colors w-full px-4 py-2.5 text-text-secondary"
            onClick={onToggleCosts}
          >
            <span>Cost breakdown</span>
            {showCosts ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </button>
          {showCosts && (
            <div className="px-4 pb-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm text-text-body">
              <span>Fuel</span>
              <span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.fuel)}</span>
              <span>Maintenance</span>
              <span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.maintenance)}</span>
              <span>Tires</span>
              <span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.tires)}</span>
              <span>Daily costs</span>
              <span className="text-right tabular-nums">{formatCurrency(chain.cost_breakdown.daily_costs)}</span>
              <span className="font-medium  pt-1.5">Total</span>
              <span className="text-right tabular-nums font-medium  pt-1.5">
                {formatCurrency(chain.cost_breakdown.total)}
              </span>
            </div>
          )}
        </div>

        {/* Segments section */}
        <div className="bg-[#ebeced] dark:bg-transparent">
        <div className="px-4 pt-3 pb-1.5 ">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Segments</p>
        </div>

        {/* Start deadhead */}
        {startDh > 0 && firstLeg.origin_city !== origin && (
          <div className="flex items-stretch gap-3 pl-4 pr-4">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
              <div className="h-3.5 w-3.5 rounded-full border-2 border-black/20 dark:border-white/20 shrink-0" />
              <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
            </div>
            <div className="flex items-center flex-1 gap-3 py-3">
              <span className="flex-1 text-base font-semibold text-text-body">
                {origin} → {firstLeg.origin_city} · {startDh.toLocaleString()} mi
              </span>
            </div>
          </div>
        )}

        {/* Legs */}
        {chain.legs.map((leg: RoundTripLeg, legIdx: number) => {
          const color = LEG_COLORS[legIdx % LEG_COLORS.length];
          const showBetweenDh = leg.deadhead_miles > 0 && legIdx > 0;
          return (
            <div key={leg.leg_number}>
              {/* Between-leg deadhead */}
              {showBetweenDh && (
                <div className="flex items-stretch gap-3 pl-4 pr-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-black/20 dark:border-white/20 shrink-0" />
                    <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center flex-1 gap-3 py-3">
                    <span className="flex-1 text-base font-semibold text-text-body">
                      {chain.legs[legIdx - 1].destination_city} → {leg.origin_city} · {leg.deadhead_miles.toLocaleString()} mi
                    </span>
                        </div>
                </div>
              )}

              {/* Leg row */}
              <div
                className="flex items-stretch gap-3 pl-4 pr-4 "
                onMouseEnter={() => onHoverLeg?.(legIdx)}
                onMouseLeave={() => onHoverLeg?.(null)}
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
                </div>
                <div className="flex-1 py-3">
                  <div className="flex items-center gap-3">
                    <p
                      className="flex-1 text-base font-bold flex items-center gap-1.5 min-w-0 text-text-body"
                    >
                      {leg.order_id && orderUrlTemplate ? (
                        <a
                          href={orderUrlTemplate.replace("{{ORDER_ID}}", leg.order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-primary transition-colors truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {leg.origin_city} → {leg.destination_city}
                        </a>
                      ) : (
                        <span className="truncate">
                          {leg.origin_city} → {leg.destination_city}
                        </span>
                      )}
                      {leg.lane_rank != null && (
                        <FlameIcon className="h-4 w-4 shrink-0" style={{ color: '#ff2200' }} />
                      )}
                      {leg.order_id && leg.type === "firm" && onShowComments && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowComments(leg.order_id!);
                          }}
                          className="text-text-body hover:text-primary transition-colors shrink-0"
                          title="View comments"
                        >
                          <ClipboardListIcon className="h-4 w-4" />
                        </button>
                      )}
                    </p>
                  </div>
                  {leg.type === "firm" ? (
                    <div className="text-sm mt-1 space-y-0.5 text-text-body">
                      <p>
                        {[
                          leg.weight != null ? `${leg.weight.toLocaleString()} lbs` : null,
                          leg.miles != null ? `${leg.miles.toLocaleString()} mi` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {leg.miles > 0 && (
                          <>
                            {" · "}
                            <span className={`${rateColor(leg.pay / leg.miles, costPerMile)} bg-black px-1.5 py-0.5`}>
                              ${(leg.pay / leg.miles).toFixed(2)}/mi
                            </span>
                          </>
                        )}
                        {leg.tarp_height != null && parseInt(leg.tarp_height, 10) > 0 && (
                          <>
                            {" "}
                            <span className="text-negative bg-black px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                              TARP
                            </span>
                          </>
                        )}
                        {" · "}{formatCurrency(leg.pay)}
                      </p>
                      {(leg.pickup_date_early || leg.delivery_date_early) && (
                        <div>
                          {leg.pickup_date_early && (
                            <p>Pickup: {formatDateRange(leg.pickup_date_early, leg.pickup_date_late)}</p>
                          )}
                          {leg.delivery_date_early && (
                            <p>Delivery: {formatDateRange(leg.delivery_date_early, leg.delivery_date_late)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm mt-1 text-text-body">
                      {[
                        `${leg.miles.toLocaleString()} mi`,
                        leg.lane_confidence
                          ? `${leg.lane_confidence.loads_per_week.toFixed(1)} loads/wk`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {leg.type === "speculative" && leg.lane_confidence && (
                    <div className="mt-1.5">
                      <ConfidenceBadge score={leg.lane_confidence.confidence_score} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Return deadhead */}
        {returnDh > 0 && lastLeg.destination_city !== returnCity && (
          <div className="flex items-stretch gap-3 pl-4 pr-4">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
              <div className="h-3.5 w-3.5 rounded-full border-2 border-black/20 dark:border-white/20 shrink-0" />
              <div className="w-px flex-1 bg-black/10 dark:bg-white/[0.07]" />
            </div>
            <div className="flex items-center flex-1 gap-3 py-3">
              <span className="flex-1 text-base font-semibold text-text-body">
                {lastLeg.destination_city} → {returnCity} · {returnDh.toLocaleString()} mi
              </span>
            </div>
          </div>
        )}

        </div>
        {/* Segment Details section (RouteInspector, collapsible) */}
        <div className="">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm transition-colors w-full px-4 py-2.5 text-text-secondary"
            onClick={onToggleInspector}
          >
            <span>Segment Details</span>
            {showInspector ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </button>
          {showInspector && (
            <div className="">
              <RouteInspector
                chain={chain}
                originCity={origin}
                returnCity={returnCity}
                onClose={onToggleInspector}
                departureTime={departureTime}
                returnByTime={returnByTime}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
