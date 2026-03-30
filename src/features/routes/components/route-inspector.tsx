"use client";

import { TruckIcon, ClockIcon, Package, PackageOpen, Fuel, Coffee, Bed } from "lucide-react";
import type { RoundTripChain, TripPhase } from "@/core/types";
import { TRIP_DEFAULTS } from "@mwbhtx/haulvisor-core";

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

/** Format a Date as MM/DD HH:mm */
function formatTimestamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

interface RouteInspectorProps {
  chain: RoundTripChain;
  originCity: string;
  returnCity?: string;
  onClose: () => void;
  /** Optional departure datetime — when set, shows running timestamps on each phase */
  departureTime?: Date;
  /** Optional return-by datetime — shown as a footer note */
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

  // Compute running timestamps if departure time is provided
  const timestamps: Date[] | null = departureTime
    ? (() => {
        const ts: Date[] = [];
        let cursor = departureTime.getTime();
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

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Departure header */}
      {departureTime && (
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>Depart: <span className="text-foreground font-medium">{formatTimestamp(departureTime)}</span></span>
          {arrivalTime && (
            <span>Arrive: <span className="text-foreground font-medium">{formatTimestamp(arrivalTime)}</span></span>
          )}
        </div>
      )}

      {/* Phase rows */}
      <div className="flex-1 overflow-y-auto">
        {timeline.map((phase, i) => (
          <PhaseRow key={i} phase={phase} timestamp={timestamps?.[i] ?? null} />
        ))}
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

function PhaseRow({ phase, timestamp }: { phase: TripPhase; timestamp: Date | null }) {
  const timeLabel = timestamp ? (
    <span className="text-[11px] text-muted-foreground/50 tabular-nums w-[4.5rem] shrink-0">
      {formatTimestamp(timestamp)}
    </span>
  ) : null;

  switch (phase.kind) {
    case 'deadhead':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <div className="h-2 w-2 rounded-full border-2 border-muted-foreground/40 bg-card shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground">
            DH: {phase.origin_city} → {phase.destination_city}
          </span>
          <span className="text-sm text-muted-foreground/40 tabular-nums shrink-0">
            {phase.miles?.toLocaleString()} mi
          </span>
          <span className="text-sm text-muted-foreground tabular-nums ml-2 w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'driving':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <TruckIcon className="h-5 w-5 text-foreground/70 shrink-0" />
          <span className="flex-1 text-sm font-semibold">
            {phase.origin_city} → {phase.destination_city}
          </span>
          <span className="text-sm text-muted-foreground/40 tabular-nums shrink-0">
            {phase.miles?.toLocaleString()} mi
          </span>
          <span className="text-sm tabular-nums font-medium ml-2 w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'loading':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <Package className="h-5 w-5 text-blue-400/70 shrink-0" />
          <span className="flex-1 text-sm text-blue-400/70">
            Loading at {phase.origin_city}
          </span>
          <span className="text-sm text-muted-foreground/70 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'unloading':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <PackageOpen className="h-5 w-5 text-blue-400/70 shrink-0" />
          <span className="flex-1 text-sm text-blue-400/70">
            Unloading at {phase.destination_city}
          </span>
          <span className="text-sm text-muted-foreground/70 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'rest':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <Bed className="h-5 w-5 text-muted-foreground/40 shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground/50">
            Rest
          </span>
          <span className="text-sm text-muted-foreground/40 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'break':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <Coffee className="h-5 w-5 text-muted-foreground/40 shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground/50">
            Break
          </span>
          <span className="text-sm text-muted-foreground/40 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'fuel':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <Fuel className="h-5 w-5 text-muted-foreground/40 shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground/50">
            Fueling
          </span>
          <span className="text-sm text-muted-foreground/40 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );

    case 'waiting':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          {timeLabel}
          <ClockIcon className="h-5 w-5 text-primary/60 shrink-0" />
          <span className="flex-1 text-sm text-primary/70">
            Waiting for {phase.waiting_for === 'pickup_window' ? 'pickup' : 'delivery'} window
            {phase.origin_city ? ` at ${phase.origin_city}` : ''}
            {phase.destination_city ? ` at ${phase.destination_city}` : ''}
          </span>
          <span className="text-sm text-muted-foreground/70 tabular-nums w-14 text-right shrink-0">
            {formatDuration(phase.duration_hours)}
          </span>
        </div>
      );
  }
}
