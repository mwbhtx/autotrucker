import { fetchApi } from "@/core/services/api";
import type { AssignedOrder } from "./types";

export async function listAssignedOrders(): Promise<AssignedOrder[]> {
  const res = await fetchApi<{ orders: AssignedOrder[]; count: number }>(
    "/driver/assigned-orders",
  );
  return res.orders;
}

export async function refreshAssignedOrders(): Promise<{ queued: true }> {
  return fetchApi<{ queued: true }>("/driver/assigned-orders/refresh", {
    method: "POST",
  });
}
