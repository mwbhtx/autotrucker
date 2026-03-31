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
import { ChevronDown, LocateIcon, SlidersHorizontal, XIcon } from "lucide-react";
import { BorderBeam } from "@/platform/web/components/ui/border-beam";
import { Calendar } from "@/platform/web/components/ui/calendar";
import { useSettings, useUpdateSettings } from "@/core/hooks/use-settings";
import { TRAILER_CATEGORIES, expandTrailerCodes, codesToLabels, DEFAULT_LEGS_ONE_WAY, DEFAULT_LEGS_ROUND_TRIP, DEFAULT_MAX_TRIP_DAYS, DEFAULT_COST_PER_MILE, ALL_WORK_DAYS, TIME_PRESETS } from "@mwbhtx/haulvisor-core";

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
            <span>{value}</span>
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

/* ---- Return By Pill (calendar + time popover) ---- */

function ReturnByPill({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: {
  dateValue: string;
  timeValue: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = dateValue ? new Date(dateValue + "T00:00:00") : undefined;

  const displayLabel = dateValue
    ? `${formatDateShort(dateValue)}${timeValue ? `, ${TIME_PRESETS.find((t) => t.value === timeValue)?.label ?? timeValue}` : ""}`
    : "Any";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Return By:</span>
          <span className="flex items-center gap-1.5">
            <span>{displayLabel}</span>
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
              onDateChange(iso);
            }
          }}
          defaultMonth={selected}
        />
        <div className="border-t px-3 py-2 flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground shrink-0">Time</p>
          <select
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="flex-1 h-8 rounded-md bg-muted text-sm px-2 border-0 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TIME_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {(dateValue || timeValue) && (
          <div className="border-t px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => { onDateChange(""); onTimeChange(""); setOpen(false); }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---- Leave By Pill (calendar + time popover) ---- */

