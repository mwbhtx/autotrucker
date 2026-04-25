"use client";

import { useMemo, useState } from "react";
import { FlaskConical, MapPin, Loader2Icon, AlertCircleIcon, CheckCircle2Icon, ArrowUpIcon, ArrowDownIcon, Navigation, Truck, Search, ExternalLink } from "lucide-react";
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
import { useSimulate, isSimulateRejection, type SimulateRejection } from "@/core/hooks/use-simulate";
import { formatCurrency } from "@/core/utils/route-helpers";
import { routeProfitColor } from "@/core/utils/rate-color";
import type { RouteChain, RouteLeg } from "@/core/types";
import { haversine } from "@mwbhtx/haulvisor-core";
import { useSimulationStore, type SortKey, type SortDir } from "@/core/stores/simulation-store";
import { useSimulationSearchContext } from "@/core/providers/simulation-search-provider";

const MS_PER_HOUR = 3_600_000;
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


function legFromChain(chain: RouteChain): RouteLeg | null {
  return chain.legs[0] ?? null;
}

const SORT_OPTIONS: { value: SortKey; label: string; defaultDir: SortDir }[] = [
  { value: "profit", label: "Net", defaultDir: "desc" },
  { value: "pay", label: "Gross", defaultDir: "desc" },
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
  deadheadAnchor?: { lat: number; lng: number };
  orderUrlTemplate?: string;
}

