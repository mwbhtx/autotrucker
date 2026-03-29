import type { RouteChain, RoundTripChain } from "@/core/types";

// ── Chain accessors ─────────────────────────────────────────────────────────

export function getOriginCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[0]?.origin_city ?? "Unknown";
}

export function getDestCity(chain: RouteChain | RoundTripChain): string {
  return chain.legs[chain.legs.length - 1]?.destination_city ?? "Unknown";
}

export function getDailyProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("daily_net_profit" in chain && typeof chain.daily_net_profit === "number") {
    return chain.daily_net_profit;
  }
  return null;
}

export function getNetProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("firm_profit" in chain && typeof chain.firm_profit === "number") return chain.firm_profit;
  if ("profit" in chain && typeof chain.profit === "number") return chain.profit;
  return null;
}

export function getNetPerMile(chain: RouteChain | RoundTripChain): number | null {
  if ("effective_rpm" in chain && typeof chain.effective_rpm === "number") return chain.effective_rpm;
  return null;
}

export function getDeadheadPct(chain: RouteChain | RoundTripChain): number {
  return chain.deadhead_pct ?? 0;
}

// ── Formatters ──────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDateRange(early?: string, late?: string): string {
  if (!early) return "";
  const e = formatDateTime(early);
  if (!late || late === early) return e;
  const l = formatDateTime(late);
  return `${e} – ${l}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatRpm(rpm: number): string {
  return `$${rpm.toFixed(2)}/mi`;
}
