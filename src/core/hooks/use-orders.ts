"use client";

import {
  useQuery,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import type { Order, PaginatedOrders, OrderFilters } from "@/core/types";

/** Order with optional task fields from the API response envelope */
export type OrderWithTask = Order & { task_status?: string; task_id?: string };

// ---------- Hooks ----------

export function useOrders(
  companyId: string,
  filters: Omit<OrderFilters, "offset">,
) {
  const limit = filters.limit ?? 50;
  return useInfiniteQuery<PaginatedOrders, Error, InfiniteData<PaginatedOrders, number>, readonly unknown[], number>({
    queryKey: ["orders", companyId, filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.origin_state) params.set("origin_state", filters.origin_state);
      if (filters.destination_state)
        params.set("destination_state", filters.destination_state);
      if (filters.trailer_type) params.set("trailer_type", filters.trailer_type);
      if (filters.min_pay) params.set("min_pay", String(filters.min_pay));
      params.set("limit", String(limit));
      if (pageParam > 0) params.set("offset", String(pageParam));

      const qs = params.toString();
      return fetchApi<PaginatedOrders>(
        `orders/${companyId}${qs ? `?${qs}` : ""}`,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < limit) return undefined;
      return allPages.reduce((sum, p) => sum + p.items.length, 0);
    },
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useAllActiveOrders(companyId: string) {
  return useQuery<Order[]>({
    queryKey: ["orders", companyId, "active"],
    queryFn: () => fetchApi<Order[]>(`orders/${companyId}/active`),
    refetchInterval: 60_000,
    enabled: !!companyId,
  });
}

export function useActiveOrderCount(companyId: string) {
  return useQuery<{ count: number }>({
    queryKey: ["orders", companyId, "count"],
    queryFn: () => fetchApi<{ count: number }>(`orders/${companyId}/count`),
    staleTime: 60_000,
    enabled: !!companyId,
  });
}

export function useOrder(companyId: string, orderId: string | undefined) {
  return useQuery<OrderWithTask>({
    queryKey: ["orders", companyId, orderId],
    queryFn: () => fetchApi<OrderWithTask>(`orders/${companyId}/${orderId}`),
    enabled: !!companyId && !!orderId,
  });
}

export function useOrderDetails(companyId: string, orderId: string | undefined) {
  return useQuery<OrderWithTask | null>({
    queryKey: ["orders", companyId, orderId, "details"],
    queryFn: () => fetchApi<OrderWithTask | null>(`orders/${companyId}/${orderId}`),
    enabled: !!companyId && !!orderId,
  });
}

// ---------- Search ----------

export function useOrderSearch(companyId: string, query: string) {
  const trimmed = query.trim();
  return useQuery<Order[]>({
    queryKey: ["orders", companyId, "search", trimmed],
    queryFn: () => fetchApi<Order[]>(`orders/${companyId}/search?q=${encodeURIComponent(trimmed)}`),
    enabled: !!companyId && trimmed.length > 0,
    placeholderData: (prev) => prev,
  });
}

// ---------- Task polling ----------

export interface TaskResult {
  task_id: string;
  task_status: "pending" | "processing" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

export function useTask(taskId: string | null) {
  return useQuery<TaskResult>({
    queryKey: ["task", taskId],
    queryFn: () => fetchApi<TaskResult>(`tasks/${taskId}`),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const taskStatus = query.state.data?.task_status;
      if (taskStatus === "completed" || taskStatus === "failed") return false;
      return 2000;
    },
  });
}
