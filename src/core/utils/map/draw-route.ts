import { LEG_COLORS } from "@/lib/route-colors";

/** Minimal leg shape — satisfied by both RouteLeg and RoundTripLeg */
export interface DrawableRouteLeg {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
}

/** Minimal map interface for route drawing — matches the mapbox-gl methods we use */
export interface MapLike {
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
  getSource(id: string): unknown;
  removeSource(id: string): void;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
  hasImage(id: string): boolean;
  addImage(id: string, image: unknown): void;
  fitBounds(bounds: unknown, options?: unknown): void;
  getZoom(): number;
  isStyleLoaded(): boolean;
}

export interface RouteChainLike {
  legs: DrawableRouteLeg[];
}

export interface FetchDirections {
  (origin: [number, number], dest: [number, number]): Promise<[number, number][]>;
}

/** Clean up all route-related layers and sources from the map */
export function cleanupRouteLayers(map: MapLike) {
  ["route-line", "route-deadhead", "route-dh-start", "route-dh-return",
   "route-endpoints-flag", "route-endpoints",
   "order-route", "order-endpoints-flag", "order-endpoints"].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
  for (let i = 0; i < 10; i++) {
    [`route-leg-${i}`, `route-deadhead-${i}`].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
  }
}

/**
 * Generate a great-circle arc between two points.
 * Returns an array of [lng, lat] coordinates for smooth rendering.
 */
function greatCircleArc(
  origin: [number, number],
  dest: [number, number],
  segments = 50,
): [number, number][] {
  const [lng1, lat1] = origin;
  const [lng2, lat2] = dest;
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const lam1 = lng1 * toRad;
  const lam2 = lng2 * toRad;

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((phi2 - phi1) / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin((lam2 - lam1) / 2) ** 2,
    ),
  );

  // For very short distances, just use a straight line
  if (d < 0.001) return [origin, dest];

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
    const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);
    points.push([Math.atan2(y, x) * toDeg, Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg]);
  }
  return points;
}

/** Update a GeoJSON source's data in-place */
function updateSourceCoords(map: MapLike, sourceId: string, coords: [number, number][]) {
  const source = map.getSource(sourceId);
  if (source && typeof (source as any).setData === "function") {
    (source as any).setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    });
  }
}

/**
 * Draw a route chain on the map.
 *
 * Phase 1: Instantly draw great-circle arcs between leg endpoints.
 * Phase 2: Fetch real road geometries in parallel, swap in as they resolve.
 *
 * Returns early without drawing if `isCancelled()` returns true.
 */
export async function drawRouteChain(
  map: MapLike,
  route: RouteChainLike,
  fetchDirections: FetchDirections,
  isCancelled: () => boolean,
): Promise<void> {
  cleanupRouteLayers(map);

  // Phase 1: Draw arcs immediately
  for (let i = 0; i < route.legs.length; i++) {
    const leg = route.legs[i];
    const origin: [number, number] = [leg.origin_lng, leg.origin_lat];
    const dest: [number, number] = [leg.destination_lng, leg.destination_lat];
    const arcCoords = greatCircleArc(origin, dest);

    const legId = `route-leg-${i}`;
    map.addSource(legId, {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: arcCoords }, properties: {} },
    });
    map.addLayer({
      id: legId,
      type: "line",
      source: legId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": LEG_COLORS[i % LEG_COLORS.length],
        "line-width": 3,
      },
    });
  }

  // Draw deadhead segments between legs (straight lines, no arc needed)
  for (let i = 1; i < route.legs.length; i++) {
    const prev = route.legs[i - 1];
    const curr = route.legs[i];
    const dhId = `route-deadhead-${i}`;
    map.addSource(dhId, {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[prev.destination_lng, prev.destination_lat], [curr.origin_lng, curr.origin_lat]] },
        properties: {},
      },
    });
    map.addLayer({
      id: dhId,
      type: "line",
      source: dhId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#6b7280", "line-width": 2, "line-dasharray": [4, 4] },
    });
  }

  // Phase 2: Fetch real road geometries in parallel, swap in as they resolve
  const fetches = route.legs.map(async (leg, i) => {
    const origin: [number, number] = [leg.origin_lng, leg.origin_lat];
    const dest: [number, number] = [leg.destination_lng, leg.destination_lat];
    try {
      const coords = await fetchDirections(origin, dest);
      if (isCancelled()) return;
      updateSourceCoords(map, `route-leg-${i}`, coords);
    } catch {
      // Keep the arc — road geometry unavailable
    }
  });

  await Promise.all(fetches);
}
