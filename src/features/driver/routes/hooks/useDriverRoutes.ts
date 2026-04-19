// src/features/driver/routes/hooks/useDriverRoutes.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDriverRoute,
  deleteDriverRoute,
  listDriverRoutes,
} from "../api";
import type { DriverRouteSummary } from "../types";

export interface UseDriverRoutesResult {
  routes: DriverRouteSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (orderIds: [string, string]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useDriverRoutes(): UseDriverRoutesResult {
  const [routes, setRoutes] = useState<DriverRouteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDriverRoutes();
      setRoutes(data.routes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (orderIds: [string, string]) => {
      await createDriverRoute(orderIds);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDriverRoute(id);
      await refresh();
    },
    [refresh],
  );

  return { routes, loading, error, refresh, create, remove };
}
