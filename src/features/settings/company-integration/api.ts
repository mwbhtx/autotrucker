import { fetchApi } from "@/core/services/api";
import type { CompanyIntegrationStatus } from "./types";

export async function getCompanyIntegration(): Promise<CompanyIntegrationStatus> {
  return fetchApi<CompanyIntegrationStatus>("/settings/company-integration");
}

export async function setCompanyIntegration(input: {
  company_username: string;
  company_password: string;
}): Promise<CompanyIntegrationStatus> {
  return fetchApi<CompanyIntegrationStatus>("/settings/company-integration", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function clearCompanyIntegration(): Promise<void> {
  await fetchApi<void>("/settings/company-integration", { method: "DELETE" });
}
