"use client";

import { TruckIcon, ClockIcon, Package, PackageOpen, Fuel, Coffee, Bed, Layers, Pause } from "lucide-react";
import tzlookup from "tz-lookup";
import type { RouteChain, TripPhase, TripSimulationSummary } from "@/core/types";
import { TRIP_DEFAULTS, HOS_MANDATORY_REST_HOURS } from "@mwbhtx/haulvisor-core";

/**
 * Resolve the route's origin IANA timezone from the first leg's
 * lat/lng. Phase timestamps are rendered in this timezone so the
 * schedule shows clock times the driver (and shipper/receiver)
 * actually see on-site — not the browser's local time. Returns null
 * when the chain has no legs or the lookup fails.
 */
function getOriginTimeZone(chain: RouteChain): string | null {
  const first = chain.legs?.[0];
  if (!first || first.origin_lat == null || first.origin_lng == null) return null;
  try {
    return tzlookup(first.origin_lat, first.origin_lng);
  } catch {
    return null;
  }
}

function cityOnly(name?: string): string {
  return name?.split(",")[0]?.trim() ?? "";
}

/**
 * Source orders store city names in ALL CAPS ("KANSAS CITY"). For display,
 * title-case the city portion and leave the state code uppercase.
 *   "KANSAS CITY, MO" → "Kansas City, MO"
 *   "EDGERTON"        → "Edgerton"
 */
function prettyCity(raw?: string): string {
  if (!raw) return "";
  const [city, ...rest] = raw.split(",");
  const titled = city.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return rest.length ? `${titled},${rest.join(",")}` : titled;
}

