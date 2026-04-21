"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUnreadCount } from "../api";

const POLL_INTERVAL_MS = 60_000;

export interface UseUnreadCountResult {
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Polls the backend every 60s for undismissed matches in the last 7 days. */
export function useUnreadCount(): UseUnreadCountResult {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUnreadCount();
      if (mountedRef.current) setCount(res.count);
    } catch {
      // silent — transient fetch failures shouldn't break the nav badge
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { count, loading, refresh };
}
