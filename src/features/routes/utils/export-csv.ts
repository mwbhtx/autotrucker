import type { RouteChain } from "@/core/types";

export type RouteEngine = "v1" | "v2" | "v3";

const HEADERS = [
  "route_rank",
  "engine",
  "order_ids",
  "total_pay",
  "total_miles",
  "total_deadhead_miles",
  "deadhead_pct",
  "profit",
  "rate_per_mile",
  "effective_rpm",
  "effective_cost_per_mile",
  "gross_rpm_total",
  "gross_per_day",
  "daily_net_profit",
  "estimated_days",
  "estimated_deadhead_cost",
  "cost_total",
  "legs_summary",
  "stopoffs_json",
];

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildLegsSummary(chain: RouteChain): string {
  if (chain.legs.length === 0) return "";
  const parts = chain.legs.map((leg) => `${leg.origin_city},${leg.origin_state}`);
  const last = chain.legs[chain.legs.length - 1];
  parts.push(`${last.destination_city},${last.destination_state}`);
  return parts.join(" -> ");
}

function buildStopoffsJson(chain: RouteChain): string {
  try {
    const stopoffs = chain.legs.flatMap((leg) =>
      (leg.stopoffs ?? []).map((s) => ({
        leg_number: leg.leg_number,
        order_id: leg.order_id,
        ...s,
      }))
    );
    return JSON.stringify(stopoffs);
  } catch {
    console.warn("export-csv: failed to serialize stopoffs");
    return "[]";
  }
}

export function buildRoutesCsvFilename(engine: RouteEngine, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `routes_${engine}_${iso}.csv`;
}

export function buildRoutesCsv(routes: RouteChain[], engine: RouteEngine): string {
  const rows: string[] = [HEADERS.join(",")];
  for (const route of routes) {
    const orderIds = route.legs.map((l) => l.order_id).join(";");
    const row = [
      csvCell(route.rank),
      csvCell(engine),
      csvCell(orderIds),
      csvCell(route.total_pay),
      csvCell(route.total_miles),
      csvCell(route.total_deadhead_miles),
      csvCell(route.deadhead_pct),
      csvCell(route.profit),
      csvCell(route.rate_per_mile),
      csvCell(route.effective_rpm),
      csvCell(route.effective_cost_per_mile),
      csvCell(route.gross_rpm_total),
      csvCell(route.gross_per_day),
      csvCell(route.daily_net_profit),
      csvCell(route.estimated_days),
      csvCell(route.estimated_deadhead_cost),
      csvCell(route.cost_breakdown.total),
      csvCell(buildLegsSummary(route)),
      // stopoffs_json always contains commas — quote it explicitly
      `"${buildStopoffsJson(route).replace(/"/g, '""')}"`,
    ];
    rows.push(row.join(","));
  }
  return rows.join("\r\n");
}

export function downloadRoutesCsv(routes: RouteChain[], engine: RouteEngine): void {
  const csv = buildRoutesCsv(routes, engine);
  // BOM so Excel auto-detects UTF-8
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildRoutesCsvFilename(engine);
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
