"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import { useAuth } from "@/core/services/auth-provider";

export interface RecentSearch {
  id: string;
  origin: { label: string; coordinates: [number, number] };
  destination: { label: string; coordinates: [number, number] };
  filters: {
    trailerType?: string;
    maxIdle?: number;
    deadheadPercent?: number;
    homeBy?: string;
    legs?: number;
    sort?: string;
  };
  searchedAt: string;
}

export function useRecentSearches() {
  const { activeCompanyId } = useAuth();

  const query = useQuery<RecentSearch[]>({
    queryKey: ["recent-searches", activeCompanyId],
    queryFn: () => fetchApi<RecentSearch[]>(`recent-searches`),
    enabled: !!activeCompanyId,
    staleTime: 60_000,
  });

  return query;
}

export function useSaveRecentSearch() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useAuth();

  return useMutation({
    mutationFn: (search: Omit<RecentSearch, "id" | "searchedAt">) =>
      fetchApi("recent-searches", {
        method: "POST",
        body: JSON.stringify(search),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-searches", activeCompanyId] });
    },
  });
}
