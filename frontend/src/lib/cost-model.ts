/**
 * Route Cost Model (frontend)
 *
 * Mirrors the backend cost-model.ts for client-side profit estimation.
 */

/**
 * Quick net profit estimate using flat cost per mile.
 * Charges costPerMile on ALL miles (loaded + deadhead).
 */
export function quickNetProfit(
  grossPay: number,
  loadedMiles: number,
  deadheadMiles: number,
  costPerMile: number = 1.5,
): number {
  return Math.round((grossPay - (loadedMiles + deadheadMiles) * costPerMile) * 100) / 100;
}

/**
 * Haversine distance in miles between two lat/lng points.
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate net profit for a single order given origin/destination filters.
 * Returns null when no filters are active (can't estimate deadhead).
 */
export function estimateOrderProfit(
  order: { pay: number; miles: number; origin_lat?: number; origin_lng?: number; destination_lat?: number; destination_lng?: number },
  originFilter: { lat: number; lng: number } | null,
  destFilter: { lat: number; lng: number } | null,
  costPerMile: number = 1.5,
): number | null {
  let deadhead = 0;
  if (originFilter && order.origin_lat != null && order.origin_lng != null) {
    deadhead += haversine(originFilter.lat, originFilter.lng, order.origin_lat, order.origin_lng);
  }
  if (destFilter && order.destination_lat != null && order.destination_lng != null) {
    deadhead += haversine(destFilter.lat, destFilter.lng, order.destination_lat, order.destination_lng);
  }
  if (deadhead === 0 && !originFilter && !destFilter) return null;
  return quickNetProfit(order.pay, order.miles, deadhead, costPerMile);
}
