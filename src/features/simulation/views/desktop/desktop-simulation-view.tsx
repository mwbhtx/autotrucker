"use client";

import { useMemo, useState } from "react";
import { FlaskConical, MapPin, Loader2Icon, AlertCircleIcon, PlayIcon, CheckCircle2Icon, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Slider } from "@/platform/web/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/web/components/ui/select";
import { PlaceAutocomplete, type PlaceResult } from "@/features/routes/components/search-form";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { useRouteSearch, type RouteSearchParams } from "@/core/hooks/use-routes";
import { useSimulate, isSimulateRejection, type SimulateRejection } from "@/core/hooks/use-simulate";
import { formatCurrency } from "@/core/utils/route-helpers";
import { routeProfitColor } from "@/core/utils/rate-color";
import type { RouteChain, RouteLeg } from "@/core/types";
import { DEFAULT_COST_PER_MILE, haversine, ROAD_DISTANCE_FALLBACK_MULTIPLIER } from "@mwbhtx/haulvisor-core";

const MS_PER_HOUR = 3_600_000;
const DEFAULT_RADIUS = 250;
const DEFAULT_EARLY_TOLERANCE_HOURS = 168;
const DEFAULT_LATE_TOLERANCE_HOURS = 24;
// Conservative loaded-truck speed for the ETA prefilter. Intentionally
// low so we only drop candidates that *obviously* can't be made — keep
// borderline ones in the list and let the full sim adjudicate.
const ETA_AVG_SPEED_MPH = 50;

/**
 * Returns true if even with the driver's late tolerance, the
 * straight-line ETA from A's earliest delivery overshoots B's
 * pickup-late close. Uses haversine × 1.0 (no road-distance fudge) to
 * give the most generous best-case arrival — so we only drop
 * candidates that are unreachable even at as-the-crow-flies speed.
 * Borderline ones stay; the backend's /timeline is the authoritative
 * feasibility check.
 */
function isObviouslyMissedConnection(
  aLeg: RouteLeg,
  bLeg: RouteLeg,
  lateToleranceHours: number,
): boolean {
  if (!aLeg.delivery_date_early_utc || !bLeg.pickup_date_late_utc) return false;
  const aDeliveryMs = new Date(aLeg.delivery_date_early_utc).getTime();
  const bPickupCloseMs = new Date(bLeg.pickup_date_late_utc).getTime();
  if (!Number.isFinite(aDeliveryMs) || !Number.isFinite(bPickupCloseMs)) return false;
  const distMi = haversine(aLeg.destination_lat, aLeg.destination_lng, bLeg.origin_lat, bLeg.origin_lng);
  const driveMs = (distMi / ETA_AVG_SPEED_MPH) * MS_PER_HOUR;
  const earliestAtB = aDeliveryMs + driveMs;
  const buffer = lateToleranceHours * MS_PER_HOUR;
  return earliestAtB > bPickupCloseMs + buffer;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function legFromChain(chain: RouteChain): RouteLeg | null {
  return chain.legs[0] ?? null;
}

type SortKey = "profit" | "pay" | "distance" | "pickup";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { value: SortKey; label: string; defaultDir: SortDir }[] = [
  { value: "profit", label: "Profit", defaultDir: "desc" },
  { value: "pay", label: "Pay", defaultDir: "desc" },
  { value: "distance", label: "Distance", defaultDir: "asc" },
  { value: "pickup", label: "Pickup", defaultDir: "asc" },
];

function sortValue(chain: RouteChain, key: SortKey): number {
  const leg = chain.legs[0];
  switch (key) {
    case "profit": return chain.profit ?? 0;
    case "pay": return chain.gross_pay ?? 0;
    case "distance": return leg?.miles ?? 0;
    case "pickup": {
      const iso = leg?.pickup_date_early_utc ?? leg?.pickup_date_early_local ?? null;
      if (!iso) return Number.MAX_SAFE_INTEGER;
      const ms = new Date(iso).getTime();
      return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
    }
  }
}

function sortChains(chains: RouteChain[], key: SortKey, dir: SortDir): RouteChain[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...chains].sort((a, b) => sign * (sortValue(a, key) - sortValue(b, key)));
}

interface SortControlsProps {
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKeyChange: (k: SortKey) => void;
  onSortDirToggle: () => void;
}

