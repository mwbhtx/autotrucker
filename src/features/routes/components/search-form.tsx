"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/platform/web/components/ui/input";
import { Button } from "@/platform/web/components/ui/button";
import { Slider } from "@/platform/web/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/platform/web/components/ui/popover";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { ChevronDown, LocateIcon, SlidersHorizontal, XIcon, SearchIcon } from "lucide-react";
import { BorderBeam } from "@/platform/web/components/ui/border-beam";
import { Calendar } from "@/platform/web/components/ui/calendar";
import { useSettings, useUpdateSettings } from "@/core/hooks/use-settings";
import { TRAILER_CATEGORIES, expandTrailerCodes, codesToLabels, DEFAULT_MAX_TRIP_DAYS, DEFAULT_COST_PER_MILE, ORDER_COUNT_OPTIONS, DEFAULT_NUM_ORDERS, DEFAULT_ORIGIN_RADIUS_MILES, DEFAULT_DEST_RADIUS_MILES, MAX_DEADHEAD_PCT_OPTIONS, MIN_DAILY_PROFIT_OPTIONS, MIN_RPM_OPTIONS, MAX_INTERLEG_DEADHEAD_OPTIONS } from "@mwbhtx/haulvisor-core";

import type { RouteSearchParams } from "@/core/hooks/use-routes";

export type SearchParams = RouteSearchParams;


function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

