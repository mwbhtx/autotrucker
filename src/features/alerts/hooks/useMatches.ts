"use client";

import { useCallback, useEffect, useState } from "react";
import { dismissMatch, listMatches, markAllRead } from "../api";
import type { AlertMatchGroup } from "../types";

export interface UseMatchesResult {
  matches: AlertMatchGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismiss: (matchGroupId: string) => Promise<void>;
  markAll: () => Promise<void>;
}

export function useMatches(opts: {
  status?: "active" | "dismissed" | "all";
  limit?: number;
} = {}): UseMatchesResult {
  const [matches, setMatches] = useState<AlertMatchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatches(await listMatches(opts));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [opts.status, opts.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismiss = useCallback(
    async (matchGroupId: string) => {
      await dismissMatch(matchGroupId);
      await refresh();
    },
    [refresh],
  );

  const markAll = useCallback(async () => {
    await markAllRead();
    await refresh();
  }, [refresh]);

  return { matches, loading, error, refresh, dismiss, markAll };
}
