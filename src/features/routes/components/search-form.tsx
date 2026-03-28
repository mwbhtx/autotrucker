"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUpIcon, LocateIcon, SlidersHorizontal, XIcon } from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Calendar } from "@/components/ui/calendar";
import { useSettings, useUpdateSettings } from "@/lib/hooks/use-settings";
import { TRAILER_CATEGORIES, expandTrailerCodes, codesToLabels } from "@mwbhtx/haulvisor-core";
import type { RouteSearchParams, RoundTripSearchParams } from "@/lib/hooks/use-routes";

export type SearchParams = RouteSearchParams;

export type RiskLevel = "any" | "safe" | "moderate" | "bold";

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.length < 2) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=place&limit=5`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.features ?? []).map((f: any) => ({
    name: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
  }));
}

/* ---- PlaceAutocomplete (reusable) ---- */

export function PlaceAutocomplete({
  placeholder,
  value,
  onSelect,
  trailing,
  onTyping,
}: {
  placeholder: string;
  value: PlaceResult | null;
  onSelect: (place: PlaceResult | null) => void;
  trailing?: React.ReactNode;
  onTyping?: (hasText: boolean) => void;
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
          className="flex-1"
        />
        {trailing}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
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

/* ---- Max Idle Pill ---- */

const IDLE_OPTIONS = [
  { value: 24, label: "1 Day" },
  { value: 48, label: "2 Days" },
  { value: 72, label: "3 Days" },
  { value: 96, label: "4 Days" },
  { value: 120, label: "5 Days" },
  { value: 0, label: "Any" },
] as const;

function MaxIdlePill({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const currentLabel = IDLE_OPTIONS.find((o) => o.value === value)?.label ?? "Any";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Max Idle:</span>
          <span className="flex items-center gap-1.5">
            <span>{currentLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <div className="space-y-2 p-1">
          <p className="text-sm font-medium">Max Idle Between Loads</p>
          <div className="flex flex-wrap gap-2">
            {IDLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors ${
                  value === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum idle time between delivering one load and picking up the next
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Deadhead % Pill ---- */

function DeadheadPctPill({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); setDraft(value); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Max Deadhead:</span>
          <span className="flex items-center gap-1.5">
            <span>{value}%</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Max Deadhead %</p>
            <span className="text-sm font-semibold">{draft}%</span>
          </div>
          <Slider
            value={[draft]}
            onValueChange={([v]) => setDraft(v)}
            min={5}
            max={20}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>20%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Total deadhead miles must not exceed {draft}% of total miles driven
          </p>
          <Button
            className="w-full"
            onClick={() => { onChange(draft); setOpen(false); }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Work Days constants (used in AllFiltersPopover) ---- */

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/* ---- Home By Pill (calendar popover) ---- */

function HomeByPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Home By:</span>
          <span className="flex items-center gap-1.5">
            <span>{value ? formatDateShort(value) : "Any"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={{ before: new Date() }}
          onSelect={(day: Date | undefined) => {
            if (day) {
              const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              onChange(iso);
            }
            setOpen(false);
          }}
          defaultMonth={selected}
        />
        {value && (
          <div className="border-t px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              Clear
            </Button>
          </div>
        )}
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
            <span>{value}</span>
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
              colorFrom="#ff5601"
              colorTo="#ff7a33"
              borderWidth={2}
            />
          )}
          <span className="text-muted-foreground">{label}:</span>
          <span className="flex items-center gap-1.5">
            <span>{value?.name?.split(",")[0] ?? "Not set"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">{title}</p>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---- Floating Search Filters ---- */

interface SearchFiltersProps {
  onSearchRoundTrip: (params: RoundTripSearchParams) => void;
  onSearch: (params: RouteSearchParams) => void;
  onClearSearch?: () => void;
  onTripModeChange?: (mode: "one-way" | "round-trip") => void;
  onOriginChange?: (origin: { lat: number; lng: number; city: string } | null) => void;
  onDestinationChange?: (dest: { lat: number; lng: number; city: string } | null) => void;
  /** Fires immediately when a filter changes, before the debounced search fires */
  onFilterPending?: () => void;
  /** Whether onboarding tour is currently visible — hides origin nudge */
  isOnboarding?: boolean;
  hasHome?: boolean;
  resetKey?: number;
  initialTripType?: "one-way" | "round-trip";
  mobile?: boolean;
  /** Render only the essential pills stacked vertically for map overlay */
  mapOverlay?: boolean;
  /** Render as a single compact horizontal bar for mobile */
  compactBar?: boolean;
  /** Extra elements to render in the compact bar's second row (e.g. sort/filter icons) */
  children?: React.ReactNode;
}

export function SearchFilters({
  onSearchRoundTrip,
  onSearch,
  onClearSearch,
  onTripModeChange,
  onOriginChange,
  onDestinationChange,
  onFilterPending,
  isOnboarding,
  hasHome,
  resetKey,
  initialTripType,
  mobile,
  mapOverlay,
  compactBar,
  children,
}: SearchFiltersProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const driverProfile = settings ? {
    trailer_types: settings.trailer_types?.length ? settings.trailer_types.join('|') : undefined,
    max_weight: settings.max_weight ?? undefined,
    hazmat_certified: settings.hazmat_certified ?? undefined,
    twic_card: settings.twic_card ?? undefined,
    team_driver: settings.team_driver ?? undefined,
    max_assigned_orders: settings.max_assigned_orders ?? undefined,
    cost_per_mile: settings.cost_per_mile ?? undefined,
    diesel_price_per_gallon: settings.diesel_price_per_gallon ?? undefined,
    maintenance_per_mile: settings.maintenance_per_mile ?? undefined,
    tires_per_mile: settings.tires_per_mile ?? undefined,
    truck_payment_per_day: settings.truck_payment_per_day ?? undefined,
    insurance_per_day: settings.insurance_per_day ?? undefined,
    per_diem_per_day: settings.per_diem_per_day ?? undefined,
    avg_mpg: settings.avg_mpg ?? undefined,
  } : {};

  // Restore persisted filter state from sessionStorage
  const restored = useRef<{
    orders?: string; risk?: RiskLevel; origin?: PlaceResult | null;
    destination?: PlaceResult | null; homeBy?: string; maxDeadheadPct?: number; maxIdle?: number; workDays?: string[]; legs?: number;
  } | null>(null);
  if (restored.current === null && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("hv-route-filters");
      restored.current = raw ? JSON.parse(raw) : {};
    } catch { restored.current = {}; }
  }
  const r = restored.current ?? {};

  const initialOrders = r.orders as "one-way" | "round-trip" ?? initialTripType ?? "round-trip";
  const [orders, setOrders] = useState(initialOrders);
  const [risk, setRisk] = useState<RiskLevel>(r.risk ?? "any");
  const [origin, setOrigin] = useState<PlaceResult | null>(r.origin ?? null);
  const [originPopoverOpen, setOriginPopoverOpen] = useState(false);
  const [destination, setDestination] = useState<PlaceResult | null>(r.destination ?? null);
  const [homeBy, setHomeBy] = useState<string>(r.homeBy ?? "");
  const [maxDeadheadPct, setMaxDeadheadPct] = useState(r.maxDeadheadPct ?? 15);
  const [maxIdle, setMaxIdle] = useState<number>(r.maxIdle ?? settings?.max_idle_hours ?? 48);
  const [workDays, setWorkDays] = useState<string[]>(r.workDays ?? settings?.work_days ?? []);
  const [legs, setLegs] = useState<number>(r.legs ?? (initialOrders === "one-way" ? 1 : 2));
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
        orders, risk, origin, destination, homeBy, maxDeadheadPct, maxIdle, workDays, legs,
      }));
    } catch {}
  }, [orders, risk, origin, destination, homeBy, maxDeadheadPct, maxIdle, compactBar]);

  // Reset filters when clear is triggered
  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    const resetMode = initialTripType ?? "round-trip";
    setOrders(resetMode);
    setLegs(resetMode === "one-way" ? 1 : 2);
    setOrigin(null);
    setDestination(null);
    setHomeBy("");
  }, [resetKey, initialTripType]);

  // Pre-fill from settings (or restore from sessionStorage)
  // compactBar instances only mirror state — they never auto-fire searches on mount.
  // The desktop instance (or MobileFilterSheet when opened) is the sole search trigger.
  const searchEnabled = useRef(false);
  useEffect(() => {
    if (!settings) return;
    if (defaultsLoaded) {
      // Restored from sessionStorage — enable search and fire with restored state
      if (!searchEnabled.current) {
        searchEnabled.current = true;
        if (!compactBar) {
          setTimeout(() => {
            if (origin) {
              onOriginChange?.(origin ? { lat: origin.lat, lng: origin.lng, city: origin.name.split(",")[0] } : null);
              onTripModeChange?.(orders);
              if (orders === "round-trip") {
                onSearchRoundTrip({
                  origin_lat: origin.lat,
                  origin_lng: origin.lng,
                  origin_city: origin.name.split(",")[0],
                  legs,
                  risk,
                  ...(homeBy ? { home_by: homeBy } : {}),
                  max_deadhead_pct: maxDeadheadPct,
                  ...(maxIdle > 0 ? { max_layover_hours: maxIdle } : {}),
                  ...driverProfile,
                });
              } else {
                if (destination) {
                  onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
                }
                onSearch({
                  origin_lat: origin.lat,
                  origin_lng: origin.lng,
                  ...(destination ? { dest_lat: destination.lat, dest_lng: destination.lng } : {}),
                  legs,
                  trailer_types: driverProfile.trailer_types,
                  ...(maxIdle > 0 ? { max_layover_hours: maxIdle } : {}),
                });
              }
            }
          }, 0);
        }
      }
      return;
    }
    // First load with no restored state — prefill from home base
    if (homePlace) {
      setOrigin(homePlace);
      setDestination(homePlace);
      setOrders("round-trip");
    }
    setDefaultsLoaded(true);
    searchEnabled.current = true;
    if (!compactBar) {
      setTimeout(() => {
        if (homePlace) {
          onSearchRoundTrip({
            origin_lat: homePlace.lat,
            origin_lng: homePlace.lng,
            origin_city: homePlace.name.split(",")[0],
            legs,
            risk,
            max_deadhead_pct: maxDeadheadPct,
            ...driverProfile,
          });
        }
      }, 0);
    }
  }, [settings, defaultsLoaded]);

  // Reset locations when trip type changes
  const prevTripType = useRef(orders);
  useEffect(() => {
    if (prevTripType.current === orders) return;
    prevTripType.current = orders;
    onTripModeChange?.(orders);

    if (orders === "round-trip") {
      // Round trip: keep origin, set destination = origin (come back home)
      const place = origin ?? homePlace;
      // Clamp legs to round-trip range (2-3)
      const rtLegs = Math.max(2, Math.min(3, legs));
      setLegs(rtLegs);
      if (place) {
        setOrigin(place);
        setDestination(place);
        if (searchEnabled.current) {
          onSearchRoundTrip({
            origin_lat: place.lat,
            origin_lng: place.lng,
            origin_city: place.name.split(",")[0],
            legs: rtLegs,
            risk,
            ...(homeBy ? { home_by: homeBy } : {}),
            max_deadhead_pct: maxDeadheadPct,
            ...driverProfile,
          });
        }
      } else {
        setOrigin(null);
        setDestination(null);
        onClearSearch?.();
      }
    } else {
      // One way: keep origin, clear destination
      setDestination(null);
      onDestinationChange?.(null);
      if (origin && searchEnabled.current) {
        onSearch({
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          legs,
          trailer_types: driverProfile.trailer_types,
          ...(maxIdle > 0 ? { max_layover_hours: maxIdle } : {}),
        });
      } else {
        onClearSearch?.();
      }
    }
  }, [orders]);

  // Stable key for driver profile so it can be a useEffect dependency
  const profileKey = JSON.stringify(driverProfile);

  // Fire search (shared helper)
  const fireSearch = useCallback(() => {
    if (!origin) {
      onClearSearch?.();
      return;
    }
    if (orders === "round-trip") {
      onSearchRoundTrip({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_city: origin.name.split(",")[0],
        legs,
        risk,
        ...(homeBy ? { home_by: homeBy } : {}),
        max_deadhead_pct: maxDeadheadPct,
        ...(maxIdle > 0 ? { max_layover_hours: maxIdle } : {}),
        ...driverProfile,
      });
    } else {
      onSearch({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        ...(destination ? { dest_lat: destination.lat, dest_lng: destination.lng } : {}),
        legs,
        trailer_types: driverProfile.trailer_types,
        ...(maxIdle > 0 ? { max_layover_hours: maxIdle } : {}),
      });
    }
  }, [origin, destination, orders, risk, homeMode, homeBy, maxDeadheadPct, maxIdle, legs, profileKey, onClearSearch]);

  // Auto-search on filter changes (only after initial load settles)
  // Note: orders is NOT a trigger here — trip type changes are handled by prevTripType effect
  useEffect(() => {
    if (!searchEnabled.current) return;
    fireSearch();
  }, [risk, homeBy, maxDeadheadPct, legs]);

  // Auto-search on driver profile or max idle changes (debounced)
  // Signal loading immediately so the UI feels responsive, then fire the actual query after 400ms
  useEffect(() => {
    if (!searchEnabled.current) return;
    onFilterPending?.();
    const id = setTimeout(() => fireSearch(), 1000);
    return () => clearTimeout(id);
  }, [profileKey, maxIdle]);

  useEffect(() => {
    if (!searchEnabled.current) return;
    onOriginChange?.(origin ? { lat: origin.lat, lng: origin.lng, city: origin.name.split(",")[0] } : null);
    if (!origin) {
      onClearSearch?.();
      return;
    }
    fireSearch();
  }, [origin]);

  useEffect(() => {
    if (!searchEnabled.current) return;
    onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
    if (!origin || orders === "round-trip") return;
    fireSearch();
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
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=place&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const name = data.features?.[0]?.place_name ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      setOrigin({ name, lat: latitude, lng: longitude });
    });
  };

  const showSaveAsHome = !homeMode && destination != null;

  const isRoundTrip = orders === "round-trip";

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Shared filter elements
  const tripTypePill = (
    <div id="onborda-trip-mode">
    <FilterPill label={compactBar || mobile ? "" : "Trip"} value={isRoundTrip ? (compactBar || mobile ? "RT" : "Round Trip") : (compactBar || mobile ? "OW" : "One Way")}>
      {(close) => (
        <div className="space-y-3 p-1">
          <p className="text-sm font-medium">Trip Type</p>
          <div className="flex gap-2">
            {([
              { value: "one-way", label: "One Way" },
              { value: "round-trip", label: "Round Trip" },
            ] as const).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setOrders(t.value); close(); }}
                className={`flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors ${
                  orders === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
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
      />
    </div>
  );

  const destPill = !isRoundTrip ? (
    <div id="onborda-destination">
      <LocationPill
        label={compactBar || mobile ? "D" : "Destination"}
        title="Destination"
        value={destination}
        onSelect={setDestination}
        onUseHome={hasHomeLocation ? () => setDestination(homePlace) : undefined}
        homeCityLabel={hasHomeLocation ? settings!.home_base_city! : undefined}
      />
    </div>
  ) : null;

  const legsPill = (
    <div id="onborda-legs" className="flex h-9 items-center rounded-full border bg-card/95 backdrop-blur shadow-sm overflow-hidden mobile-filter-pill whitespace-nowrap">
      <span className="pl-4 pr-2 text-sm text-muted-foreground font-medium">Loads:</span>
      {(isRoundTrip ? [2, 3] : [1, 2, 3]).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setLegs(n)}
          className={`h-full px-3 text-sm font-medium transition-colors ${
            legs === n
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );

  const clearButton = null;

  /* ---- Compact bar layout (two rows) ---- */
  if (compactBar) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Row 1: trip mode, origin, destination */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {tripTypePill}
          {originPill}
          {destPill}
        </div>
        {/* Row 2: legs + action icons */}
        <div className="flex items-center gap-1.5">
          {legsPill}
          {children}
        </div>
      </div>
    );
  }

  /* ---- Map overlay layout (essential pills stacked) ---- */
  if (mapOverlay) {
    return (
      <div className="flex flex-col gap-1.5">
        {tripTypePill}
        {originPill}
        {destPill}
        {legsPill}
      </div>
    );
  }

  /* ---- Mobile layout ---- */
  if (mobile) {
    const activeFilterCount = [
      homeBy,
      maxDeadheadPct !== 15,
      maxIdle !== 48,
      risk !== "any",
    ].filter(Boolean).length;

    return (
      <div className="flex flex-col gap-1.5 mobile-filters">
        {/* Single compact row: essential pills + filter toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tripTypePill}
          {originPill}
          {destPill}
          {legsPill}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium shadow-sm transition-colors mobile-filter-pill whitespace-nowrap ${
              mobileFiltersOpen ? "bg-primary text-primary-foreground" : "bg-card/95 backdrop-blur hover:bg-accent"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && <span className="text-xs">{activeFilterCount}</span>}
          </button>
          {clearButton}
        </div>

        {/* Expandable filter overlay */}
        {mobileFiltersOpen && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-muted/50 border border-border/50">
            {isRoundTrip && <HomeByPill value={homeBy} onChange={setHomeBy} />}
            <MaxIdlePill value={maxIdle} onChange={setMaxIdle} />
            <DeadheadPctPill value={maxDeadheadPct} onChange={setMaxDeadheadPct} />
            <AllFiltersPopover risk={risk} onRiskChange={setRisk} workDays={workDays} onWorkDaysChange={setWorkDays} />
          </div>
        )}
      </div>
    );
  }

  /* ---- Desktop layout ---- */
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  useEffect(() => {
    const shouldShow = !origin && defaultsLoaded && searchEnabled.current && !originPopoverOpen && !isOnboarding;
    if (shouldShow) {
      const timer = setTimeout(() => {
        setShowNudge(true);
        // Trigger fade-in on next frame
        requestAnimationFrame(() => setNudgeVisible(true));
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowNudge(false);
      setNudgeVisible(false);
    }
  }, [origin, defaultsLoaded, originPopoverOpen, isOnboarding]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tripTypePill}
      <div className="relative">
        {originPill}
        {showNudge && (
          <div className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 transition-opacity duration-500 ${nudgeVisible ? "opacity-100" : "opacity-0"}`}>
            <div className="flex justify-center mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black border-2 border-primary animate-bounce">
                <ChevronUpIcon className="h-4 w-4 text-primary" strokeWidth={3} />
              </div>
            </div>
            <div className="bg-card border-2 border-primary rounded-xl shadow-lg px-5 py-4 w-64">
              <p className="text-base text-foreground font-semibold">Set an origin</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Pick a starting city to get route suggestions</p>
            </div>
          </div>
        )}
      </div>
      {destPill}
      {legsPill}
      {isRoundTrip && <div id="onborda-home-by"><HomeByPill value={homeBy} onChange={setHomeBy} /></div>}
      <div id="onborda-idle"><MaxIdlePill value={maxIdle} onChange={setMaxIdle} /></div>
      <div id="onborda-deadhead"><DeadheadPctPill value={maxDeadheadPct} onChange={setMaxDeadheadPct} /></div>
      <div id="onborda-all-filters"><AllFiltersPopover risk={risk} onRiskChange={setRisk} workDays={workDays} onWorkDaysChange={setWorkDays} /></div>
      {clearButton}
    </div>
  );
}

