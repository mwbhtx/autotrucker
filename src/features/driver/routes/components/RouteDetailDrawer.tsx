// src/features/driver/routes/components/RouteDetailDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RouteDetailPanel } from "@/features/routes/views/desktop/route-detail-panel";
import { getDriverRoute } from "../api";
import type { DriverRouteDetail } from "../types";
import type { RouteChain } from "@/core/types";

export interface RouteDetailDrawerProps {
  routeId: string | null;
  onClose: () => void;
}

/**
 * Inline route-details panel for the /driver/routes page. Renders *inside*
 * the page's content area (not as a fixed overlay) so its parent can
 * animate a side-by-side layout and the tabs above stay visible.
 */
export function RouteDetailDrawer({ routeId, onClose }: RouteDetailDrawerProps) {
  const [detail, setDetail] = useState<DriverRouteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDriverRoute(routeId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [routeId]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Route Details</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="p-4 text-sm text-destructive">{error}</div>}
        {!loading && !error && detail && detail.analysis && (
          <RouteDetailPanel
            chain={detail.analysis as RouteChain}
            originCity={detail.origin.city}
            destCity={detail.destination.city}
            costPerMile={detail.analysis.effective_cost_per_mile ?? 0}
            searchParams={null}
            fullWidth
            hideDeliversEarlyBadge
          />
        )}
        {!loading && !error && detail && !detail.analysis && (
          <div className="p-4 text-sm text-muted-foreground">
            The route engine couldn't evaluate this route. Common causes: missing home-base setting, or fuel price
            unavailable for your region. Configure those in Settings and try again.
          </div>
        )}
      </div>
    </div>
  );
}
