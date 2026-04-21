"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/platform/web/components/ui/badge";
import { Button } from "@/platform/web/components/ui/button";
import { cn } from "@/core/utils";
import type { AlertMatchGroup } from "../types";

interface MatchCardProps {
  match: AlertMatchGroup;
  onDismiss: (matchGroupId: string) => void;
}

export function MatchCard({ match, onDismiss }: MatchCardProps) {
  const first = match.orders[0];
  const last = match.orders[match.orders.length - 1];
  const isMultileg = match.orders.length > 1;
  const stale = match.live_status !== "available";

  const totalPay = match.orders.reduce((s, o) => s + (o.total_pay_dollars || 0), 0);
  const totalMiles = match.orders.reduce((s, o) => s + (o.total_miles || 0), 0);
  const totalDeadhead = match.orders.reduce((s, o) => s + (o.deadhead_miles || 0), 0);
  const rpm = totalMiles > 0 ? totalPay / (totalMiles + totalDeadhead) : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3",
        stale ? "border-border/60 bg-muted/30" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{match.alert_name}</span>
            {isMultileg && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {match.orders.length} legs
              </Badge>
            )}
            {stale && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] text-muted-foreground">
                No longer available
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            matched {formatRelative(match.matched_at)}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onDismiss(match.match_group_id)}
          title="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-medium">
          {first.origin_city}, {first.origin_state}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">
          {last.destination_city}, {last.destination_state}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">${totalPay.toLocaleString()}</span> total
        </span>
        <span>
          <span className="font-medium text-foreground">{Math.round(totalMiles)} mi</span> loaded
        </span>
        <span>
          <span className="font-medium text-foreground">${rpm.toFixed(2)}</span>/mi all-in
        </span>
        <span>
          <span className="font-medium text-foreground">{Math.round(totalDeadhead)} mi</span> deadhead
        </span>
        <span className="capitalize">{first.trailer_type?.toLowerCase() || ""}</span>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}