function CandidateRow({ chain, selected, onClick, deadheadAnchor, orderUrlTemplate }: CandidateRowProps) {
  const leg = legFromChain(chain);
  if (!leg) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        selected ? "bg-primary/15 border-primary/40" : "hover:bg-surface-elevated/50"
      }`}
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {leg.origin_city}, {leg.origin_state} → {leg.destination_city}, {leg.destination_state}
            </p>
            {leg.order_id && orderUrlTemplate && (
              <a
                href={orderUrlTemplate.replace("{{ORDER_ID}}", leg.order_id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                title="Open in portal"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
            {formatCurrency(leg.pay)} · {leg.trailer_type ?? "—"}
          </p>
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
        <div className="flex flex-col justify-between shrink-0 min-w-[130px]">
          <div className="grid grid-cols-2 gap-x-3 text-right">
            <div>
              <p className="text-sm font-medium tabular-nums">{formatCurrency(chain.gross_pay)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">gross</p>
            </div>
            <div>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(chain.profit)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">net</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 text-xs text-muted-foreground tabular-nums">
            <div className="flex items-center gap-1" title="Loaded miles">
              <Truck className="h-3 w-3" />
              <span>{Math.round(leg.miles)} mi</span>
            </div>
            {deadheadAnchor != null && chain.deadhead_pct != null && (
              <div className="flex items-center gap-1" title="Deadhead percentage">
                <Navigation className="h-3 w-3" />
                <span>{chain.deadhead_pct}%</span>
              </div>
            )}
          </div>
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
  filterValue: string;
  onFilterChange: (v: string) => void;
  orderUrlTemplate?: string;
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
  filterValue,
  onFilterChange,
  orderUrlTemplate,
}: CandidateListProps) {
  const filter = filterValue;

  const visibleChains = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return chains;
    return chains.filter((chain) => {
      const leg = chain.legs[0];
      if (!leg) return false;
      return (
        (leg.order_id?.toLowerCase() ?? "").includes(q) ||
        (leg.origin_city?.toLowerCase() ?? "").includes(q) ||
        (leg.origin_state?.toLowerCase() ?? "").includes(q) ||
        (leg.destination_city?.toLowerCase() ?? "").includes(q) ||
        (leg.destination_state?.toLowerCase() ?? "").includes(q) ||
        (leg.trailer_type?.toLowerCase() ?? "").includes(q)
      );
    });
  }, [chains, filter]);

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
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {!isLoading && chains.length > 0 && subtitle.startsWith("Within")
              ? `${chains.length} results ${subtitle.toLowerCase()}`
              : subtitle}
          </p>
        )}
        <div className="relative mt-1.5">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by city or order ID..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-transparent pl-6 pr-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleChains.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {filter.trim() ? "No orders match your search." : emptyMessage}
          </div>
        ) : (
          visibleChains.map((chain) => {
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
                orderUrlTemplate={orderUrlTemplate}
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

  const {
    origin, destination, radius, departureDate, orderA, orderB, col1Sort, col2Sort,
    col1Filter, col2Filter,
    set: setStore,
  } = useSimulationStore();

  const effectiveOrigin = origin ?? homeBasePlace;

  const handleCol1SortKey = (k: SortKey) => {
    const opt = SORT_OPTIONS.find(o => o.value === k);
    setStore({ col1Sort: { key: k, dir: opt?.defaultDir ?? "desc" } });
  };
  const handleCol2SortKey = (k: SortKey) => {
    const opt = SORT_OPTIONS.find(o => o.value === k);
    setStore({ col2Sort: { key: k, dir: opt?.defaultDir ?? "desc" } });
  };
  const toggleCol1Dir = () => setStore({ col1Sort: { ...col1Sort, dir: col1Sort.dir === "asc" ? "desc" : "asc" } });
  const toggleCol2Dir = () => setStore({ col2Sort: { ...col2Sort, dir: col2Sort.dir === "asc" ? "desc" : "asc" } });

  const { col1, col2 } = useSimulationSearchContext();
  const orderUrlTemplate = col1.data?.order_url_template ?? col2.data?.order_url_template;

  const col1Chains = useMemo<RouteChain[]>(
    () => sortChains(col1.data?.routes ?? [], col1Sort.key, col1Sort.dir),
    [col1.data?.routes, col1Sort.key, col1Sort.dir],
  );

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
    if (p) {
      setStore({ origin: p, orderA: null, orderB: null });
    } else {
      setStore({ origin: null });
    }
  };
  const handleRadiusChange = (v: number) => {
    setStore({ radius: v, orderA: null, orderB: null });
  };
  const handleSelectA = (chain: RouteChain | null) => {
    setStore({ orderA: chain, orderB: null });
  };
  const handleSelectB = (chain: RouteChain | null) => {
    setStore({ orderB: chain });
  };

  const orderIds = useMemo(() => {
    const aId = orderA ? legFromChain(orderA)?.order_id : undefined;
    const bId = orderB ? legFromChain(orderB)?.order_id : undefined;
    return [aId, bId].filter((x): x is string => !!x);
  }, [orderA, orderB]);

  const sim = useSimulate(
    orderIds,
    orderIds.length === 2,
    effectiveOrigin ? { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng } : undefined,
    destination
      ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] }
      : undefined,
    departureDate || undefined,
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

  return (
    <div className="flex flex-col overflow-hidden -m-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)]">
      {/* Header — origin / radius / date / destination */}
      <div className="bg-sidebar p-4 shrink-0 border-b">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Route Builder</h1>
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
              onSelect={(p) => setStore({ destination: p })}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Departure</label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setStore({ departureDate: e.target.value, orderA: null, orderB: null })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="col-span-4 space-y-1">
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
            deadheadAnchor={effectiveOrigin ? { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng } : undefined}
            filterValue={col1Filter}
            onFilterChange={(v) => setStore({ col1Filter: v })}
            orderUrlTemplate={orderUrlTemplate}
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
              ? "No orders found near this delivery location."
              : "Pick a first order to see candidates."}
            sortKey={col2Sort.key}
            sortDir={col2Sort.dir}
            onSortKeyChange={handleCol2SortKey}
            onSortDirToggle={toggleCol2Dir}
            deadheadAnchor={aLeg ? { lat: aLeg.destination_lat, lng: aLeg.destination_lng } : undefined}
            filterValue={col2Filter}
            onFilterChange={(v) => setStore({ col2Filter: v })}
            orderUrlTemplate={orderUrlTemplate}
          />
        </div>

        {/* Column 3: simulation result */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b shrink-0 bg-sidebar/40">
            <p className="text-xs font-semibold uppercase tracking-widest">Simulation Result</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orderA && orderB
                ? sim.isLoading ? "Computing..." : "Computed via /timeline"
                : "Pick one order from each column."}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {orderIds.length < 2 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-sm text-muted-foreground">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
                <p>Build your chain to the left.</p>
              </div>
            )}
            {orderIds.length === 2 && sim.isLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {orderIds.length === 2 && sim.error && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <AlertCircleIcon className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">Failed to load simulation.</p>
                <p className="text-xs text-muted-foreground">{(sim.error as Error).message}</p>
              </div>
            )}
            {orderIds.length === 2 && !sim.isLoading && !sim.error && sim.data && isSimulateRejection(sim.data) && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <AlertCircleIcon className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm">{rejectionMessage(sim.data)}</p>
              </div>
            )}
            {orderIds.length === 2 && !sim.isLoading && !sim.error && sim.data && !isSimulateRejection(sim.data) && (
              <SimulationSummary chain={sim.data} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulationSummary({ chain }: { chain: RouteChain }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
        <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
        <p className="text-sm font-semibold">Feasible chain</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Net" value={formatCurrency(chain.profit)} colorClass={routeProfitColor(chain.daily_net_profit)} />
        <Stat label="$/Day" value={formatCurrency(chain.daily_net_profit)} colorClass={routeProfitColor(chain.daily_net_profit)} />
        <Stat label="Days" value={chain.estimated_days.toFixed(1)} />
        <Stat label="Gross Pay" value={formatCurrency(chain.gross_pay)} />
        <Stat label="Loaded mi" value={Math.round(chain.loaded_miles).toLocaleString()} />
        <Stat label="Deadhead mi" value={Math.round(chain.deadhead_miles).toLocaleString()} />
        <Stat label="$/mi all-in" value={`$${chain.all_in_gross_rpm.toFixed(2)}`} />
        <Stat label="$/mi loaded" value={`$${chain.rate_per_mile.toFixed(2)}`} />
        <Stat label="Deadhead %" value={chain.deadhead_pct != null ? `${chain.deadhead_pct.toFixed(0)}%` : "—"} />
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
        Cost model uses ${chain.effective_cost_per_mile.toFixed(2)}/mi.
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
