"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchApi } from "@/core/services/api";
import type { RouteSearchResult } from "@mwbhtx/haulvisor-core";

export interface RouteSearchParams {
  origin_lat: number;
  origin_lng: number;
  departure_date: string;
  destination_lat?: number;
  destination_lng?: number;
  destination_city?: string;
  search_radius_miles?: number;
  max_trip_days?: number;
  num_orders?: number;
  trailer_types?: string;
  max_weight?: number;
  hazmat_certified?: boolean;
  twic_card?: boolean;
  team_driver?: boolean;
  no_tarps?: boolean;
  late_tolerance_hours?: number;
  early_tolerance_hours?: number;
  ignore_radius?: boolean;
  origin_radius_miles?: number;
  dest_radius_miles?: number;
  cost_per_mile?: number;
  avg_mpg?: number;
  max_driving_hours_per_day?: number;
  max_on_duty_hours_per_day?: number;
  earliest_on_duty_hour?: number;
  latest_on_duty_hour?: number;
  max_deadhead_pct?: number;
  min_daily_profit?: number;
  min_rpm?: number;
  max_interleg_deadhead_miles?: number;
  /** Cache-bust token — forces a new search even with identical params */
  _t?: number;
}

export interface SearchProgress {
  total_orders: number;
  pairs_total: number;
  pairs_checked: number;
  pairs_pruned: number;
  pairs_simulated: number;
  routes_found: number;
  elapsed_ms: number;
}

interface SearchPollResponse {
  status: "running" | "complete" | "failed";
  progress: SearchProgress;
  result?: RouteSearchResult;
  error?: string;
}

export function useRouteSearch(companyId: string, params: RouteSearchParams | null) {
  const [data, setData] = useState<RouteSearchResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramsKeyRef = useRef<string>("");
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const paramsKey = params ? JSON.stringify(params) : "";

  useEffect(() => {
    if (!companyId || !params || paramsKey === paramsKeyRef.current) return;
    paramsKeyRef.current = paramsKey;

    stopPolling();
    cancelledRef.current = false;
    setIsLoading(true);
    setIsFetched(false);
    setError(null);
    setProgress(null);

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "_t" || value == null) continue;
      qs.set(key, String(value));
    }

    // Sequential poll loop — waits for each request to finish before scheduling the next.
    // Prevents overlapping requests when the tab is backgrounded and throttled.
    async function pollLoop(searchId: string) {
      while (!cancelledRef.current) {
        await new Promise(resolve => {
          pollRef.current = setTimeout(resolve, 1500);
        });
        if (cancelledRef.current) break;

        try {
          const resp = await fetchApi<SearchPollResponse>(
            `routes/${companyId}/search/${searchId}`,
          );

          if (cancelledRef.current) break;
          setProgress(resp.progress);

          if (resp.status === "complete" && resp.result) {
            setData(resp.result);
            setIsLoading(false);
            setIsFetched(true);
            return;
          } else if (resp.status === "failed") {
            setError(new Error(resp.error || "Search failed"));
            setIsLoading(false);
            setIsFetched(true);
            return;
          }
        } catch {
          if (cancelledRef.current) break;
          // Job may have expired (404) or network error — stop polling
          setError(new Error("Search expired or failed. Please try again."));
          setIsLoading(false);
          setIsFetched(true);
          return;
        }
      }
    }

    fetchApi<{ search_id: string }>(`routes/${companyId}/search?${qs.toString()}`, {
      method: "POST",
    })
      .then(({ search_id }) => {
        if (!cancelledRef.current) pollLoop(search_id);
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        setIsFetched(true);
      });

    return () => stopPolling();
  }, [companyId, paramsKey]);

  const cancel = useCallback(() => {
    stopPolling();
    paramsKeyRef.current = "";
    setIsLoading(false);
    setIsFetched(false);
    setProgress(null);
  }, [stopPolling]);

  return { data, isLoading, isFetched, error, progress, cancel };
}
