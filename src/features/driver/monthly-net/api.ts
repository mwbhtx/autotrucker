import { fetchApi } from "@/core/services/api";
import type { MonthlyNet } from "./types";

export async function getMonthlyNet(month: string): Promise<MonthlyNet> {
  return fetchApi<MonthlyNet>(
    `/driver/monthly-net?month=${encodeURIComponent(month)}`,
  );
}
