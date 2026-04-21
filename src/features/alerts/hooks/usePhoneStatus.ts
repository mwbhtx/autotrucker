"use client";

import { useCallback, useEffect, useState } from "react";
import { getPhoneStatus } from "../api";
import type { PhoneStatusResponse } from "../types";

export interface UsePhoneStatusResult {
  status: PhoneStatusResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePhoneStatus(): UsePhoneStatusResult {
  const [status, setStatus] = useState<PhoneStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getPhoneStatus());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