function formatDuration(hours: number | undefined): string {
  if (hours === undefined || isNaN(hours)) return "—";
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    if (h === 0) return `${d}d`;
    return `${d}d ${h}h`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a Date as short time: "4:00 AM" — in `tz` when supplied, else browser-local. */
function formatTime(date: Date, tz?: string | null): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** Format a Date as day label: "Mon Mar 31" — in `tz` when supplied. */
function formatDayLabel(date: Date, tz?: string | null): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** Format a Date as MM/DD HH:mm — in `tz` when supplied. */
function formatTimestamp(date: Date, tz?: string | null): string {
  if (tz) {
    // Intl gives us a reliable tz-aware breakdown; piece it back together
    // to keep the compact MM/DD HH:mm shape used elsewhere in the UI.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    // Intl in hour12:false mode returns "24" for midnight — normalize to "00".
    const hh = pick("hour") === "24" ? "00" : pick("hour");
    return `${pick("month")}/${pick("day")} ${hh}:${pick("minute")}`;
  }
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

/** Build a YYYY-M-D key for a Date in the given tz (for day-boundary grouping). */
function dayKey(date: Date, tz?: string | null): string {
  if (!tz) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

interface DayGroup {
  dayNumber: number;
  dateLabel: string;
  phases: { phase: TripPhase; timestamp: Date }[];
  /** Miles driven this calendar day (driving + deadhead phases). */
  totalMiles: number;
  /** Hours spent actually moving (driving + deadhead). */
  driveHours: number;
  /** On-duty hours — everything in the day except rest. */
  workingHours: number;
}

/** Group timeline phases into calendar-day buckets (in `tz` when supplied). */
function groupByDay(timeline: TripPhase[], timestamps: Date[], tz?: string | null): DayGroup[] {
  if (timeline.length === 0 || timestamps.length === 0) return [];

  const days: DayGroup[] = [];
  let currentDateKey = "";

  for (let i = 0; i < timeline.length; i++) {
    const ts = timestamps[i];
    const dateKey = dayKey(ts, tz);

    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      days.push({
        dayNumber: days.length + 1,
        dateLabel: formatDayLabel(ts, tz),
        phases: [],
        totalMiles: 0,
        driveHours: 0,
        workingHours: 0,
      });
    }

    const day = days[days.length - 1];
    day.phases.push({ phase: timeline[i], timestamp: ts });

    const phase = timeline[i];
    const duration = phase.duration_hours ?? 0;
    const miles = phase.miles ?? 0;
    day.totalMiles += miles;
    if (phase.kind === "driving" || phase.kind === "deadhead") {
      day.driveHours += duration;
    }
    // On-duty time from the driver's perspective: active work only.
    // Excludes rest (sleeping) AND waiting (parked at shipper/receiver
    // waiting for an appointment window). HOS technically counts the
    // wait as on-duty, but drivers interpret "on duty" as time they're
    // actually working — so we match their mental model in the UI.
    if (phase.kind !== "rest" && phase.kind !== "waiting") {
      day.workingHours += duration;
    }
  }

  return days;
}

interface RouteInspectorProps {
  chain: RouteChain;
  originCity: string;
  returnCity?: string;
  onClose: () => void;
  departureTime?: Date;
  returnByTime?: Date;
  /** Externally loaded timeline (lazy) — overrides chain.timeline */
  timelineData?: {
    timeline: TripPhase[];
    trip_summary: TripSimulationSummary;
    suggested_departure?: string;
  } | null;
  /** Whether the timeline is loading */
  timelineLoading?: boolean;
}

export function RouteInspector({
  chain,
  originCity,
  returnCity,
  onClose,
  departureTime,
  returnByTime,
  timelineData,
  timelineLoading,
}: RouteInspectorProps) {
  // Use lazy-loaded timeline if available, fall back to chain.timeline
  const timeline = timelineData?.timeline ?? chain.timeline ?? [];
  // Render all phase timestamps in the route's origin timezone so the
  // schedule reflects the clock time at the pickup location — not the
  // browser's local time. Falls back to browser-local if the lookup fails.
  const originTz = getOriginTimeZone(chain);

  // Show loading state
  if (timelineLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center py-12">
        <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-muted-foreground mt-2">Generating route timeline...</p>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No timeline available</p>
      </div>
    );
  }

  const effectiveDeparture = departureTime
    ?? (timelineData?.suggested_departure ? new Date(timelineData.suggested_departure) : null)
    ?? (chain.suggested_departure ? new Date(chain.suggested_departure) : null)
    ?? (() => {
      const firstLeg = chain.legs.find((l) => l.pickup_date_early_local);
      if (!firstLeg?.pickup_date_early_local) return null;
      const pickupTime = new Date(firstLeg.pickup_date_early_local).getTime();
      let prePickupHours = 0;
      for (const phase of timeline) {
        if (phase.kind === "loading") break;
        prePickupHours += phase.duration_hours ?? 0;
      }
      return new Date(pickupTime - prePickupHours * 3_600_000);
    })();

  const timestamps: Date[] | null = effectiveDeparture
    ? (() => {
        const ts: Date[] = [];
        let cursor = effectiveDeparture.getTime();
        for (const phase of timeline) {
          ts.push(new Date(cursor));
          cursor += (phase.duration_hours ?? 0) * 3_600_000;
        }
        return ts;
      })()
    : null;

  const arrivalTime = timestamps && timeline.length > 0
    ? new Date(timestamps[timestamps.length - 1].getTime() + (timeline[timeline.length - 1].duration_hours ?? 0) * 3_600_000)
    : null;

  const days = timestamps ? groupByDay(timeline, timestamps, originTz) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Day cards */}
      <div className="flex-1 overflow-y-auto">
        {days.length > 0 ? (
          days.map((day) => (
            <div key={day.dayNumber} className="border-b border-border">
              {/* Day header */}
              <div className="flex items-baseline justify-between px-4 py-2.5">
                <span className="text-sm font-extrabold text-caution">
                  Day {day.dayNumber} — {day.dateLabel}
                </span>
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {day.totalMiles > 0 && <>{Math.round(day.totalMiles).toLocaleString()} mi · </>}
                  {formatDuration(day.driveHours)} driving · {formatDuration(day.workingHours)} on duty
                </span>
              </div>
              {/* Phase rows */}
              {day.phases.map(({ phase, timestamp }, i) => (
                <PhaseRow key={i} phase={phase} timestamp={timestamp} showTimeOnly originCity={originCity} returnCity={returnCity} tz={originTz} />
              ))}
            </div>
          ))
        ) : (
          timeline.map((phase, i) => (
            <PhaseRow key={i} phase={phase} timestamp={null} showTimeOnly={false} originCity={originCity} returnCity={returnCity} tz={originTz} />
          ))
        )}
      </div>

      {/* Return-by note */}
      {returnByTime && (
        <div className="px-3 py-2 border-t border-border text-xs text-foreground">
          Return by: <span className="font-medium">{formatTimestamp(returnByTime, originTz)}</span>
          {arrivalTime && arrivalTime <= returnByTime && (
            <span className="ml-2">On time</span>
          )}
          {arrivalTime && arrivalTime > returnByTime && (
            <span className="ml-2">Late</span>
          )}
        </div>
      )}

      {/* Assumptions footer */}
      <div className="flex bg-card overflow-hidden shrink-0">
        <div className="w-[2px] shrink-0 bg-caution" />
        <div className="flex-1 px-3 py-2.5">
          <p className="text-sm font-bold text-caution mb-1">Timeline Assumptions</p>
          {[
            ["Loaded speed", `${TRIP_DEFAULTS.loaded_speed_mph.value} mph`],
            ["Deadhead speed", `${TRIP_DEFAULTS.deadhead_speed_mph.value} mph`],
            ["Drive hours/day", `${TRIP_DEFAULTS.max_driving_hours_per_day.value} hrs`],
            ["Rest period", "10 hrs"],
            ["Loading time", `${TRIP_DEFAULTS.loading_hours.value} hrs`],
            ["Unloading time", `${TRIP_DEFAULTS.unloading_hours.value} hrs`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-0.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhaseRow({ phase, timestamp, showTimeOnly, originCity, returnCity, tz }: { phase: TripPhase; timestamp: Date | null; showTimeOnly: boolean; originCity?: string; returnCity?: string; tz?: string | null }) {
  const timeLabel = timestamp ? (
    <span className="text-xs text-foreground/60 tabular-nums w-[4.5rem] shrink-0 text-right">
      {showTimeOnly ? formatTime(timestamp, tz) : formatTimestamp(timestamp, tz)}
    </span>
  ) : null;

  // A waiting phase ≥ HOS rest (10h) is functionally overnight rest — the
  // sim resets shift counters when a wait is that long, so the driver is
  // actually sleeping for most of it. Relabel + swap the icon so the
  // schedule reads like a real driver day.
  const isRestWait =
    phase.kind === 'waiting' && phase.duration_hours >= HOS_MANDATORY_REST_HOURS;

  const Icon = {
    deadhead: TruckIcon,
    driving: TruckIcon,
    loading: Package,
    tarping: Layers,
    unloading: PackageOpen,
    rest: Bed,
    break: Coffee,
    fuel: Fuel,
    flex: Pause,
    waiting: isRestWait ? Bed : ClockIcon,
  }[phase.kind];

  const label = (() => {
    switch (phase.kind) {
      case 'deadhead': {
        const dest = phase.destination_city || returnCity || originCity || '';
        return <>Deadhead to {prettyCity(dest)}</>;
      }
      case 'driving':
        return <>Driving to {prettyCity(phase.destination_city)}</>;
      case 'loading':
        return <>Loading at {prettyCity(phase.origin_city)}</>;
      case 'tarping':
        return <>Tarping at {prettyCity(phase.origin_city)}</>;
      case 'unloading':
        return <>Unloading at {prettyCity(phase.destination_city)}</>;
      case 'rest':
        return <>Rest</>;
      case 'break':
        return <>Break</>;
      case 'fuel':
        return <>Fueling</>;
      case 'flex':
        return <>Flex Time</>;
      case 'waiting': {
        const loc = phase.origin_city ? prettyCity(phase.origin_city) : phase.destination_city ? prettyCity(phase.destination_city) : '';
        const waitFor = phase.waiting_for === 'pickup_window' ? 'pickup' : 'delivery';
        const body = `waiting for ${waitFor} window${loc ? ` at ${loc}` : ''}`;
        return isRestWait ? <>Rest ({body})</> : <>Waiting for {waitFor} window{loc ? ` at ${loc}` : ''}</>;
      }
    }
  })();

  const hasMiles = phase.kind === 'driving' || phase.kind === 'deadhead';

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border/50">
      {timeLabel}
      <Icon className="h-5 w-5 shrink-0 text-foreground/60" />
      <span className={`flex-1 text-sm text-foreground ${hasMiles ? 'font-semibold' : ''}`}>
        {label}
      </span>
      <span className="text-sm tabular-nums font-medium ml-2 w-14 text-right shrink-0 text-foreground">
        {formatDuration(phase.duration_hours)}
      </span>
    </div>
  );
}
