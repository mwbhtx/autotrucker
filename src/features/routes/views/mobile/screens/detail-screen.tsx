"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/platform/web/components/ui/tabs";
import { RouteMap } from "@/features/routes/components/route-map";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { routeProfitColor } from "@/core/utils/rate-color";
import { LEG_COLORS } from "@/core/utils/route-colors";
import {
  getOriginCity, getDestCity, getDailyProfit, getNetProfit, getDeadheadPerMile,
  getDeadheadPct, formatCurrency, formatDateTime, formatRpm,
} from "@/core/utils/route-helpers";
import type { RouteChain, RouteLeg } from "@/core/types";

interface DetailScreenProps {
  chain: RouteChain;
  originCity: string;
  onBack: () => void;
  originCoords?: { lat: number; lng: number } | null;
  destCoords?: { lat: number; lng: number } | null;
}

function shortCity(name: string): string {
  return name.split(",").slice(0, 2).map((s) => s.trim()).join(", ");
}

export function DetailScreen({ chain, originCity, onBack, originCoords: originCoordsProp, destCoords }: DetailScreenProps) {
  const origin = getOriginCity(chain);
  const dest = getDestCity(chain);
  const dailyProfit = getDailyProfit(chain) ?? 0;
  const netProfit = getNetProfit(chain) ?? 0;
  const deadheadPerMile = getDeadheadPerMile(chain) ?? 0;
  const deadhead = getDeadheadPct(chain);
  const legCount = chain.legs.length;
  const totalMiles = chain.total_miles;
  const totalPay = chain.total_pay;
  const color = routeProfitColor(dailyProfit);

  const originCoords = originCoordsProp ?? (chain.legs[0]
    ? { lat: chain.legs[0].origin_lat, lng: chain.legs[0].origin_lng }
    : null);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
          <button type="button" onClick={onBack} className="flex items-center justify-center h-9 w-9 rounded-full bg-white shrink-0">
            <ArrowLeft className="h-5 w-5 text-black" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-base font-semibold">
              <span className="truncate">{origin}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{dest}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span>{legCount} {legCount === 1 ? "leg" : "legs"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          {/* Key metrics — matches desktop card layout: $/Day, Profit, $/mi deadhead, Miles */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <MetricCard
              label="$/Day"
              value={`${formatCurrency(dailyProfit)}/day`}
              valueClassName={color}
            />
            <MetricCard
              label="Profit"
              value={formatCurrency(netProfit)}
              valueClassName={color}
            />
            <MetricCard
              label="$/mi deadhead"
              value={formatRpm(deadheadPerMile)}
              valueClassName={color}
            />
            <MetricCard
              label="Miles"
              value={`${totalMiles.toLocaleString()}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <MetricCard
              label="Total Gross"
              value={formatCurrency(totalPay)}
              sub
            />
            <MetricCard
              label="Deadhead"
              value={`${Math.round(deadhead)}%`}
              valueClassName={deadhead > 30 ? "text-yellow-500" : undefined}
              sub
            />
          </div>

          {/* Segment details */}
          <div className="space-y-3">
            {chain.legs.map((leg, i) => (
              <SegmentCard key={i} leg={leg} index={i} />
            ))}

            {/* Collapsible trip itinerary */}
            <SegmentDetailsCollapsible
              chain={chain}
              originCity={shortCity(originCity)}
              onBack={onBack}
            />
          </div>
        </TabsContent>

        {/* Map tab */}
        <TabsContent value="map" className="flex-1 min-h-0">
          <div className="h-full w-full">
            <RouteMap
              selectedRoute={{ legs: chain.legs }}
              originCoords={originCoords}
              destCoords={destCoords}
              fullScreen
            />
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-3">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`${sub ? "text-base" : "text-lg"} font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

function SegmentCard({ leg, index }: { leg: RouteLeg; index: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 text-black"
          style={{ backgroundColor: LEG_COLORS[index % LEG_COLORS.length] }}
        >
          {index + 1}
        </div>
        <span className="text-base font-medium text-muted-foreground">
          {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
        </span>
      </div>

      {/* Two-column section: key metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Pay</span>
          <span className="font-medium text-foreground">{formatCurrency(leg.pay)}</span>
        </div>
        <div className="flex justify-between">
          <span>Miles</span>
          <span className="font-medium text-foreground">{leg.miles.toLocaleString()}</span>
        </div>
        {leg.deadhead_miles > 0 && (
          <div className="flex justify-between">
            <span>Deadhead</span>
            <span>{leg.deadhead_miles.toLocaleString()} mi</span>
          </div>
        )}
        {leg.trailer_type && (
          <div className="flex justify-between">
            <span>Trailer</span>
            <span>{leg.trailer_type}</span>
          </div>
        )}
      </div>

      {/* Single-column section: dates */}
      {leg.stopoffs && leg.stopoffs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
          {leg.stopoffs.map((stop, i) => (
            <div key={i} className="text-sm text-muted-foreground">
              <span className="capitalize font-medium text-foreground">{stop.type}</span>
              {' — '}
              {stop.city}, {stop.state}
              {stop.early_date_local && (
                <div className="mt-0.5">
                  <span>{formatDateTime(stop.early_date_local)}</span>
                  {stop.late_date_local && stop.late_date_local !== stop.early_date_local && (
                    <span> – {formatDateTime(stop.late_date_local)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!leg.stopoffs && (leg.pickup_date_early_local || leg.delivery_date_early_local) && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
          {leg.pickup_date_early_local && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pickup Early</span>
              <span>{formatDateTime(leg.pickup_date_early_local)}</span>
            </div>
          )}
          {leg.pickup_date_late_local && leg.pickup_date_late_local !== leg.pickup_date_early_local && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Pickup Late</span>
              <span>{formatDateTime(leg.pickup_date_late_local)}</span>
            </div>
          )}
          {leg.delivery_date_early_local && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery Early</span>
              <span>{formatDateTime(leg.delivery_date_early_local)}</span>
            </div>
          )}
          {leg.delivery_date_late_local && leg.delivery_date_late_local !== leg.delivery_date_early_local && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery Late</span>
              <span>{formatDateTime(leg.delivery_date_late_local)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegmentDetailsCollapsible({
  chain,
  originCity,
  onBack,
}: {
  chain: RouteChain;
  originCity: string;
  onBack: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Trip Itinerary</span>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {open && (
        <div className="border-t border-white/[0.05]">
          <RouteInspector
            chain={chain}
            originCity={shortCity(originCity)}
            onClose={onBack}
          />
        </div>
      )}
    </div>
  );
}
