// src/features/alerts/api.ts
import { fetchApi } from "@/core/services/api";
import type {
  Alert,
  AlertMatchGroup,
  CreateAlertInput,
  PhoneStatusResponse,
  PhoneVerificationStartResponse,
  PhoneVerificationVerifyResponse,
  UnreadMatchCountResponse,
  UpdateAlertInput,
} from "./types";

// ── Alerts CRUD ─────────────────────────────────────────────────────────────

export async function listAlerts(): Promise<Alert[]> {
  return fetchApi<Alert[]>("/alerts");
}

export async function getAlert(id: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${encodeURIComponent(id)}`);
}

export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  return fetchApi<Alert>("/alerts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAlert(id: string, patch: UpdateAlertInput): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await fetchApi(`/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function duplicateAlert(id: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${encodeURIComponent(id)}/duplicate`, {
    method: "POST",
  });
}

// ── Matches ─────────────────────────────────────────────────────────────────

export async function listMatches(opts: {
  status?: "active" | "dismissed" | "all";
  limit?: number;
  since?: string;
} = {}): Promise<AlertMatchGroup[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit) params.set("limit", opts.limit.toString());
  if (opts.since) params.set("since", opts.since);
  const qs = params.toString();
  return fetchApi<AlertMatchGroup[]>(`/matches${qs ? `?${qs}` : ""}`);
}

export async function getUnreadCount(): Promise<UnreadMatchCountResponse> {
  return fetchApi<UnreadMatchCountResponse>("/matches/unread-count");
}

export async function dismissMatch(matchGroupId: string): Promise<void> {
  await fetchApi(`/matches/${encodeURIComponent(matchGroupId)}/dismiss`, {
    method: "POST",
  });
}

export async function markAllRead(): Promise<void> {
  await fetchApi("/matches/mark-all-read", { method: "POST" });
}

// ── Phone verification ──────────────────────────────────────────────────────

export async function getPhoneStatus(): Promise<PhoneStatusResponse> {
  return fetchApi<PhoneStatusResponse>("/settings/phone");
}

export async function startPhoneVerification(
  phoneNumber: string,
): Promise<PhoneVerificationStartResponse> {
  return fetchApi<PhoneVerificationStartResponse>("/settings/phone/start-verification", {
    method: "POST",
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
}

export async function verifyPhoneCode(
  code: string,
): Promise<PhoneVerificationVerifyResponse> {
  return fetchApi<PhoneVerificationVerifyResponse>("/settings/phone/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function resendPhoneCode(): Promise<PhoneVerificationStartResponse> {
  return fetchApi<PhoneVerificationStartResponse>("/settings/phone/resend", {
    method: "POST",
  });
}

export async function deletePhone(): Promise<void> {
  await fetchApi("/settings/phone", { method: "DELETE" });
}
