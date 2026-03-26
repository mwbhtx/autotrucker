import type { Order, RouteChain, LocationGroup } from "./types";

/** Group orders by origin city/state into LocationGroups */
export function groupOrdersByLocation(orders: Order[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const order of orders) {
    if (order.origin_lat == null || order.origin_lng == null || order.order_status === "closed") continue;
    const key = `${order.origin_city}|${order.origin_state}`;
    let group = map.get(key);
    if (!group) {
      group = {
        city: order.origin_city,
        state: order.origin_state,
        lat: order.origin_lat,
        lng: order.origin_lng,
        orders: [],
        routeChains: [],
        roundTripChains: [],
      };
      map.set(key, group);
    }
    group.orders.push(order);
  }

  return Array.from(map.values());
}

/** Group route chains by first leg's origin city/state into LocationGroups */
export function groupRoutesByLocation(routes: RouteChain[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const route of routes) {
    if (route.legs.length === 0) continue;
    const leg = route.legs[0];
    const key = `${leg.origin_city}|${leg.origin_state}`;
    let group = map.get(key);
    if (!group) {
      group = {
        city: leg.origin_city,
        state: leg.origin_state,
        lat: leg.origin_lat,
        lng: leg.origin_lng,
        orders: [],
        routeChains: [],
        roundTripChains: [],
      };
      map.set(key, group);
    }
    group.routeChains.push(route);
  }

  return Array.from(map.values());
}
