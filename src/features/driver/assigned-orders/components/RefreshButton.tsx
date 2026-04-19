"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
import { refreshAssignedOrders } from "../api";

const COOLDOWN_MS = 30_000;

export function RefreshButton({ onRefreshed }: { onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      await refreshAssignedOrders();
    } catch (err) {
      const message = (err as Error).message || "Refresh failed";
      setError(
        message.includes("429")
          ? "Rate limited — try again shortly."
          : message,
      );
    } finally {
      timerRef.current = setTimeout(() => {
        onRefreshed();
        setBusy(false);
      }, COOLDOWN_MS);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? "Syncing…" : "Refresh"}
      </Button>
      {error && (
        <div className="text-xs text-destructive" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
