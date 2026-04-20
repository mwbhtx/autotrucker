import type { RouteChain } from "@/core/types";

// ── Chain accessors ─────────────────────────────────────────────────────────

export function getOriginCity(chain: RouteChain): string {
  return chain.legs[0]?.origin_city ?? "Unknown";
}

export function getDestCity(chain: RouteChain): string {
  return chain.legs[chain.legs.length - 1]?.destination_city ?? "Unknown";
}

export function getDailyProfit(chain: RouteChain): number | null {
  if ("daily_net_profit" in chain && typeof chain.daily_net_profit === "number") {
    return chain.daily_net_profit;
  }
  return null;
}

export function getNetProfit(chain: RouteChain): number | null {
  if ("profit" in chain && typeof chain.profit === "number") return chain.profit;
  return null;
}

export function getDeadheadPerMile(chain: RouteChain): number | null {
  if ("gross_rpm_total" in chain && typeof chain.gross_rpm_total === "number") return chain.gross_rpm_total;
  return null;
}

/** Get unique state abbreviations for the route path, e.g. "TX → LA" or "TX → CO → TX" */
export function getRouteStates(chain: RouteChain): string {
  const states: string[] = [];
  for (const leg of chain.legs) {
    const os = leg.origin_state;
    const ds = leg.destination_state;
    if (os && (states.length === 0 || states[states.length - 1] !== os)) states.push(os);
    if (ds && states[states.length - 1] !== ds) states.push(ds);
  }
  // Deduplicate consecutive same states but keep the path order
  return states.join(" → ");
}

export function getDeadheadPct(chain: RouteChain): number {
  return chain.deadhead_pct ?? 0;
}

export function getEstimatedDays(chain: RouteChain): number | null {
  if ("estimated_days" in chain && typeof chain.estimated_days === "number") return chain.estimated_days;
  return null;
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
