// src/features/driver/routes/components/RouteCard.tsx
"use client";

import { Trash2 } from "lucide-react";
import type { DriverRouteSummary } from "../types";

export interface RouteCardProps {
  route: DriverRouteSummary;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** When true, the card shows a primary-color left bar + subtle
   *  highlight so the user remembers which route's details they're
   *  viewing on the right. */
  selected?: boolean;
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatMiles(n: number): string {
  return n.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(`${d}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RouteCard({ route, onOpen, onDelete, selected = false }: RouteCardProps) {
  const dateRange =
    route.earliest_pickup_date === route.latest_pickup_date
      ? formatDate(route.earliest_pickup_date)
      : `${formatDate(route.earliest_pickup_date)} – ${formatDate(route.latest_pickup_date)}`;

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-md border bg-card transition-colors ${
        selected ? "border-primary/40 bg-accent/30" : "border-border"
      }`}
    >
      {/* Left accent bar — primary color when this card's route is the
          one being previewed on the right. Matches the treatment used on
          Orders / Stopoffs / Schedule cards in the route-detail panel. */}
      <div
        aria-hidden="true"
        className={`w-[3px] shrink-0 transition-colors ${
          selected ? "bg-primary" : "bg-transparent"
        }`}
      />
      <button
        type="button"
        data-testid="route-card-body"
        onClick={() => onOpen(route.id)}
        className="flex-1 px-4 py-3 text-left hover:bg-accent/30"
      >
        {/* Per-order segments — one line per load so a multi-order
            route doesn't collapse to a single "first → last" pair that
            hides what's actually in it. Falls back to the collapsed
            pair when segments is absent (older rows). */}
        {route.segments && route.segments.length > 0 ? (
          <div className="text-sm font-medium space-y-0.5">
            {route.segments.map((seg, i) => (
              <div key={`${seg.order_id}-${i}`}>
                {seg.origin_city}, {seg.origin_state} → {seg.destination_city}, {seg.destination_state}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm font-medium">
            {route.origin.city}, {route.origin.state} → {route.destination.city}, {route.destination.state}
          </div>
        )}
        <div className="text-xs text-muted-foreground">{dateRange}</div>
        {route.summary ? (
          <div className="mt-2 flex gap-6 text-xs tabular-nums">
            <span>
              <span className="text-muted-foreground">Pay </span>
              {formatCurrency(route.summary.total_pay)}
            </span>
            <span>
              <span className="text-muted-foreground">Miles </span>
              {formatMiles(route.summary.total_miles)}
            </span>
            <span>
              <span className="text-muted-foreground">RPM </span>
              ${route.summary.effective_rpm.toFixed(2)}
            </span>
            <span>
              <span className="text-muted-foreground">Net </span>
              {formatCurrency(route.summary.profit)}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">Analysis unavailable</div>
        )}
      </button>
      <button
        type="button"
        aria-label="Delete route"
        onClick={() => onDelete(route.id)}
        className="flex items-center justify-center px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive border-l border-border"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
