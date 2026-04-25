"use client";

import { useState, useEffect } from "react";
import { XIcon, Loader2Icon, AlertCircleIcon, SearchIcon, MapPinIcon, PlayIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import { RouteDetailPanel } from "@/features/routes/views/desktop/route-detail-panel";
import { useSimulate } from "@/core/hooks/use-simulate";
import { useOrderSearch } from "@/core/hooks/use-orders";
import { useSettings } from "@/core/hooks/use-settings";
import { searchPlaces } from "@/features/routes/components/search-form";
import type { PlaceResult } from "@/features/routes/components/search-form";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";
import type { Order } from "@/core/types";

function sortForSimulation(a: Order, b: Order): {
  sorted: [Order, Order];
  isInfeasible: boolean;
} {
  const canAB = (() => {
    if (!a.delivery_date_early_utc || !b.pickup_date_late_utc) return true;
    return new Date(a.delivery_date_early_utc) <= new Date(b.pickup_date_late_utc);
  })();

  const canBA = (() => {
    if (!b.delivery_date_early_utc || !a.pickup_date_late_utc) return true;
    return new Date(b.delivery_date_early_utc) <= new Date(a.pickup_date_late_utc);
  })();

  const isInfeasible = !canAB && !canBA;

  if (canAB && !canBA) return { sorted: [a, b], isInfeasible };
  if (canBA && !canAB) return { sorted: [b, a], isInfeasible };

  const aPickup = a.pickup_date_early_utc ? new Date(a.pickup_date_early_utc).getTime() : Infinity;
  const bPickup = b.pickup_date_early_utc ? new Date(b.pickup_date_early_utc).getTime() : Infinity;
  return { sorted: aPickup <= bPickup ? [a, b] : [b, a], isInfeasible };
}

// ── Order picker ────────────────────────────────────────────────────────────

function OrderPicker({
  companyId,
  placeholder,
  value,
  onChange,
}: {
  companyId: string;
  placeholder: string;
  value: Order | null;
  onChange: (o: Order | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results, isLoading } = useOrderSearch(companyId, query);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <div className="flex-1 min-w-0 truncate">
          <span className="font-mono font-medium">{value.order_id}</span>
          <span className="ml-2 text-muted-foreground text-xs">
            {value.origin_city}, {value.origin_state}
            {" → "}
            {value.destination_city}, {value.destination_state}
          </span>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
        />
      </div>
      {open && query.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {!isLoading && (!results || results.length === 0) && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No orders found</div>
          )}
          {results?.map((order) => (
            <button
              key={order.order_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(order); setQuery(""); setOpen(false); }}
            >
              <span className="font-mono font-medium">{order.order_id}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {order.origin_city}, {order.origin_state}
                {" → "}
                {order.destination_city}, {order.destination_state}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Location picker ──────────────────────��──────────────────────────────────

function LocationPicker({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: PlaceResult | null;
  onChange: (p: PlaceResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleChange(v: string) {
    setQuery(v);
    if (v.length < 2) { setResults([]); setOpen(false); return; }
    setOpen(true);
    setSearching(true);
    try {
      setResults(await searchPlaces(v));
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <div className="flex-1 min-w-0 truncate">
          <span className="font-medium">{value.name}</span>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPinIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
        />
      </div>
      {open && (
        <div className="absolute z-[100] mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {searching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2Icon className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No places found</div>
          )}
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(place); setQuery(""); setOpen(false); setResults([]); }}
            >
              {place.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────��────────────────────���───────

interface SimulatePanelProps {
  companyId: string;
  onClose: () => void;
}

export function SimulatePanel({ companyId, onClose }: SimulatePanelProps) {
  const { data: settings } = useSettings();
  const hasHomeBase = !!settings?.home_base_lat && !!settings?.home_base_lng;
  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  const [orderA, setOrderA] = useState<Order | null>(null);
  const [orderB, setOrderB] = useState<Order | null>(null);
  const [originPlace, setOriginPlace] = useState<PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<PlaceResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // Reset simulation when any input changes
  useEffect(() => {
    setHasRun(false);
  }, [
    orderA?.order_id,
    orderB?.order_id,
    originPlace?.lat,
    originPlace?.lng,
    destPlace?.lat,
    destPlace?.lng,
  ]);

  const { sorted, isInfeasible } = orderA && orderB
    ? sortForSimulation(orderA, orderB)
    : { sorted: [null, null] as [null, null], isInfeasible: false };

  const orderIds = (sorted as (Order | null)[])
    .filter((o): o is Order => o !== null)
    .map((o) => o.order_id);

  const originOverride = originPlace ? { lat: originPlace.lat, lng: originPlace.lng } : undefined;
  const destOverride = destPlace
    ? { lat: destPlace.lat, lng: destPlace.lng, city: destPlace.name.split(",")[0] }
    : undefined;

  const { data: chain, isLoading, error } = useSimulate(
    orderIds,
    hasRun && !isInfeasible,
    originOverride,
    destOverride,
  );

  const bothSelected = !!(orderA && orderB);
  const canRun = bothSelected && hasHomeBase && !isInfeasible;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
          Route Simulation
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <div className="p-4 space-y-2 border-b shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origin</p>
        <LocationPicker
          placeholder="Simulation origin (optional)..."
          value={originPlace}
          onChange={setOriginPlace}
        />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Destination</p>
        <LocationPicker
          placeholder="Simulation destination (optional)..."
          value={destPlace}
          onChange={setDestPlace}
        />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Orders</p>
        <OrderPicker
          companyId={companyId}
          placeholder="Search first order by ID..."
          value={orderA}
          onChange={setOrderA}
        />
        <OrderPicker
          companyId={companyId}
          placeholder="Search second order by ID..."
          value={orderB}
          onChange={setOrderB}
        />
        <Button
          className="w-full mt-1"
          disabled={!canRun}
          onClick={() => setHasRun(true)}
        >
          <PlayIcon className="h-4 w-4" />
          Run Simulation
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        {!hasHomeBase && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <AlertCircleIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Set your home base location in Settings to use Route Simulation.
            </p>
          </div>
        )}

        {hasHomeBase && !hasRun && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              {bothSelected
                ? "Click Run Simulation to calculate this route."
                : "Search for two orders above to simulate the route."}
            </p>
          </div>
        )}

        {hasHomeBase && hasRun && isInfeasible && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <AlertCircleIcon className="h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium">Incompatible time windows</p>
            <p className="text-sm text-muted-foreground">
              These two orders cannot be combined in either sequence — the first
              delivery cannot complete before the second pickup window closes.
            </p>
          </div>
        )}

        {hasHomeBase && hasRun && !isInfeasible && isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Simulating route...</p>
          </div>
        )}

        {hasHomeBase && hasRun && !isInfeasible && !isLoading && error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <AlertCircleIcon className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              These orders could not be simulated due to scheduling conflicts.
            </p>
          </div>
        )}

        {hasHomeBase && hasRun && !isInfeasible && !isLoading && !error && chain && (
          <RouteDetailPanel
            chain={chain}
            costPerMile={costPerMile}
            searchParams={null}
            fullWidth
          />
        )}
      </div>
    </div>
  );
}