function SortControls({ sortKey, sortDir, onSortKeyChange, onSortDirToggle }: SortControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onSortDirToggle}
        title={sortDir === "asc" ? "Ascending — click to flip" : "Descending — click to flip"}
        className="h-7 w-7"
      >
        {sortDir === "asc" ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function formatWindow(early?: string | null, late?: string | null): string | null {
  if (!early) return null;
  const fmt = (iso: string) => {
    const [date, time] = iso.split("T");
    if (!date) return iso;
    const [, m, d] = date.split("-");
    return `${m}/${d} ${(time ?? "00:00").slice(0, 5)}`;
  };
  if (!late || late === early) return fmt(early);
  const [eDate] = early.split("T");
  const [lDate, lTime] = late.split("T");
  if (eDate === lDate) {
    return `${fmt(early)}–${(lTime ?? "00:00").slice(0, 5)}`;
  }
  return `${fmt(early)} – ${fmt(late)}`;
}

function rejectionMessage(rej: SimulateRejection): string {
  switch (rej.reason) {
    case "WINDOW_VIOLATION":
      return "Pickup and delivery windows don't line up. Try orders with more time between them.";
    case "ENVELOPE_VIOLATION_END":
      return "Trip runs past your end-of-shift hour. Adjust work hours in Settings.";
    case "ON_DUTY_CAP_EXCEEDED":
      return "Trip needs more on-duty time than your daily cap allows.";
    default:
      return "These orders can't be combined into a feasible route.";
  }
}

interface CandidateRowProps {
  chain: RouteChain;
  selected: boolean;
  onClick: () => void;
  /** When provided, shows an estimated deadhead from this anchor to the
   *  candidate's pickup origin (haversine × 1.18). Used on Pickup #2 to
   *  show how far the driver has to drive from order A's drop. */
  deadheadAnchor?: { lat: number; lng: number };
}

function CandidateRow({ chain, selected, onClick, deadheadAnchor }: CandidateRowProps) {
  const leg = legFromChain(chain);
  if (!leg) return null;
  const estDeadhead = deadheadAnchor
    ? Math.round(
        haversine(deadheadAnchor.lat, deadheadAnchor.lng, leg.origin_lat, leg.origin_lng) *
          ROAD_DISTANCE_FALLBACK_MULTIPLIER,
      )
    : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        selected ? "bg-primary/15 border-primary/40" : "hover:bg-surface-elevated/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {Math.round(leg.miles)} mi · {formatCurrency(leg.pay)} · {leg.trailer_type ?? "—"}
          </p>
          {estDeadhead != null && (
            <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
              Est. DH: {estDeadhead} mi
            </p>
          )}
          {(() => {
            const pickup = formatWindow(leg.pickup_date_early_local, leg.pickup_date_late_local);
            const delivery = formatWindow(leg.delivery_date_early_local, leg.delivery_date_late_local);
            return (
              <>
                {pickup && <p className="text-xs text-muted-foreground tabular-nums mt-0.5">Pickup: {pickup}</p>}
                {delivery && <p className="text-xs text-muted-foreground tabular-nums">Delivery: {delivery}</p>}
              </>
            );
          })()}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold tabular-nums ${routeProfitColor(chain.daily_net_profit)}`}>
            {formatCurrency(chain.profit)}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">profit</p>
        </div>
      </div>
    </button>
  );
}

interface CandidateListProps {
  title: string;
  subtitle?: string;
  isLoading: boolean;
  chains: RouteChain[];
  selectedKey: string | null;
  onSelect: (chain: RouteChain | null) => void;
  emptyMessage: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKeyChange: (k: SortKey) => void;
  onSortDirToggle: () => void;
  deadheadAnchor?: { lat: number; lng: number };
}

function CandidateList({
  title,
  subtitle,
  isLoading,
  chains,
  selectedKey,
  onSelect,
  emptyMessage,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirToggle,
  deadheadAnchor,
}: CandidateListProps) {
  return (
    <div className="flex flex-col h-full border-r min-w-0">
      <div className="px-4 py-3 border-b shrink-0 bg-sidebar/40">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest">{title}</p>
          <SortControls
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={onSortKeyChange}
            onSortDirToggle={onSortDirToggle}
          />
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chains.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          chains.map((chain) => {
            const leg = legFromChain(chain);
            if (!leg) return null;
            const key = leg.order_id;
            return (
              <CandidateRow
                key={key}
                chain={chain}
                selected={selectedKey === key}
                onClick={() => onSelect(selectedKey === key ? null : chain)}
                deadheadAnchor={deadheadAnchor}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export function DesktopSimulationView() {
  const { activeCompanyId, loading: authLoading } = useAuth();
  const { data: settings } = useSettings();

  const homeBasePlace = useMemo<PlaceResult | null>(() => {
    if (!settings?.home_base_lat || !settings.home_base_lng) return null;
    return {
      name: [settings.home_base_city, settings.home_base_state].filter(Boolean).join(", "),
      lat: settings.home_base_lat,
      lng: settings.home_base_lng,
    };
  }, [settings?.home_base_lat, settings?.home_base_lng, settings?.home_base_city, settings?.home_base_state]);

  const [origin, setOrigin] = useState<PlaceResult | null>(null);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [departureDate, setDepartureDate] = useState<string>(todayIso());

  const effectiveOrigin = origin ?? homeBasePlace;

  const [orderA, setOrderA] = useState<RouteChain | null>(null);
  const [orderB, setOrderB] = useState<RouteChain | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const [col1Sort, setCol1Sort] = useState<{ key: SortKey; dir: SortDir }>({ key: "pay", dir: "desc" });
  const [col2Sort, setCol2Sort] = useState<{ key: SortKey; dir: SortDir }>({ key: "pay", dir: "desc" });

  const handleCol1SortKey = (k: SortKey) => {
    const opt = SORT_OPTIONS.find(o => o.value === k);
    setCol1Sort({ key: k, dir: opt?.defaultDir ?? "desc" });
  };
  const handleCol2SortKey = (k: SortKey) => {
    const opt = SORT_OPTIONS.find(o => o.value === k);
    setCol2Sort({ key: k, dir: opt?.defaultDir ?? "desc" });
  };
  const toggleCol1Dir = () => setCol1Sort(s => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));
  const toggleCol2Dir = () => setCol2Sort(s => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));

  const earlyToleranceHours = settings?.early_tolerance_hours ?? DEFAULT_EARLY_TOLERANCE_HOURS;

  // Column 1: candidates near origin
  const col1Params = useMemo<RouteSearchParams | null>(() => {
    if (!effectiveOrigin) return null;
    return {
      origin_lat: effectiveOrigin.lat,
      origin_lng: effectiveOrigin.lng,
      departure_date: departureDate,
      search_radius_miles: radius,
      origin_radius_miles: radius,
      num_orders: 1,
    };
  }, [effectiveOrigin, departureDate, radius]);

  const col1 = useRouteSearch(activeCompanyId ?? "", col1Params);
  const col1Chains = useMemo<RouteChain[]>(
    () => sortChains(col1.data?.routes ?? [], col1Sort.key, col1Sort.dir),
    [col1.data?.routes, col1Sort.key, col1Sort.dir],
  );

  // Column 2: candidates anchored at order A's last delivery, with min_pickup_late_utc filter.
  const col2Params = useMemo<RouteSearchParams | null>(() => {
    const aLeg = orderA ? legFromChain(orderA) : null;
    if (!aLeg) return null;
    const aDeliveryEarlyMs = aLeg.delivery_date_early_utc
      ? new Date(aLeg.delivery_date_early_utc).getTime()
      : null;
    const minPickupLateUtc = aDeliveryEarlyMs != null
      ? aDeliveryEarlyMs - earlyToleranceHours * MS_PER_HOUR
      : undefined;
    return {
      origin_lat: aLeg.destination_lat,
      origin_lng: aLeg.destination_lng,
      departure_date: departureDate,
      search_radius_miles: radius,
      origin_radius_miles: radius,
      num_orders: 1,
      min_pickup_late_utc: minPickupLateUtc,
    };
  }, [orderA, radius, departureDate, earlyToleranceHours]);

  const col2 = useRouteSearch(activeCompanyId ?? "", col2Params);

  // Lenient client-side prune: drop column-2 candidates the driver
  // obviously can't make even with their full late tolerance applied.
  // Server-side `min_pickup_late_utc` only checks calendar overlap;
  // this also accounts for drive time from A's drop to B's pickup.
  const lateToleranceHours = settings?.late_tolerance_hours ?? DEFAULT_LATE_TOLERANCE_HOURS;
  const col2Chains = useMemo<RouteChain[]>(() => {
    const all = col2.data?.routes ?? [];
    const aLeg = orderA ? legFromChain(orderA) : null;
    const filtered = aLeg
      ? all.filter((chain) => {
          const bLeg = legFromChain(chain);
          if (!bLeg) return false;
          return !isObviouslyMissedConnection(aLeg, bLeg, lateToleranceHours);
        })
      : all;
    return sortChains(filtered, col2Sort.key, col2Sort.dir);
  }, [col2.data?.routes, orderA, lateToleranceHours, col2Sort.key, col2Sort.dir]);

  // Reset selection chain when inputs change.
  const handleOriginChange = (p: PlaceResult | null) => {
    setOrigin(p);
    setOrderA(null);
    setOrderB(null);
    setHasRun(false);
  };
  const handleRadiusChange = (v: number) => {
    setRadius(v);
    setOrderA(null);
    setOrderB(null);
    setHasRun(false);
  };
  const handleSelectA = (chain: RouteChain | null) => {
    setOrderA(chain);
    setOrderB(null);
    setHasRun(false);
  };
  const handleSelectB = (chain: RouteChain | null) => {
    setOrderB(chain);
    setHasRun(false);
  };

  const orderIds = useMemo(() => {
    const aId = orderA ? legFromChain(orderA)?.order_id : undefined;
    const bId = orderB ? legFromChain(orderB)?.order_id : undefined;
    return [aId, bId].filter((x): x is string => !!x);
  }, [orderA, orderB]);

  const sim = useSimulate(
    orderIds,
    hasRun && orderIds.length === 2,
    effectiveOrigin ? { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng } : undefined,
    destination
      ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] }
      : undefined,
  );

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!activeCompanyId) {
    return (
      <div className="flex h-full items-center justify-center -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">No company assigned</p>
          <p className="text-sm text-muted-foreground/70">Contact your admin to get access.</p>
        </div>
      </div>
    );
  }

  const aLeg = orderA ? legFromChain(orderA) : null;
  const bLeg = orderB ? legFromChain(orderB) : null;
  const canRun = !!orderA && !!orderB && !sim.isLoading;
  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  return (
    <div className="flex flex-col overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
      {/* Header — origin / radius / date / destination */}
      <div className="bg-sidebar p-4 shrink-0 border-b">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Route Simulation</h1>
          <span className="text-xs text-muted-foreground ml-2">Build a 2-order route by picking each leg manually.</span>
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origin</label>
            <PlaceAutocomplete
              placeholder={homeBasePlace ? `Home base: ${homeBasePlace.name}` : "Pickup origin..."}
              value={origin}
              onSelect={handleOriginChange}
            />
          </div>
          <div className="col-span-3 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destination</label>
            <PlaceAutocomplete
              placeholder="e.g. return to home base..."
              value={destination}
              onSelect={(p) => { setDestination(p); setHasRun(false); }}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Departure</label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => {
                setDepartureDate(e.target.value);
                setOrderA(null); setOrderB(null); setHasRun(false);
              }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="col-span-3 space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search Radius</label>
              <span className="text-xs tabular-nums">{radius} mi</span>
            </div>
            <Slider
              value={[radius]}
              onValueChange={([v]) => handleRadiusChange(v)}
              min={50}
              max={500}
              step={25}
            />
          </div>
          <div className="col-span-1">
            <Button
              className="w-full"
              disabled={!canRun}
              onClick={() => setHasRun(true)}
            >
              <PlayIcon className="h-4 w-4" />
              Run
            </Button>
          </div>
        </div>
      </div>

      {/* 3-column area */}
      <div className="flex flex-1 min-h-0">
        {/* Column 1: candidates near origin */}
        <div className="w-1/3 min-h-0">
          <CandidateList
            title="Pickup #1"
            subtitle={effectiveOrigin
              ? `Within ${radius} mi of ${effectiveOrigin.name}`
              : "Set an origin to begin"}
            isLoading={col1.isLoading}
            chains={col1Chains}
            selectedKey={aLeg?.order_id ?? null}
            onSelect={handleSelectA}
            emptyMessage={effectiveOrigin ? "No orders found near this origin." : "Pick an origin in the bar above."}
            sortKey={col1Sort.key}
            sortDir={col1Sort.dir}
            onSortKeyChange={handleCol1SortKey}
            onSortDirToggle={toggleCol1Dir}
          />
        </div>

        {/* Column 2: candidates anchored on order A's drop */}
        <div className="w-1/3 min-h-0">
          <CandidateList
            title="Pickup #2"
            subtitle={aLeg
              ? `Within ${radius} mi of ${aLeg.destination_city}, ${aLeg.destination_state}`
              : "Pick a first order to populate"}
            isLoading={col2.isLoading}
            chains={col2Chains}
            selectedKey={bLeg?.order_id ?? null}
            onSelect={handleSelectB}
            emptyMessage={aLeg
              ? "No follow-on orders fit (radius or pickup window)."
              : "Pick a first order to see candidates."}
            sortKey={col2Sort.key}
            sortDir={col2Sort.dir}
            onSortKeyChange={handleCol2SortKey}
            onSortDirToggle={toggleCol2Dir}
            deadheadAnchor={aLeg ? { lat: aLeg.destination_lat, lng: aLeg.destination_lng } : undefined}
          />
        </div>

        {/* Column 3: simulation result */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b shrink-0 bg-sidebar/40">
            <p className="text-xs font-semibold uppercase tracking-widest">Simulation Result</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orderA && orderB
                ? hasRun ? "Computed via /timeline" : "Click Run to simulate this 2-order chain."
                : "Pick one order from each column to enable Run."}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!hasRun && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
                <p>{orderA && orderB
                  ? "Click Run to compute miles, profit, and feasibility."
                  : "Build your chain to the left."}</p>
              </div>
            )}
            {hasRun && sim.isLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {hasRun && sim.error && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <AlertCircleIcon className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">Failed to load simulation.</p>
                <p className="text-xs text-muted-foreground">{(sim.error as Error).message}</p>
              </div>
            )}
            {hasRun && !sim.isLoading && !sim.error && sim.data && isSimulateRejection(sim.data) && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <AlertCircleIcon className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm">{rejectionMessage(sim.data)}</p>
              </div>
            )}
            {hasRun && !sim.isLoading && !sim.error && sim.data && !isSimulateRejection(sim.data) && (
              <SimulationSummary chain={sim.data} costPerMile={costPerMile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulationSummary({ chain, costPerMile }: { chain: RouteChain; costPerMile: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
        <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
        <p className="text-sm font-semibold">Feasible chain</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Profit" value={formatCurrency(chain.profit)} colorClass={routeProfitColor(chain.daily_net_profit)} />
        <Stat label="$/Day" value={formatCurrency(chain.daily_net_profit)} colorClass={routeProfitColor(chain.daily_net_profit)} />
        <Stat label="Days" value={chain.estimated_days.toFixed(1)} />
        <Stat label="Gross Pay" value={formatCurrency(chain.gross_pay)} />
        <Stat label="Loaded mi" value={Math.round(chain.loaded_miles).toLocaleString()} />
        <Stat label="Deadhead mi" value={Math.round(chain.deadhead_miles).toLocaleString()} />
        <Stat label="$/mi all-in" value={`$${chain.all_in_gross_rpm.toFixed(2)}`} />
        <Stat label="$/mi loaded" value={`$${chain.rate_per_mile.toFixed(2)}`} />
        <Stat label="Deadhead %" value={`${chain.deadhead_pct.toFixed(0)}%`} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legs</p>
        {chain.legs.map((leg) => (
          <div key={leg.leg_number} className="rounded-md border p-3 text-sm">
            <p className="font-medium">
              Leg {leg.leg_number}: {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums mt-1">
              {Math.round(leg.miles)} mi · {formatCurrency(leg.pay)} · deadhead {Math.round(leg.deadhead_miles)} mi
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cost model uses ${costPerMile.toFixed(2)}/mi.
      </p>
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums mt-0.5 ${colorClass ?? ""}`}>{value}</p>
    </div>
  );
}
