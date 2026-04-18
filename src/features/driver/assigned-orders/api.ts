import { fetchApi } from "@/core/services/api";
import type { AssignedOrder } from "./types";

export async function listAssignedOrders(
  from?: string,
  to?: string,
): Promise<AssignedOrder[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return fetchApi<AssignedOrder[]>(
    `/driver/assigned-orders${qs ? `?${qs}` : ""}`,
  );
}
