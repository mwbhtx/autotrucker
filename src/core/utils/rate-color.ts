import {
  GROSS_RATE_GREEN_MULTIPLIER,
  NET_RATE_GREEN,
  profitThresholds,
} from "@mwbhtx/haulvisor-core";

/**
 * Returns a Tailwind text color class for a GROSS rate per mile value
 * based on the user's cost per mile setting.
 */
export function rateColor(ratePerMile: number, costPerMile: number): string {
  if (!costPerMile) return "text-negative";
  const ratio = ratePerMile / costPerMile;
  if (ratio >= GROSS_RATE_GREEN_MULTIPLIER) return "text-positive";
  return "text-negative";
}

/**
 * Returns a Tailwind text color class for a NET (after costs) rate per mile.
 */
export function netRateColor(netPerMile: number): string {
  if (netPerMile >= NET_RATE_GREEN) return "text-positive";
  return "text-negative";
}

/**
 * Returns a Tailwind text color class for route profitability metrics
 * based on daily net profit. Thresholds from design tokens.
 */
export function routeProfitColor(dailyNetProfit: number): string {
  if (dailyNetProfit >= profitThresholds.good) return "text-positive";
  return "text-negative";
}
