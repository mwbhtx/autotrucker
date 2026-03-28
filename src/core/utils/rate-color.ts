/**
 * Returns a Tailwind text color class for a GROSS rate per mile value
 * based on the user's cost per mile setting.
 *
 * Tiers (relative to cost per mile):
 *   Red:    below 1.3x cost  — below market, barely breaking even
 *   Yellow: 1.3x – 1.7x cost — acceptable margin
 *   Green:  above 1.7x cost  — strong margin
 *
 * With a default cost of $1.50/mi this maps roughly to:
 *   Red:    < $1.95   Yellow: $1.95–$2.55   Green: > $2.55
 */
export function rateColor(ratePerMile: number, costPerMile: number): string {
  const ratio = ratePerMile / costPerMile;
  if (ratio >= 1.7) return "text-green-500";
  if (ratio >= 1.3) return "text-yellow-500";
  return "text-red-500";
}

/**
 * Returns a Tailwind text color class for a NET (after costs) rate per mile.
 *
 * Industry averages for owner-operator net profit per mile (2026):
 *   Red:    below $0.50/mi — thin margin, at risk of loss
 *   Yellow: $0.50–$1.00/mi — decent, covers overhead with modest profit
 *   Green:  above $1.00/mi — strong profit margin
 */
export function netRateColor(netPerMile: number): string {
  if (netPerMile >= 1.0) return "text-green-500";
  if (netPerMile >= 0.5) return "text-yellow-500";
  return "text-red-500";
}

/**
 * Returns a Tailwind text color class for route profitability metrics
 * (profit, $/day, $/mi net) based on daily net profit.
 *
 * $/day is the truest measure of whether a route is worth the driver's time.
 *   Green:  >= $300/day — solid income (~$100k+/yr)
 *   Yellow: >= $150/day — break-even to okay, covering bills
 *   Red:    < $150/day  — not worth the time
 */
export function routeProfitColor(dailyNetProfit: number): string {
  if (dailyNetProfit >= 300) return "text-green-400";
  if (dailyNetProfit >= 150) return "text-yellow-500";
  return "text-red-500";
}