const LOCATIONIQ_KEY = process.env.NEXT_PUBLIC_LOCATIONIQ_KEY ?? "";

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.length < 2) return [];
  const url = `https://us1.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&countrycodes=us&limit=5&tag=place:city,place:town`;
  const res = await fetch(url);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => ({
    name: [item.address?.city || item.address?.town || item.display_name?.split(",")[0], item.address?.state].filter(Boolean).join(", "),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

/* ---- PlaceAutocomplete (reusable) ---- */

export function PlaceAutocomplete({
  placeholder,
  value,
  onSelect,
  trailing,
  onTyping,
  large,
}: {
  placeholder: string;
  value: PlaceResult | null;
  onSelect: (place: PlaceResult | null) => void;
  trailing?: React.ReactNode;
  onTyping?: (hasText: boolean) => void;
  /** Use larger sizing for mobile touch targets */
  large?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.name && value.name !== query) {
      setQuery(value.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync only when value changes, not when user types
  }, [value?.name]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const places = await searchPlaces(q);
    setResults(places);
    setOpen(places.length > 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSelect(null);
    onTyping?.(val.length > 0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (place: PlaceResult) => {
    setQuery(place.name);
    onSelect(place);
    onTyping?.(false);
    setOpen(false);
    setResults([]);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={large ? "flex-1 h-12 text-base px-4" : "flex-1"}
        />
        {trailing}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              className={`w-full text-left hover:bg-accent transition-colors ${large ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"}`}
              onClick={() => handleSelect(place)}
            >
              {place.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Days Out Pill ---- */

function DaysOutPill({ value, onChange, departureDate }: { value: number; onChange: (v: number) => void; departureDate: string }) {
  const [open, setOpen] = useState(false);

  const returnDate = (() => {
    const d = new Date(departureDate + "T00:00:00");
    d.setDate(d.getDate() + value);
    return d;
  })();
  const returnLabel = returnDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Days Out:</span>
          <span className="flex items-center gap-1.5">
            <span className="dark:text-primary">{value}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Days Out</p>
            <span className="text-sm font-semibold">{value} {value === 1 ? "day" : "days"}</span>
          </div>
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={1}
            max={10}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 day</span>
            <span>10 days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Home by {returnLabel}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Num Orders Pill ---- */

function NumOrdersPill({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const label = `${value}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Orders:</span>
          <span className="flex items-center gap-1.5">
            <span className="dark:text-primary">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44" align="start">
        <div className="space-y-2 p-1">
          <p className="text-sm font-medium">Number of Orders</p>
          <div className="flex gap-1.5">
            {ORDER_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { onChange(n); setOpen(false); }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium border transition-colors ${value === n ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              >
                {String(n)}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Filter Pill (shared wrapper for floating filter buttons) ---- */

function FilterPill({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          {label && <span className="text-muted-foreground">{label}:</span>}
          <span className="flex items-center gap-1.5">
            <span className="dark:text-primary">{value}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        {typeof children === "function" ? children(() => setOpen(false)) : children}
      </PopoverContent>
    </Popover>
  );
}

/* ---- Location Pill (auto-closes on select) ---- */

function LocationPill({
  label,
  title,
  value,
  onSelect,
  onUseHome,
  homeCityLabel,
  onUseMyLocation,
  pulse,
  onOpenChange: onOpenChangeProp,
  footer,
}: {
  label: string;
  title: string;
  value: PlaceResult | null;
  onSelect: (place: PlaceResult | null) => void;
  onUseHome?: () => void;
  homeCityLabel?: string;
  onUseMyLocation?: () => void;
  pulse?: boolean;
  onOpenChange?: (open: boolean) => void;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); onOpenChangeProp?.(o); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`relative overflow-hidden flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap ${
            pulse ? "animate-pulse-border" : ""
          }`}
        >
          {!value && (
            <BorderBeam
              size={40}
              duration={4}
              colorFrom="var(--primary)"
              colorTo="var(--primary)"
              borderWidth={2}
            />
          )}
          <span className="text-muted-foreground">{label}:</span>
          <span className="flex items-center gap-1.5">
            <span className="dark:text-primary">{value?.name?.split(",")[0] ?? "Not set"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{title}</p>
            {value && (
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
          <PlaceAutocomplete
            placeholder="City, state"
            value={value}
            onSelect={(place) => {
              onSelect(place);
              if (place) setOpen(false);
            }}
            trailing={onUseMyLocation ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => { onUseMyLocation(); setOpen(false); }}
                title="Use my current location"
              >
                <LocateIcon className="h-4 w-4" />
              </Button>
            ) : undefined}
          />
          {onUseHome && homeCityLabel && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => { onUseHome(); setOpen(false); }}
            >
              Use Home ({homeCityLabel})
            </Button>
          )}
          {footer}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Floating Search Filters ---- */

interface SearchFiltersProps {
  onSearch: (params: RouteSearchParams) => void;
  onClearSearch?: () => void;
  onOriginChange?: (origin: { lat: number; lng: number; city: string } | null) => void;
  onDestinationChange?: (dest: { lat: number; lng: number; city: string } | null) => void;
  /** Fires immediately when a filter changes, before the debounced search fires */
  onFilterPending?: () => void;
  /** Whether onboarding tour is currently visible — hides origin nudge */
  isOnboarding?: boolean;
  hasHome?: boolean;
  resetKey?: number;
  mobile?: boolean;
  /** Render only the essential pills stacked vertically for map overlay */
  mapOverlay?: boolean;
  /** Render as a single compact horizontal bar for mobile */
  compactBar?: boolean;
  /** Extra elements to render in the compact bar's second row (e.g. sort/filter icons) */
  children?: React.ReactNode;
  /** Whether a search is currently in progress */
  isSearching?: boolean;
  /** Cancel the current search */
  onCancel?: () => void;
  /** Whether route results are currently available */
  hasResults?: boolean;
}

export function SearchFilters({
  onSearch,
  onClearSearch,
  onOriginChange,
  onDestinationChange,
  onFilterPending,
  isOnboarding,
  hasHome,
  resetKey,
  mobile,
  mapOverlay,
  compactBar,
  children,
  isSearching,
  onCancel,
  hasResults,
}: SearchFiltersProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  // Ephemeral per-search toggle. When on, overrides the driver's persisted
  // tolerance settings with 0/0 for this search only — useful for "show
  // me only routes that strictly hit every pickup/delivery window."
  const [strictSchedule, setStrictSchedule] = useState(false);

  const driverProfile = settings ? {
    trailer_types: settings.trailer_types?.length ? settings.trailer_types.join('|') : undefined,
    max_weight: settings.max_weight ?? undefined,
    hazmat_certified: settings.hazmat_certified ?? undefined,
    twic_card: settings.twic_card ?? undefined,
    team_driver: settings.team_driver ?? undefined,
    no_tarps: settings.no_tarps ?? undefined,
    // Strict-schedule toggle wins over persisted settings when on.
    late_tolerance_hours: strictSchedule ? 0 : (settings.late_tolerance_hours ?? undefined),
    early_tolerance_hours: strictSchedule ? 0 : (settings.early_tolerance_hours ?? undefined),
    cost_per_mile: (settings.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE,
  } : (strictSchedule ? { late_tolerance_hours: 0, early_tolerance_hours: 0 } : {});

  // Restore persisted filter state from sessionStorage
  const restored = useRef<{
    origin?: PlaceResult | null;
    destination?: PlaceResult | null;
    departureDate?: string;
    daysOut?: number;
    numOrders?: number;
  } | null>(null);
  if (restored.current === null && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("hv-route-filters");
      restored.current = raw ? JSON.parse(raw) : {};
    } catch { restored.current = {}; }
  }
  const r = restored.current ?? {};

  // Compute tomorrow as default departure date
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [origin, setOrigin] = useState<PlaceResult | null>(r.origin ?? null);
  const [originPopoverOpen, setOriginPopoverOpen] = useState(false);
  const [destination, setDestination] = useState<PlaceResult | null>(r.destination ?? null);
  const [departureDate, setDepartureDate] = useState<string>(r.departureDate ?? tomorrow);
  const [daysOut, setDaysOut] = useState<number>(r.daysOut ?? DEFAULT_MAX_TRIP_DAYS);
  const [numOrders, setNumOrders] = useState<number>(r.numOrders ?? DEFAULT_NUM_ORDERS);
  const [originRadius, setOriginRadius] = useState<number>(DEFAULT_ORIGIN_RADIUS_MILES);
  const [destRadius, setDestRadius] = useState<number>(DEFAULT_DEST_RADIUS_MILES);
  const [maxDeadheadPct, setMaxDeadheadPct] = useState<number | undefined>(undefined);
  const [minDailyProfit, setMinDailyProfit] = useState<number | undefined>(undefined);
  const [minRpm, setMinRpm] = useState<number | undefined>(undefined);
  const [maxInterlegDh, setMaxInterlegDh] = useState<number | undefined>(undefined);
  const [defaultsLoaded, setDefaultsLoaded] = useState(!!r.origin);

  const hasHomeLocation =
    settings?.home_base_lat != null &&
    settings?.home_base_lng != null &&
    !!settings?.home_base_city;

  const homePlace: PlaceResult | null = hasHomeLocation
    ? {
        name: `${settings!.home_base_city}, ${settings!.home_base_state}`,
        lat: settings!.home_base_lat!,
        lng: settings!.home_base_lng!,
      }
    : null;

  const homeMode = hasHome ?? hasHomeLocation;

  // Persist filter state to sessionStorage (only from the primary instance, not compactBar)
  useEffect(() => {
    if (compactBar) return;
    try {
      sessionStorage.setItem("hv-route-filters", JSON.stringify({
        origin, destination, departureDate, daysOut, numOrders,
      }));
    } catch {}
  }, [origin, destination, departureDate, daysOut, compactBar]);

  // Reset filters when clear is triggered
  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    setOrigin(null);
    setDestination(null);
    lastSearchedParamsKey.current = "";
  }, [resetKey]);

  // Pre-fill origin from settings or sessionStorage (no auto-search)
  const searchEnabled = useRef(false);
  useEffect(() => {
    if (!settings) return;
    if (defaultsLoaded) {
      if (!searchEnabled.current) {
        searchEnabled.current = true;
        if (!compactBar && origin) {
          onOriginChange?.(origin ? { lat: origin.lat, lng: origin.lng, city: origin.name.split(",")[0] } : null);
          if (destination) {
            onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
          }
        }
      }
      return;
    }
    // First load with no restored state — prefill from home base
    if (homePlace) {
      setOrigin(homePlace);
    }
    setDefaultsLoaded(true);
    searchEnabled.current = true;
    if (!compactBar) {
      setTimeout(() => {
        if (homePlace) {
          onOriginChange?.({ lat: homePlace.lat, lng: homePlace.lng, city: (homePlace.name ?? '').split(",")[0] });
        }
      }, 0);
    }
  }, [settings, defaultsLoaded]);

  // Stable key for driver profile so it can be a useEffect dependency
  const profileKey = JSON.stringify(driverProfile);

  // Track current vs last-searched params to show/hide Search button
  const currentParamsKey = JSON.stringify([origin?.lat, origin?.lng, destination?.lat, destination?.lng, departureDate, daysOut, numOrders, originRadius, destRadius, maxDeadheadPct, minDailyProfit, minRpm, maxInterlegDh, profileKey]);
  const lastSearchedParamsKey = useRef<string>("");
  const hasSearched = lastSearchedParamsKey.current !== "";

  // When a search ends (isSearching transitions true→false), allow re-searching with same params
  const prevSearching = useRef(false);
  useEffect(() => {
    if (prevSearching.current && !isSearching) {
      lastSearchedParamsKey.current = "";
    }
    prevSearching.current = !!isSearching;
  }, [isSearching]);
  const paramsChanged = currentParamsKey !== lastSearchedParamsKey.current;

  // Fire search (shared helper)
  const fireSearch = useCallback(() => {
    if (!origin) {
      onClearSearch?.();
      return;
    }
    onOriginChange?.({ lat: origin.lat, lng: origin.lng, city: origin.name.split(",")[0] });
    onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
    lastSearchedParamsKey.current = currentParamsKey;
    onSearch({
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      departure_date: departureDate,
      ...(destination ? { destination_lat: destination.lat, destination_lng: destination.lng, destination_city: destination.name.split(",")[0] } : {}),
      max_trip_days: daysOut,
      num_orders: numOrders,
      origin_radius_miles: originRadius,
      ...(destination ? { dest_radius_miles: destRadius } : {}),
      ...(maxDeadheadPct != null ? { max_deadhead_pct: maxDeadheadPct } : {}),
      ...(minDailyProfit != null ? { min_daily_profit: minDailyProfit } : {}),
      ...(minRpm != null ? { min_rpm: minRpm } : {}),
      ...(maxInterlegDh != null ? { max_interleg_deadhead_miles: maxInterlegDh } : {}),
      ...driverProfile,
      _t: Date.now(),
    });
  }, [origin, destination, departureDate, daysOut, numOrders, originRadius, destRadius, maxDeadheadPct, minDailyProfit, minRpm, maxInterlegDh, profileKey, onClearSearch, currentParamsKey]);

  // Update map markers when origin/destination change (no auto-search, no clearing results)
  useEffect(() => {
    if (!searchEnabled.current) return;
    onOriginChange?.(origin ? { lat: origin.lat, lng: origin.lng, city: origin.name.split(",")[0] } : null);
  }, [origin]);

  useEffect(() => {
    if (!searchEnabled.current) return;
    onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
  }, [destination]);

  const handleSaveAsHome = () => {
    if (!destination) return;
    const parts = destination.name.split(", ");
    updateSettings.mutate({
      home_base_city: parts[0] ?? destination.name,
      home_base_state: parts[1] ?? "",
      home_base_lat: destination.lat,
      home_base_lng: destination.lng,
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${latitude}&lon=${longitude}&format=json`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.display_name?.split(",")[0];
        const state = data.address?.state;
        const name = [city, state].filter(Boolean).join(", ") || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        setOrigin({ name, lat: latitude, lng: longitude });
      } catch {
        setOrigin({ name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`, lat: latitude, lng: longitude });
      }
    });
  };

  const showSaveAsHome = !homeMode && destination != null;

  // Shared filter elements
  const departureDatePill = (
    <div id="onborda-departure-date">
      <FilterPill label={compactBar || mobile ? "Dep" : "Departure"} value={departureDate ? formatDateShort(departureDate) : "Tomorrow"}>
        {(close) => (
          <div className="p-0">
            <Calendar
              mode="single"
              selected={departureDate ? new Date(departureDate + "T00:00:00") : undefined}
              disabled={{ before: new Date() }}
              onSelect={(day: Date | undefined) => {
                if (day) {
                  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  setDepartureDate(iso);
                  close();
                }
              }}
              defaultMonth={departureDate ? new Date(departureDate + "T00:00:00") : undefined}
            />
          </div>
        )}
      </FilterPill>
    </div>
  );

  const originPill = (
    <div id="onborda-origin">
      <LocationPill
        label={compactBar || mobile ? "O" : "Origin"}
        title="Origin"
        value={origin}
        onSelect={setOrigin}
        onUseHome={hasHomeLocation ? () => setOrigin(homePlace) : undefined}
        homeCityLabel={hasHomeLocation ? settings!.home_base_city! : undefined}
        onUseMyLocation={handleUseMyLocation}
        pulse={false}
        onOpenChange={setOriginPopoverOpen}
        footer={
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Radius</span>
            <Input
              type="number"
              min={1}
              max={1000}
              value={originRadius}
              onChange={(e) => setOriginRadius(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              className="w-20 h-7 text-sm"
            />
            <span className="text-xs text-muted-foreground">mi</span>
          </div>
        }
      />
    </div>
  );

  const destPill = (
    <div id="onborda-destination">
      <LocationPill
        label={compactBar || mobile ? "D" : "Destination"}
        title="Destination (optional)"
        value={destination}
        onSelect={setDestination}
        onUseHome={hasHomeLocation ? () => setDestination(homePlace) : undefined}
        homeCityLabel={hasHomeLocation ? settings!.home_base_city! : undefined}
        footer={destination ? (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Radius</span>
            <Input
              type="number"
              min={1}
              max={1000}
              value={destRadius}
              onChange={(e) => setDestRadius(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              className="w-20 h-7 text-sm"
            />
            <span className="text-xs text-muted-foreground">mi</span>
          </div>
        ) : undefined}
      />
    </div>
  );

  const clearButton = null;

  /* ---- Compact bar layout (two rows) ---- */
  if (compactBar) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Row 1: origin, destination, departure date */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {originPill}
          {destPill}
          {departureDatePill}
        </div>
        {/* Row 2: action icons */}
        <div className="flex items-center gap-1.5">
          {children}
        </div>
      </div>
    );
  }

  /* ---- Map overlay layout (essential pills stacked) ---- */
  if (mapOverlay) {
    return (
      <div className="flex flex-col gap-1.5">
        {originPill}
        {destPill}
        {departureDatePill}
      </div>
    );
  }

  /* ---- Mobile layout ---- */
  if (mobile) {
    return (
      <div className="flex flex-col gap-1.5 mobile-filters">
        <div className="flex items-center gap-1.5 flex-wrap">
          {originPill}
          {destPill}
          {departureDatePill}
          <DaysOutPill value={daysOut} onChange={setDaysOut} departureDate={departureDate} />
          <NumOrdersPill value={numOrders} onChange={setNumOrders} />
          {isSearching ? (
            <Button
              onClick={onCancel}
              className="h-9 rounded-full px-5 text-sm font-medium"
            >
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Cancel Search
            </Button>
          ) : (
            <Button
              onClick={fireSearch}
              disabled={!origin}
              className="h-9 rounded-full px-5 text-sm font-medium"
            >
              Search
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ---- Desktop layout ---- */
  const showOriginHint = !origin && defaultsLoaded && !isOnboarding && !hasResults;
  const showSearchHint = !!origin && !isSearching && defaultsLoaded && !isOnboarding && !hasResults;

  const hintText = showOriginHint
    ? <>Enter an <strong className="bg-primary text-primary-foreground px-1 py-0.5 rounded">origin city</strong> and click <strong className="bg-primary text-primary-foreground px-1 py-0.5 rounded">Search</strong> to get route suggestions.</>
    : showSearchHint
      ? <>Click <strong className="bg-primary text-primary-foreground px-1 py-0.5 rounded">Search</strong> to analyze routes from your origin city.</>
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {originPill}
        {destPill}
        {departureDatePill}
        <div id="onborda-days-out"><DaysOutPill value={daysOut} onChange={setDaysOut} departureDate={departureDate} /></div>
        <NumOrdersPill value={numOrders} onChange={setNumOrders} />
        <div id="onborda-all-filters"><AllFiltersPopover
          maxDeadheadPct={maxDeadheadPct} setMaxDeadheadPct={setMaxDeadheadPct}
          minDailyProfit={minDailyProfit} setMinDailyProfit={setMinDailyProfit}
          minRpm={minRpm} setMinRpm={setMinRpm}
          maxInterlegDh={maxInterlegDh} setMaxInterlegDh={setMaxInterlegDh}
          strictSchedule={strictSchedule} setStrictSchedule={setStrictSchedule}
        /></div>
        {!isSearching && (
          <Button
            onClick={fireSearch}
            disabled={!origin}
            className="h-9 rounded-full px-5 text-sm font-medium"
          >
            <SearchIcon className="h-4 w-4" />
            Search
          </Button>
        )}
        {clearButton}
      </div>
      {hintText && (
        <div className="bg-card -mx-3 px-3 py-2.5 mt-2 text-sm font-medium text-muted-foreground">
          {hintText}
        </div>
      )}
    </div>
  );
}

/* ---- All Filters Popover ---- */

function AllFiltersPopover({
  maxDeadheadPct, setMaxDeadheadPct,
  minDailyProfit, setMinDailyProfit,
  minRpm, setMinRpm,
  maxInterlegDh, setMaxInterlegDh,
  strictSchedule, setStrictSchedule,
}: {
  maxDeadheadPct: number | undefined;
  setMaxDeadheadPct: (v: number | undefined) => void;
  minDailyProfit: number | undefined;
  setMinDailyProfit: (v: number | undefined) => void;
  minRpm: number | undefined;
  setMinRpm: (v: number | undefined) => void;
  maxInterlegDh: number | undefined;
  setMaxInterlegDh: (v: number | undefined) => void;
  strictSchedule: boolean;
  setStrictSchedule: (v: boolean) => void;
}) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [trailerLabels, setTrailerLabels] = useState<string[]>([]);
  const [maxWeight, setMaxWeight] = useState("");
  const [hazmat, setHazmat] = useState(false);
  const [twic, setTwic] = useState(false);
  const [team, setTeam] = useState(false);
  const [noTarps, setNoTarps] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings) return;
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setHazmat(settings.hazmat_certified ?? false);
    setTwic(settings.twic_card ?? false);
    setTeam(settings.team_driver ?? false);
    setNoTarps(settings.no_tarps ?? false);
    setTimeout(() => { initialized.current = true; }, 100);
  }, [settings]);

  function save(data: Record<string, unknown>) {
    updateSettings.mutate(data as any);
  }

  function handleTrailerToggle(label: string) {
    setTrailerLabels((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      if (initialized.current) {
        save({ trailer_types: next.length > 0 ? expandTrailerCodes(next) : null });
      }
      return next;
    });
  }

  function handleBool(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    if (initialized.current) save({ [key]: next || null });
  }

  const activeCount = [
    trailerLabels.length > 0,
    maxWeight !== "",
    hazmat,
    twic,
    team,
    noTarps,
    maxDeadheadPct != null,
    minDailyProfit != null,
    minRpm != null,
    maxInterlegDh != null,
  ].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>All Filters</span>
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-5">
          {/* Trailer Types */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Trailer Types</p>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              {TRAILER_CATEGORIES.map((cat) => {
                const selected = trailerLabels.includes(cat.label);
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => handleTrailerToggle(cat.label)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <span>{cat.label}</span>
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      }`}
                    >
                      {selected && <span className="text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {trailerLabels.length === 0 ? "No filter — all types shown" : `${trailerLabels.length} selected`}
            </p>
          </div>

          {/* Max Weight */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Max Weight (lbs)</p>
            <Input
              type="number"
              min={1000}
              max={80000}
              step={1000}
              value={maxWeight}
              onChange={(e) => {
                setMaxWeight(e.target.value);
                if (!initialized.current) return;
                const val = e.target.value;
                if (val === "") {
                  save({ max_weight: null });
                } else {
                  const num = Number(val);
                  if (!isNaN(num) && num >= 1000 && num <= 80000) {
                    save({ max_weight: num });
                  }
                }
              }}
              placeholder="e.g. 45000"
            />
          </div>

          {/* Load Preferences */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Load Preferences</p>
            <div className="space-y-1">
              {[
                { label: "No Tarps", checked: noTarps, key: "no_tarps", setter: setNoTarps },
              ].map((cert) => (
                <button
                  key={cert.key}
                  type="button"
                  onClick={() => handleBool(cert.key, cert.checked, cert.setter)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <span>{cert.label}</span>
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      cert.checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                  >
                    {cert.checked && <span className="text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Certifications</p>
            <div className="space-y-1">
              {[
                { label: "Hazmat", checked: hazmat, key: "hazmat_certified", setter: setHazmat },
                { label: "TWIC Card", checked: twic, key: "twic_card", setter: setTwic },
                { label: "Team Driver", checked: team, key: "team_driver", setter: setTeam },
              ].map((cert) => (
                <button
                  key={cert.key}
                  type="button"
                  onClick={() => handleBool(cert.key, cert.checked, cert.setter)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <span>{cert.label}</span>
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      cert.checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                  >
                    {cert.checked && <span className="text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Route Preferences */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Route Preferences</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStrictSchedule(!strictSchedule)}
                className="flex w-full items-center justify-between rounded-md py-1 text-sm hover:bg-accent transition-colors"
                title="Reject routes that arrive outside any pickup/delivery window. Ignores your persistent tolerance settings for this search."
              >
                <span className="text-muted-foreground">Strict schedule</span>
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    strictSchedule ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {strictSchedule && <span className="text-xs">✓</span>}
                </div>
              </button>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max DH %</span>
                <select
                  value={maxDeadheadPct ?? ''}
                  onChange={(e) => setMaxDeadheadPct(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {MAX_DEADHEAD_PCT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Min $/Day</span>
                <select
                  value={minDailyProfit ?? ''}
                  onChange={(e) => setMinDailyProfit(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {MIN_DAILY_PROFIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Min $/Mi</span>
                <select
                  value={minRpm ?? ''}
                  onChange={(e) => setMinRpm(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {MIN_RPM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max DH Between</span>
                <select
                  value={maxInterlegDh ?? ''}
                  onChange={(e) => setMaxInterlegDh(e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Any</option>
                  {MAX_INTERLEG_DEADHEAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Mobile Filter Sheet ---- */

interface MobileFilterSheetProps extends Omit<SearchFiltersProps, "mobile"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileFilterSheet({ open, onOpenChange, ...filterProps }: MobileFilterSheetProps) {
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Sheet content */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border/50 p-4 pt-3 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 hover:bg-muted transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <SearchFilters mobile {...filterProps} />
      </div>
    </div>
  );
}


