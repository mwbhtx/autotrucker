// src/features/driver/routes/api.ts
import { fetchApi } from "@/core/services/api";
import type {
  DriverRoutesListResponse,
  DriverRouteDetail,
  CreateDriverRouteResponse,
} from "./types";

export async function listDriverRoutes(): Promise<DriverRoutesListResponse> {
  return fetchApi<DriverRoutesListResponse>("/driver/routes");
}

export async function getDriverRoute(id: string): Promise<DriverRouteDetail> {
  return fetchApi<DriverRouteDetail>(`/driver/routes/${encodeURIComponent(id)}`);
}

export async function createDriverRoute(
  orderIds: [string, string],
): Promise<CreateDriverRouteResponse> {
  return fetchApi<CreateDriverRouteResponse>("/driver/routes", {
    method: "POST",
    body: JSON.stringify({ order_ids: orderIds }),
  });
}

export async function deleteDriverRoute(id: string): Promise<void> {
  await fetchApi(`/driver/routes/${encodeURIComponent(id)}`, { method: "DELETE" });
}
