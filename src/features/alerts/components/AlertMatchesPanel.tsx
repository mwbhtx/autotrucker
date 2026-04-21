"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/core/utils";
import { Button } from "@/platform/web/components/ui/button";
import { MatchCard } from "./MatchCard";
import { useMatches } from "../hooks/useMatches";
import type { AlertMatchGroup } from "../types";

type StatusFilter = "active" | "dismissed" | "all";

interface AlertMatchesPanelProps {
  /** When true, section starts expanded (used when deep-linked with ?matches=1). */
  defaultExpanded?: boolean;
}

export function AlertMatchesPanel({ defaultExpanded = false }: AlertMatchesPanelProps) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const { matches, loading, error, dismiss, markAll } = useMatches({ status, limit: 50 });
  const [expanded, setExpanded] = useState(defaultExpanded);

  const grouped = useMemo(() => groupByAlert(matches), [matches]);

  return (
    <section
      id="alert-matches"
      className={cn(
        "rounded-md border border-border bg-card",
        defaultExpanded && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
        >
          <span>Alert Matches</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {matches.length}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {(["active", "dismissed", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-md px-2 py-1 text-xs capitalize transition-colors",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
          {status === "active" && matches.length > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={markAll} className="ml-1">
              Mark all read
            </Button>
          )}
        </div>
      </header>

      {expanded && (
        <div className="p-3">
          {loading && matches.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading matches…</div>
          )}
          {error && <div className="py-4 text-sm text-destructive">Couldn't load: {error}</div>}
          {!loading && !error && matches.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {status === "active"
                ? "No matches yet. "
                : status === "dismissed"
                  ? "No dismissed matches. "
                  : "No matches in the last 7 days. "}
              <Link href="/settings#alerts" className="underline hover:text-primary">
                Manage alerts
              </Link>
            </div>
          )}
          {grouped.map(({ alertId, alertName, items }) => (
            <div key={alertId} className="mb-4 last:mb-0">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {alertName} · {items.length}
              </div>
              <div className="flex flex-col gap-2">
                {items.map((m) => (
                  <MatchCard key={m.match_group_id} match={m} onDismiss={dismiss} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupByAlert(matches: AlertMatchGroup[]) {
  const byAlert = new Map<string, { alertId: string; alertName: string; items: AlertMatchGroup[] }>();
  for (const m of matches) {
    const bucket = byAlert.get(m.alert_id) || {
      alertId: m.alert_id,
      alertName: m.alert_name,
      items: [],
    };
    bucket.items.push(m);
    byAlert.set(m.alert_id, bucket);
  }
  return [...byAlert.values()];
}