/* ---- All Filters Popover ---- */

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

function AllFiltersPopover({
  risk,
  onRiskChange,
  workDays,
  onWorkDaysChange,
}: {
  risk: RiskLevel;
  onRiskChange: (r: RiskLevel) => void;
  workDays: string[];
  onWorkDaysChange: (v: string[]) => void;
}) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [trailerLabels, setTrailerLabels] = useState<string[]>([]);
  const [maxWeight, setMaxWeight] = useState("");
  const [hazmat, setHazmat] = useState(false);
  const [twic, setTwic] = useState(false);
  const [team, setTeam] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings) return;
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setHazmat(settings.hazmat_certified ?? false);
    setTwic(settings.twic_card ?? false);
    setTeam(settings.team_driver ?? false);
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
    risk !== "any",
    workDays.length > 0 && workDays.length < 7,
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-5">
          {/* Risk Tolerance */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Risk Tolerance</p>
            <Select value={risk} onValueChange={(v) => onRiskChange(v as RiskLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any — no risk filtering</SelectItem>
                <SelectItem value="safe">Safe — conservative, low deadhead</SelectItem>
                <SelectItem value="moderate">Moderate — balanced</SelectItem>
                <SelectItem value="bold">Bold — higher potential, more risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                      {selected && <span className="text-[10px]">✓</span>}
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
                    {cert.checked && <span className="text-[10px]">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Work Days */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Work Days</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const allSelected = workDays.length === 0 || workDays.length === 7;
                const selected = allSelected || workDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const next = workDays.includes(day)
                        ? workDays.filter((d) => d !== day)
                        : [...workDays, day];
                      onWorkDaysChange(next.length === 7 ? [] : next);
                    }}
                    className={`flex h-8 w-10 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onWorkDaysChange([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                All days
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => onWorkDaysChange(["Mon", "Tue", "Wed", "Thu", "Fri"])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Weekdays only
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Routes won&apos;t include pickups or deliveries on your off days
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
