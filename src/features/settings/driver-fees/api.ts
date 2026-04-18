import { fetchApi } from "@/core/services/api";
import type { DriverFee } from "./types";

export async function listDriverFees(): Promise<DriverFee[]> {
  return fetchApi<DriverFee[]>("/settings/driver-fees");
}

export async function createDriverFee(input: {
  name: string;
  monthly_amount: number;
}): Promise<DriverFee> {
  return fetchApi<DriverFee>("/settings/driver-fees", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDriverFee(
  id: string,
  input: Partial<{ name: string; monthly_amount: number; active: boolean }>,
): Promise<DriverFee> {
  return fetchApi<DriverFee>(`/settings/driver-fees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteDriverFee(id: string): Promise<void> {
  await fetchApi<void>(`/settings/driver-fees/${id}`, { method: "DELETE" });
}
