"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/core/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/platform/web/components/ui/popover";
import { Badge } from "@/platform/web/components/ui/badge";
import { Button } from "@/platform/web/components/ui/button";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { useMatches } from "../hooks/useMatches";

export function BellIcon() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { count, refresh: refreshCount } = useUnreadCount();
  const { matches, loading, dismiss, markAll } = useMatches({ status: "active", limit: 8 });

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) void refreshCount();
    },
    [refreshCount],
  );

  const handleViewAll = useCallback(() => {
    setOpen(false);
    router.push("/driver/routes?matches=1");
  }, [router]);

  const handleMarkAll = useCallback(async () => {
    await markAll();
    await refreshCount();
  }, [markAll, refreshCount]);

  const display = count > 99 ? "99+" : count.toString();

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Alert matches"
          aria-label={count > 0 ? `${count} unread alert matches` : "No unread alert matches"}
          className={cn(
            "relative flex items-center justify-center rounded-md p-1.5",
            "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          )}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {display}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Alert matches</span>
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleMarkAll}
              className="h-auto px-2 py-0.5 text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && matches.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</div>
          )}
          {!loading && matches.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No new matches
            </div>
          )}
          {matches.slice(0, 8).map((group) => {
            const first = group.orders[0];
            const last = group.orders[group.orders.length - 1];
            const stale = group.live_status !== "available";
            return (
              <button
                key={group.match_group_id}
                type="button"
                onClick={() => {
                  void dismiss(group.match_group_id);
                  setOpen(false);
                  router.push("/driver/routes?matches=1");
                }}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{group.alert_name}</span>
                  {stale && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px] text-muted-foreground">
                      No longer available
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {first.origin_city} {first.origin_state} → {last.destination_city}{" "}
                  {last.destination_state} · ${first.rpm_all_in.toFixed(2)}/mi
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelative(group.matched_at)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleViewAll}
            className="w-full justify-center text-xs"
          >
            View all matches
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
