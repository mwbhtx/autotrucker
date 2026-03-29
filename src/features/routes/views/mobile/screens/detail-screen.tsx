"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, TrendingUp, Truck, MapPin, Gauge, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/platform/web/components/ui/tabs";
import { RouteMap } from "@/features/routes/components/route-map";
import { RouteInspector } from "@/features/routes/components/route-inspector";
import { routeProfitColor } from "@/core/utils/rate-color";
import type { RouteChain, RoundTripChain, RoundTripLeg, RouteLeg } from "@/core/types";

interface DetailScreenProps {
  chain: RouteChain | RoundTripChain;
  isRoundTrip: boolean;
  originCity: string;
  onBack: () => void;
}

function getOriginCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[0]?.origin_city ?? "Unknown";
}

function getDestCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[chain.legs.length - 1]?.destination_city ?? "Unknown";
}

function getDailyProfit(chain: RouteChain | RoundTripChain): number {
  if ("daily_net_profit" in chain) return chain.daily_net_profit;
  return 0;
}

function getDeadheadPct(chain: RouteChain | RoundTripChain): number {
  return chain.deadhead_pct ?? 0;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateRange(early?: string, late?: string): string {
  if (!early) return "";
  const e = formatDateTime(early);
  if (!late || late === early) return e;
  const l = formatDateTime(late);
  return `${e} – ${l}`;
}

export function DetailScreen({ chain, isRoundTrip, originCity, onBack }: DetailScreenProps) {
  const origin = getOriginCity(chain);
  const dest = getDestCity(chain);
  const dailyProfit = getDailyProfit(chain);
  const deadhead = getDeadheadPct(chain);
  const legCount = chain.legs.length;
  const totalMiles = chain.total_miles;
  const totalPay = chain.total_pay;

  const originCoords = chain.legs[0]
    ? { lat: chain.legs[0].origin_lat, lng: chain.legs[0].origin_lng }
    : null;

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
          <button type="button" onClick={onBack} className="rounded-full p-1 hover:bg-white/10 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{origin}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{dest}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {isRoundTrip ? "Round trip" : "One way"}
              </span>
              <span>{legCount} {legCount === 1 ? "leg" : "legs"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Daily Profit"
              value={`$${Math.round(dailyProfit)}/day`}
              valueClassName={routeProfitColor(dailyProfit)}
            />
            <MetricCard
              icon={<Truck className="h-4 w-4" />}
              label="Total Miles"
              value={`${totalMiles.toLocaleString()} mi`}
            />
            <MetricCard
              icon={<MapPin className="h-4 w-4" />}
              label="Total Pay"
              value={`$${totalPay.toLocaleString()}`}
            />
            <MetricCard
              icon={<Gauge className="h-4 w-4" />}
              label="Deadhead"
              value={`${Math.round(deadhead)}%`}
            />
          </div>

          {/* Route path summary */}
          <div className="space-y-0">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Route Path
            </h3>
            {chain.legs.map((leg, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-white/[0.05] last:border-0">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white/10 text-[10px] font-bold shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm">
                  {leg.origin_city} → {leg.destination_city}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {leg.miles.toLocaleString()} mi
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Segments tab */}
        <TabsContent value="segments" className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {chain.legs.map((leg, i) => (
            <SegmentCard key={i} leg={leg} index={i} />
          ))}

          {/* Segment Details — collapsible, shows RouteInspector timeline */}
          {isRoundTrip && (chain as RoundTripChain).trip_summary && (
            <SegmentDetailsCollapsible
              chain={chain as RoundTripChain}
              originCity={originCity}
              onBack={onBack}
            />
          )}
        </TabsContent>

        {/* Map tab */}
        <TabsContent value="map" className="flex-1 min-h-0">
          <div className="h-full w-full">
            <RouteMap
              selectedRoute={{ legs: chain.legs }}
              originCoords={originCoords}
              tripMode={isRoundTrip ? "round-trip" : "one-way"}
              fullScreen
            />
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

function SegmentCard({ leg, index }: { leg: RouteLeg | RoundTripLeg; index: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white/10 text-[10px] font-bold shrink-0">
          {index + 1}
        </div>
        <span className="text-sm font-medium">
          {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Pay</span>
          <span className="font-medium text-foreground">${leg.pay.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Miles</span>
          <span className="font-medium text-foreground">{leg.miles.toLocaleString()}</span>
        </div>
        {leg.pickup_date_early && (
          <div className="flex justify-between">
            <span>Pickup</span>
            <span>{formatDateRange(leg.pickup_date_early, leg.pickup_date_late)}</span>
          </div>
        )}
        {leg.delivery_date_early && (
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{formatDateRange(leg.delivery_date_early, leg.delivery_date_late)}</span>
          </div>
        )}
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
    </div>
  );
}

function SegmentDetailsCollapsible({
  chain,
  originCity,
  onBack,
}: {
  chain: RoundTripChain;
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
        <span>Segment Details</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-white/[0.05]">
          <RouteInspector
            chain={chain}
            originCity={originCity}
            onClose={onBack}
          />
        </div>
      )}
    </div>
  );
}
