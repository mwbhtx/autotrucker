"use client";

import { createContext, useContext } from "react";
import { useRoutesStore } from "@/core/stores/routes-store";
import { useRouteSearch, type SearchProgress } from "@/core/hooks/use-routes";
import { useAuth } from "@/core/services/auth-provider";
import type { RouteSearchResult } from "@mwbhtx/haulvisor-core";

interface RouteSearchContextValue {
  data: RouteSearchResult | undefined;
  isLoading: boolean;
  isFetched: boolean;
  error: Error | null;
  progress: SearchProgress | null;
  elapsedMs: number;
  cancel: () => void;
}

const RouteSearchContext = createContext<RouteSearchContextValue | null>(null);

export function RouteSearchProvider({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useAuth();
  const { searchParams } = useRoutesStore();
  const result = useRouteSearch(activeCompanyId ?? "", searchParams);

  return (
    <RouteSearchContext.Provider value={result}>
      {children}
    </RouteSearchContext.Provider>
  );
}

export function useRouteSearchContext(): RouteSearchContextValue {
  const ctx = useContext(RouteSearchContext);
  if (!ctx) throw new Error("useRouteSearchContext must be used within RouteSearchProvider");
  return ctx;
}
