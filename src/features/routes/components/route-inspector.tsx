"use client";

import { TruckIcon, ClockIcon, Package, PackageOpen, Fuel, Coffee, Bed } from "lucide-react";
import type { RoundTripChain, TripPhase } from "@/lib/types";
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

interface RouteInspectorProps {
  chain: RoundTripChain;
  originCity: string;
  returnCity?: string;
  onClose: () => void;
}

export function RouteInspector({
  chain,
  originCity,
  returnCity,
  onClose,
}: RouteInspectorProps) {
  const timeline = chain.timeline ?? [];

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      {/* Header */}
      <div className="flex items-center px-3 py-2.5 border-b border-white/10 shrink-0">
        <p className="flex-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Segment Breakdown
        </p>
      </div>

      {/* Phase rows */}
      <div className="flex-1 overflow-y-auto">
        {timeline.map((phase, i) => (
          <PhaseRow key={i} phase={phase} />
        ))}
      </div>

      {/* Assumptions footer */}
      <div className="px-3 py-2.5 border-t border-white/10 shrink-0">
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          <span className="font-medium text-muted-foreground/70">Assumptions:</span>{" "}
          Loaded @ {TRIP_DEFAULTS.loaded_speed_mph.value} mph · DH @ {TRIP_DEFAULTS.deadhead_speed_mph.value} mph · HOS {TRIP_DEFAULTS.avg_driving_hours_per_day.value}h avg drive day / 10h rest · Loading {TRIP_DEFAULTS.loading_hours.value}h · Unloading {TRIP_DEFAULTS.unloading_hours.value}h
        </p>
      </div>
    </div>
  );
}

function PhaseRow({ phase }: { phase: TripPhase }) {
  switch (phase.kind) {
    case 'deadhead':
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.05]">
          <div className="h-2 w-2 rounded-full border-2 border-muted-foreground/40 bg-card shrink-0" />
          <span className="flex-1 text-sm text-muted-foreground">
            DH: {phase.origin_city} → {phase.destination_city}
          </span>
          <span className="text-xs text-muted-foreground/40 tabular-nums shrink-0">
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
          <TruckIcon className="h-3.5 w-3.5 text-foreground/70 shrink-0" />
          <span className="flex-1 text-sm font-semibold">
            {phase.origin_city} → {phase.destination_city}
          </span>
          <span className="text-xs text-muted-foreground/40 tabular-nums shrink-0">
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
          <Package className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
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
          <PackageOpen className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
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
          <Bed className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
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
          <Coffee className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
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
          <Fuel className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
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
          <ClockIcon className="h-3.5 w-3.5 text-[#ff5601]/60 shrink-0" />
          <span className="flex-1 text-sm text-[#ff5601]/70">
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
