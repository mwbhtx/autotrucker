"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { ApiError } from "@/core/services/api";
import { syncAllAssignedOrders } from "../api";
import type { ActiveSyncTask, SyncAllResponse } from "../types";
import { useSyncAllState } from "../hooks/useSyncAllState";

export interface SyncAllButtonProps {
  activeSyncTask: ActiveSyncTask | null;
  nextSyncAvailableAt: string | null;
  onSyncStarted: (resp: SyncAllResponse) => void;
  onSyncFinished: () => void;
}

const ERROR_DWELL_MS = 3_000;

function formatRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
}

export function SyncAllButton({
  activeSyncTask,
  nextSyncAvailableAt,
  onSyncStarted,
  onSyncFinished,
}: SyncAllButtonProps) {
  const [isPosting, setIsPosting] = useState(false);
  const [errorDwell, setErrorDwell] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  const { state, enabled, remainingMs, progress } = useSyncAllState({
    activeSyncTask,
    nextSyncAvailableAt,
    onFinished: onSyncFinished,
  });

  async function handleClick() {
    if (!enabled || isPosting) return;
    setIsPosting(true);
    try {
      const resp = await syncAllAssignedOrders();
      onSyncStarted(resp);
    } catch (err) {
      let msg = "Sync failed";
      if (err instanceof ApiError) {
        if (err.status === 429) msg = "Cooldown still active";
        else if (err.status === 409) msg = "Sync already in progress";
        else if (err.status === 422) msg = "No orders to sync";
      }
      setErrorDwell(msg);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(
        () => setErrorDwell(null),
        ERROR_DWELL_MS,
      );
    } finally {
      setIsPosting(false);
    }
  }

  let icon: React.ReactNode;
  let label: string;
  if (errorDwell) {
    icon = <AlertTriangle className="h-4 w-4" />;
    label = errorDwell;
  } else if (state === "in_flight" && progress) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    label = `Syncing ${progress.completed}/${progress.total}`;
  } else if (state === "just_finished") {
    icon = <Check className="h-4 w-4" />;
    label = "Synced";
  } else if (state === "failed") {
    icon = <AlertTriangle className="h-4 w-4" />;
    label = "Sync failed";
  } else if (state === "cooldown") {
    icon = <RotateCw className="h-4 w-4" />;
    label = `Available in ${formatRemaining(remainingMs)}`;
  } else {
    icon = <RotateCw className="h-4 w-4" />;
    label = "Sync Orders";
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={!enabled || isPosting || !!errorDwell}
      aria-live="polite"
      className="gap-2"
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
