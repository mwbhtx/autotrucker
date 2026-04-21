"use client";

import { useCallback, useEffect, useState } from "react";
import { createAlert, deleteAlert, duplicateAlert, listAlerts, updateAlert } from "../api";
import type { Alert, CreateAlertInput, UpdateAlertInput } from "../types";

export interface UseAlertsResult {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateAlertInput) => Promise<Alert>;
  update: (id: string, patch: UpdateAlertInput) => Promise<Alert>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<Alert>;
}

export function useAlerts(): UseAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await listAlerts());
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
    async (input: CreateAlertInput) => {
      const next = await createAlert(input);
      await refresh();
      return next;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: UpdateAlertInput) => {
      const next = await updateAlert(id, patch);
      await refresh();
      return next;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteAlert(id);
      await refresh();
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const next = await duplicateAlert(id);
      await refresh();
      return next;
    },
    [refresh],
  );

  return { alerts, loading, error, refresh, create, update, remove, duplicate };
}
