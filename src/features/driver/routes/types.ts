// src/features/driver/routes/types.ts
import type {
  DriverRouteSummary,
  DriverRouteDetail,
  DriverRouteErrorCode,
} from "@mwbhtx/haulvisor-core";

export type { DriverRouteSummary, DriverRouteDetail, DriverRouteErrorCode };

export interface DriverRoutesListResponse {
  routes: DriverRouteSummary[];
}

export interface CreateDriverRouteResponse {
  id: string;
  order_ids: string[];
  created_at: string;
}