function LeaveByPill({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: {
  dateValue: string;
  timeValue: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = dateValue ? new Date(dateValue + "T00:00:00") : undefined;

  const displayLabel = dateValue
    ? `${formatDateShort(dateValue)}${timeValue ? `, ${TIME_PRESETS.find((t) => t.value === timeValue)?.label ?? timeValue}` : ""}`
    : "Any";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-full border bg-card/95 backdrop-blur px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent mobile-filter-pill whitespace-nowrap"
        >
          <span className="text-muted-foreground">Leave By:</span>
          <span className="flex items-center gap-1.5">
            <span>{displayLabel}</span>
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
              onDateChange(iso);
            }
          }}
          defaultMonth={selected}
        />
        <div className="border-t px-3 py-2 flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground shrink-0">Time</p>
          <select
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="flex-1 h-8 rounded-md bg-muted text-sm px-2 border-0 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TIME_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {(dateValue || timeValue) && (
          <div className="border-t px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => { onDateChange(""); onTimeChange(""); setOpen(false); }}
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
              colorFrom="var(--primary)"
              colorTo="var(--primary)"
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
}: SearchFiltersProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const driverProfile = settings ? {
    trailer_types: settings.trailer_types?.length ? settings.trailer_types.join('|') : undefined,
    max_weight: settings.max_weight ?? undefined,
    hazmat_certified: settings.hazmat_certified ?? undefined,
    twic_card: settings.twic_card ?? undefined,
    team_driver: settings.team_driver ?? undefined,
    no_tarps: settings.no_tarps ?? undefined,
    search_radius_miles: settings.preferred_radius_miles ?? undefined,
    max_assigned_orders: settings.max_assigned_orders ?? undefined,
    cost_per_mile: (settings.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE,
    cost_per_day: settings.cost_per_day ?? undefined,
    avg_mpg: settings.avg_mpg ?? undefined,
  } : {};

  // Restore persisted filter state from sessionStorage
  const restored = useRef<{
    orders?: string; origin?: PlaceResult | null;
    destination?: PlaceResult | null; homeBy?: string; homeByTime?: string;
    departBy?: string; departByTime?: string; departureDate?: string;
    daysOut?: number; workDays?: string[]; legs?: number;
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
  const [workDays, setWorkDays] = useState<string[]>(r.workDays ?? settings?.work_days ?? []);
  const [legs, setLegs] = useState<number>(r.legs ?? DEFAULT_LEGS_ROUND_TRIP);
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
        origin, destination, departureDate, daysOut, workDays, legs,
      }));
    } catch {}
  }, [origin, destination, departureDate, daysOut, compactBar, legs]);

  // Reset filters when clear is triggered
  useEffect(() => {
    if (resetKey === undefined || resetKey === 0) return;
    setLegs(DEFAULT_LEGS_ROUND_TRIP);
    setOrigin(null);
    setDestination(null);
  }, [resetKey]);

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
              if (destination) {
                onDestinationChange?.(destination ? { lat: destination.lat, lng: destination.lng, city: destination.name.split(",")[0] } : null);
              }
              onSearch({
                origin_lat: origin.lat,
                origin_lng: origin.lng,
                departure_date: departureDate,
                ...(destination ? { destination_lat: destination.lat, destination_lng: destination.lng } : {}),
                legs,
                max_trip_days: daysOut,
                ...driverProfile,
              });
            }
          }, 0);
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
          onSearch({
            origin_lat: homePlace.lat,
            origin_lng: homePlace.lng,
            departure_date: departureDate,
            legs,
            max_trip_days: daysOut,
            ...driverProfile,
          });
        }
      }, 0);
    }
  }, [settings, defaultsLoaded]);

  // Stable key for driver profile so it can be a useEffect dependency
  const profileKey = JSON.stringify(driverProfile);

  // Fire search (shared helper)
  const fireSearch = useCallback(() => {
    if (!origin) {
      onClearSearch?.();
      return;
    }
    onSearch({
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      departure_date: departureDate,
      ...(destination ? { destination_lat: destination.lat, destination_lng: destination.lng } : {}),
      legs,
      max_trip_days: daysOut,
      ...driverProfile,
    });
  }, [origin, destination, departureDate, daysOut, legs, profileKey, onClearSearch]);

  // Auto-search on filter changes (only after initial load settles)
  useEffect(() => {
    if (!searchEnabled.current) return;
    fireSearch();
  }, [departureDate, daysOut, legs]);

  // Auto-search on driver profile changes (debounced)
  // Signal loading immediately so the UI feels responsive, then fire the actual query after 400ms
  // Skip the first fire — the settings-restore effect already handled it
  const profileInitialized = useRef(false);
  useEffect(() => {
    if (!searchEnabled.current) return;
    if (!profileInitialized.current) {
      profileInitialized.current = true;
      return;
    }
    onFilterPending?.();
    const id = setTimeout(() => fireSearch(), 1000);
    return () => clearTimeout(id);
  }, [profileKey]);

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
    if (!origin) return;
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

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
      />
    </div>
  );

  const legsPill = (
    <div id="onborda-legs" className="flex h-9 items-center rounded-full border bg-card/95 backdrop-blur shadow-sm overflow-hidden mobile-filter-pill whitespace-nowrap">
      <span className="pl-4 pr-2 text-sm text-muted-foreground font-medium">Loads:</span>
      {[1, 2, 3].map((n) => (
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
        {/* Row 1: origin, destination, departure date */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {originPill}
          {destPill}
          {departureDatePill}
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
        {originPill}
        {destPill}
        {departureDatePill}
        {legsPill}
      </div>
    );
  }

  /* ---- Mobile layout ---- */
  if (mobile) {
    const activeFilterCount = [
      daysOut !== DEFAULT_MAX_TRIP_DAYS,
    ].filter(Boolean).length;

    return (
      <div className="flex flex-col gap-1.5 mobile-filters">
        {/* Single compact row: essential pills + filter toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {originPill}
          {destPill}
          {departureDatePill}
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
            <DaysOutPill value={daysOut} onChange={setDaysOut} departureDate={departureDate} />
            <AllFiltersPopover workDays={workDays} onWorkDaysChange={setWorkDays} />
          </div>
        )}
      </div>
    );
  }

  /* ---- Desktop layout ---- */
  const nudgeRef = useRef<ReturnType<typeof driver> | null>(null);
  useEffect(() => {
    const shouldShow = !origin && defaultsLoaded && searchEnabled.current && !originPopoverOpen && !isOnboarding;
    if (shouldShow) {
      const timer = setTimeout(() => {
        nudgeRef.current = driver({ overlayOpacity: 0, allowClose: true, popoverClass: "hv-tour-popover" });
        nudgeRef.current.highlight({
          element: "#onborda-origin",
          popover: {
            title: "Set an origin",
            description: "Pick a starting city to get route suggestions",
            side: "bottom",
            align: "start",
          },
        });
      }, 2000);
      return () => {
        clearTimeout(timer);
        nudgeRef.current?.destroy();
        nudgeRef.current = null;
      };
    } else {
      nudgeRef.current?.destroy();
      nudgeRef.current = null;
    }
  }, [origin, defaultsLoaded, originPopoverOpen, isOnboarding]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {originPill}
      {destPill}
      {departureDatePill}
      <div id="onborda-days-out"><DaysOutPill value={daysOut} onChange={setDaysOut} departureDate={departureDate} /></div>
      {legsPill}
      <div id="onborda-all-filters"><AllFiltersPopover workDays={workDays} onWorkDaysChange={setWorkDays} /></div>
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
  workDays,
  onWorkDaysChange,
}: {
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
  const [noTarps, setNoTarps] = useState(false);
  const [searchRadius, setSearchRadius] = useState(250);
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings) return;
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setHazmat(settings.hazmat_certified ?? false);
    setTwic(settings.twic_card ?? false);
    setTeam(settings.team_driver ?? false);
    setNoTarps(settings.no_tarps ?? false);
    setSearchRadius(settings.preferred_radius_miles ?? 250);
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
    searchRadius !== 250,
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

          {/* Search Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Search Radius</p>
              <span className="text-sm text-muted-foreground">{searchRadius} mi</span>
            </div>
            <Slider
              value={[searchRadius]}
              min={50}
              max={350}
              step={25}
              onValueChange={([v]) => {
                setSearchRadius(v);
              }}
              onValueCommit={([v]) => {
                if (initialized.current) save({ preferred_radius_miles: v });
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50 mi</span>
              <span>350 mi</span>
            </div>
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

          {/* Work Days */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Work Days</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_WORK_DAYS.map((day) => {
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
