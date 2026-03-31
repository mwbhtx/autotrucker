"use client";

import { TruckIcon, ClockIcon, Package, PackageOpen, Fuel, Coffee, Bed } from "lucide-react";
import type { RouteChain, TripPhase } from "@/core/types";
import { TRIP_DEFAULTS } from "@mwbhtx/haulvisor-core";

// Phase colors — hardcoded for now, migrate to theme vars later
// Using inline style objects so arbitrary hex values work reliably
const PHASE_COLORS = {
  loading:   { color: "#34d399" },  // emerald-400
  unloading: { color: "#34d399" },  // emerald-400
  rest:      { color: "#a78bfa" },  // violet-400
  break:     { color: "#fbbf24" },  // amber-400
  fuel:      { color: "#ff612b" },
  waiting:   { color: "#38bdf8" },  // sky-400
  deadhead:  { color: "#cdcdcd" },
  driving:   { color: "#cdcdcd" },
} as const;

function phaseStyle(kind: keyof typeof PHASE_COLORS, dim = false): { color: string; opacity: number } {
  const c = PHASE_COLORS[kind];
  const opacity = dim ? 0.5 : ("opacity" in c ? (c as { opacity: number }).opacity : 1);
  return { color: c.color, opacity };
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

/** Format a Date as short time: "4:00 AM" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Format a Date as day label: "Mon Mar 31" */
function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Format a Date as MM/DD HH:mm (fallback when no departure) */
function formatTimestamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

interface DayGroup {
  dayNumber: number;
  dateLabel: string;
  phases: { phase: TripPhase; timestamp: Date }[];
  totalMiles: number;
  driveHours: number;
}

/** Group timeline phases into calendar-day buckets */
function groupByDay(timeline: TripPhase[], timestamps: Date[]): DayGroup[] {
  if (timeline.length === 0 || timestamps.length === 0) return [];

  const days: DayGroup[] = [];
  let currentDateKey = "";

  for (let i = 0; i < timeline.length; i++) {
    const ts = timestamps[i];
    const dateKey = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}`;

    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      days.push({
        dayNumber: days.length + 1,
        dateLabel: formatDayLabel(ts),
        phases: [],
        totalMiles: 0,
        driveHours: 0,
      });
    }

    const day = days[days.length - 1];
    day.phases.push({ phase: timeline[i], timestamp: ts });

    const miles = timeline[i].miles ?? 0;
    day.totalMiles += miles;
    if (timeline[i].kind === "driving" || timeline[i].kind === "deadhead") {
      day.driveHours += timeline[i].duration_hours ?? 0;
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
}

export function RouteInspector({
  chain,
  originCity,
  returnCity,
  onClose,
  departureTime,
  returnByTime,
}: RouteInspectorProps) {
  const timeline = chain.timeline ?? [];

  // Compute effective departure: explicit prop → chain.suggested_departure →
  // derive from first pickup minus pre-pickup phases (deadhead + loading transit).
  // The simulator already respects working hours, so we use its timeline as-is.
  const effectiveDeparture = departureTime
    ?? (chain.suggested_departure ? new Date(chain.suggested_departure) : null)
    ?? (() => {
      const firstLeg = chain.legs.find((l) => l.pickup_date_early);
      if (!firstLeg?.pickup_date_early) return null;
      const pickupTime = new Date(firstLeg.pickup_date_early).getTime();
      let prePickupHours = 0;
      for (const phase of timeline) {
        if (phase.kind === "loading") break;
        prePickupHours += phase.duration_hours ?? 0;
      }
      return new Date(pickupTime - prePickupHours * 3_600_000);
    })();

  // Compute running timestamps
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

  const days = timestamps ? groupByDay(timeline, timestamps) : [];

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Suggested departure banner */}
      {effectiveDeparture && (
        <div className="px-4 py-3 bg-primary/10 border-b border-primary/20">
          <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "#cdcdcd" }}>Suggested Departure</p>
          <p className="text-lg font-bold" style={{ color: "#cdcdcd" }}>
            {formatDayLabel(effectiveDeparture)} at {formatTime(effectiveDeparture)}
          </p>
          {arrivalTime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Arrive{returnCity && returnCity === originCity ? ' home' : ''}: {formatDayLabel(arrivalTime)} at {formatTime(arrivalTime)}
            </p>
          )}
        </div>
      )}

      {/* Day cards */}
      <div className="flex-1 overflow-y-auto">
        {days.length > 0 ? (
          days.map((day) => (
            <div key={day.dayNumber} className="border-b border-white/10">
              {/* Day header */}
              <div className="flex items-baseline justify-between px-4 py-2.5 bg-white/[0.03]">
                <span className="text-sm font-semibold">
                  Day {day.dayNumber} <span className="text-muted-foreground font-normal">— {day.dateLabel}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {day.totalMiles > 0 && <>{day.totalMiles.toLocaleString()} mi · </>}
                  {formatDuration(day.driveHours)} drive
                </span>
              </div>
              {/* Phase rows */}
              {day.phases.map(({ phase, timestamp }, i) => (
                <PhaseRow key={i} phase={phase} timestamp={timestamp} showTimeOnly />
              ))}
            </div>
          ))
        ) : (
          // Fallback: flat list without day grouping (no departure time)
          timeline.map((phase, i) => (
            <PhaseRow key={i} phase={phase} timestamp={null} showTimeOnly={false} />
          ))
        )}
      </div>

      {/* Return-by note */}
      {returnByTime && (
        <div className="px-3 py-2 border-t border-white/10 text-xs text-muted-foreground">
          Return by: <span className="text-foreground font-medium">{formatTimestamp(returnByTime)}</span>
          {arrivalTime && arrivalTime <= returnByTime && (
            <span className="text-green-400 ml-2">On time</span>
          )}
          {arrivalTime && arrivalTime > returnByTime && (
            <span className="text-red-400 ml-2">Late</span>
          )}
        </div>
      )}

      {/* Assumptions footer */}
      <div className="px-3 py-2.5 border-t border-white/10 shrink-0">
        <p className="text-sm text-muted-foreground/50 leading-relaxed">
          <span className="font-medium text-muted-foreground/70">Assumptions:</span>{" "}
          Loaded @ {TRIP_DEFAULTS.loaded_speed_mph.value} mph · DH @ {TRIP_DEFAULTS.deadhead_speed_mph.value} mph · HOS {TRIP_DEFAULTS.avg_driving_hours_per_day.value}h avg drive day / 10h rest · Loading {TRIP_DEFAULTS.loading_hours.value}h · Unloading {TRIP_DEFAULTS.unloading_hours.value}h
        </p>
      </div>
    </div>
  );
}

function PhaseRow({ phase, timestamp, showTimeOnly }: { phase: TripPhase; timestamp: Date | null; showTimeOnly: boolean }) {
  const timeLabel = timestamp ? (
    <span className="text-xs text-muted-foreground/60 tabular-nums w-[4.5rem] shrink-0 text-right">
      {showTimeOnly ? formatTime(timestamp) : formatTimestamp(timestamp)}
    </span>
  ) : null;

  switch (phase.kind) {
    case 'deadhead':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <TruckIcon className="h-5 w-5 shrink-0" style={phaseStyle("deadhead")} />
          <span className="flex-1 text-sm font-semibold" style={phaseStyle("deadhead")}>
            {phase.origin_city} → {phase.destination_city} <span className="font-normal text-xs">(DH)</span>
          </span>
          <span className="text-sm tabular-nums shrink-0" style={phaseStyle("deadhead", true)}>
            {phase.miles?.toLocaleString()} mi
          </span>
          <span className="text-sm tabular-nums font-medium ml-2 w-14 text-right shrink-0" style={phaseStyle("deadhead")}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'driving':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <TruckIcon className="h-5 w-5 shrink-0" style={phaseStyle("driving")} />
          <span className="flex-1 text-sm font-semibold" style={phaseStyle("driving")}>
            {phase.origin_city} → {phase.destination_city}
          </span>
          <span className="text-sm tabular-nums shrink-0" style={phaseStyle("driving", true)}>
            {phase.miles?.toLocaleString()} mi
          </span>
          <span className="text-sm tabular-nums font-medium ml-2 w-14 text-right shrink-0" style={phaseStyle("driving")}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'loading':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <Package className="h-5 w-5 shrink-0" style={phaseStyle("loading")} />
          <span className="flex-1 text-sm" style={phaseStyle("loading")}>
            Loading at {phase.origin_city}
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("loading", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'unloading':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <PackageOpen className="h-5 w-5 shrink-0" style={phaseStyle("unloading")} />
          <span className="flex-1 text-sm" style={phaseStyle("unloading")}>
            Unloading at {phase.destination_city}
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("unloading", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'rest':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <Bed className="h-5 w-5 shrink-0" style={phaseStyle("rest")} />
          <span className="flex-1 text-sm" style={phaseStyle("rest")}>
            Rest
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("rest", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'break':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <Coffee className="h-5 w-5 shrink-0" style={phaseStyle("break")} />
          <span className="flex-1 text-sm" style={phaseStyle("break")}>
            Break
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("break", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'fuel':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <Fuel className="h-5 w-5 shrink-0" style={phaseStyle("fuel")} />
          <span className="flex-1 text-sm" style={phaseStyle("fuel")}>
            Fueling
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("fuel", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'waiting':
      return (
        <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.03]">
          {timeLabel}
          <ClockIcon className="h-5 w-5 shrink-0" style={phaseStyle("waiting")} />
          <span className="flex-1 text-sm" style={phaseStyle("waiting")}>
            Waiting for {phase.waiting_for === 'pickup_window' ? 'pickup' : 'delivery'} window
            {phase.origin_city ? ` at ${phase.origin_city}` : ''}
            {phase.destination_city ? ` at ${phase.destination_city}` : ''}
          </span>
          <span className="text-sm tabular-nums w-14 text-right shrink-0" style={phaseStyle("waiting", true)}>
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );
  }
}
