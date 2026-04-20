// src/features/driver/routes/components/RouteDetailDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RouteDetailPanel } from "@/features/routes/views/desktop/route-detail-panel";
import { getDriverRoute, updateDriverRouteDays } from "../api";
import type { DriverRouteDetail } from "../types";
import type { RouteChain } from "@/core/types";
import { Input } from "@/platform/web/components/ui/input";

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
  const [daysInput, setDaysInput] = useState<string>("");
  const [savingDays, setSavingDays] = useState(false);

  useEffect(() => {
    if (!routeId) {
      setDetail(null);
      setDaysInput("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDriverRoute(routeId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setDaysInput(d.days_driven != null ? String(d.days_driven) : "");
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [routeId]);

  async function commitDays() {
    if (!routeId || !detail) return;
    const trimmed = daysInput.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 365)) {
      setDaysInput(detail.days_driven != null ? String(detail.days_driven) : "");
      return;
    }
    // No change → no request
    if ((parsed ?? null) === (detail.days_driven ?? null)) return;
    setSavingDays(true);
    try {
      const updated = await updateDriverRouteDays(routeId, parsed);
      setDetail(updated);
      setDaysInput(updated.days_driven != null ? String(updated.days_driven) : "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingDays(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Route Details</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Days-driven input — drives $/Day + Days in the summary below. */}
      {!loading && !error && detail && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
          <label htmlFor="days-driven" className="text-muted-foreground">
            Days to complete
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="days-driven"
              type="number"
              min={1}
              max={365}
              step={1}
              value={daysInput}
              disabled={savingDays}
              onChange={(e) => setDaysInput(e.target.value)}
              onBlur={commitDays}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="—"
              className="h-8 w-20 text-right tabular-nums"
            />
          </div>
        </div>
      )}

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
