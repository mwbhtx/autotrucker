import maplibregl from "maplibre-gl";
import type { DiscoveredOrder } from "@mwbhtx/haulvisor-core";
import { LEG_COLORS } from "@/core/utils/route-colors";

const SOURCE_PREFIX = "discovered-route";
const MARKER_CLASS = "discovered-route-marker";

export interface DrawnRefs {
  markers: maplibregl.Marker[];
  sourceIds: string[];
  layerIds: string[];
}

/**
 * Draw straight-line segments between region anchors for a discovered route.
 * One segment per order (origin_anchor → destination_anchor) plus a closing
 * segment (last destination → first origin) to make the loop visually obvious.
 * Each segment is color-coded via LEG_COLORS.
 *
 * Returns refs needed for cleanup via clearDiscoveredRoute.
 */
export function drawDiscoveredRoute(
  map: maplibregl.Map,
  orders: DiscoveredOrder[],
): DrawnRefs {
  const markers: maplibregl.Marker[] = [];
  const sourceIds: string[] = [];
  const layerIds: string[] = [];

  if (orders.length === 0) {
    return { markers, sourceIds, layerIds };
  }

  // Build a deduplicated anchor list.
  // Origins of every order + destination of the last order (loop closes back
  // to the first order's origin, so we don't need to add it again).
  const anchorList: { lat: number; lng: number; label: string }[] = [];
  const seen = new Set<string>();

  const pushAnchor = (
    lat: number,
    lng: number,
    city: string | null,
    state: string | null,
  ) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    anchorList.push({
      lat,
      lng,
      label: `${city ?? "?"}, ${state ?? "?"}`,
    });
  };

  for (const o of orders) {
    pushAnchor(
      o.origin_anchor.lat,
      o.origin_anchor.lng,
      o.origin_anchor.display_city,
      o.origin_anchor.display_state,
    );
  }

  const last = orders[orders.length - 1];
  pushAnchor(
    last.destination_anchor.lat,
    last.destination_anchor.lng,
    last.destination_anchor.display_city,
    last.destination_anchor.display_state,
  );

  // Anchor markers
  for (const anchor of anchorList) {
    const el = document.createElement("div");
    el.className = MARKER_CLASS;
    el.style.cssText =
      "width:14px;height:14px;border-radius:50%;background:#1f2937;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:default;";
    el.title = anchor.label;
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([anchor.lng, anchor.lat])
      .addTo(map);
    markers.push(marker);
  }

  // Build loaded leg segments: one per order
  interface Leg {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    colorIdx: number;
  }

  const legs: Leg[] = [];

  for (let i = 0; i < orders.length; i++) {
    legs.push({
      from: {
        lat: orders[i].origin_anchor.lat,
        lng: orders[i].origin_anchor.lng,
      },
      to: {
        lat: orders[i].destination_anchor.lat,
        lng: orders[i].destination_anchor.lng,
      },
      colorIdx: i,
    });
  }

  // Closing segment: last destination → first origin
  legs.push({
    from: {
      lat: last.destination_anchor.lat,
      lng: last.destination_anchor.lng,
    },
    to: {
      lat: orders[0].origin_anchor.lat,
      lng: orders[0].origin_anchor.lng,
    },
    colorIdx: orders.length,
  });

  // Inter-order deadhead connectors (dashed): destination[i] → origin[i+1].
  // These "stitch" the loaded legs into a visible closed circuit. Without them,
  // the loaded legs float disconnected and appear to cross each other.
  interface Deadhead {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
  }
  const deadheads: Deadhead[] = [];
  for (let i = 0; i < orders.length - 1; i++) {
    const from = orders[i].destination_anchor;
    const to = orders[i + 1].origin_anchor;
    // Skip if both anchors are at the same grid cell (zero-deadhead leg).
    if (Math.abs(from.lat - to.lat) < 0.01 && Math.abs(from.lng - to.lng) < 0.01) continue;
    deadheads.push({
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
    });
  }

  // Draw dashed deadhead connectors first (under loaded legs)
  for (let i = 0; i < deadheads.length; i++) {
    const dh = deadheads[i];
    const sourceId = `${SOURCE_PREFIX}-dh-source-${i}`;
    const layerId = `${SOURCE_PREFIX}-dh-layer-${i}`;

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [dh.from.lng, dh.from.lat],
            [dh.to.lng, dh.to.lat],
          ],
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#94a3b8",
        "line-width": 2,
        "line-opacity": 0.5,
        "line-dasharray": [3, 3],
      },
    });

    sourceIds.push(sourceId);
    layerIds.push(layerId);
  }

  // Add sources and layers for each loaded leg (drawn on top of deadheads)
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const sourceId = `${SOURCE_PREFIX}-source-${i}`;
    const layerId = `${SOURCE_PREFIX}-layer-${i}`;

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [leg.from.lng, leg.from.lat],
            [leg.to.lng, leg.to.lat],
          ],
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": LEG_COLORS[leg.colorIdx % LEG_COLORS.length],
        "line-width": 3,
        "line-opacity": 0.9,
      },
    });

    sourceIds.push(sourceId);
    layerIds.push(layerId);
  }

  // Fit map to show all anchors
  const bounds = new maplibregl.LngLatBounds();
  for (const anchor of anchorList) {
    bounds.extend([anchor.lng, anchor.lat]);
  }
  map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 10 });

  return { markers, sourceIds, layerIds };
}

/**
 * Remove all markers, layers, and sources added by drawDiscoveredRoute.
 */
export function clearDiscoveredRoute(
  map: maplibregl.Map,
  refs: DrawnRefs,
): void {
  for (const marker of refs.markers) {
    marker.remove();
  }
  for (const id of refs.layerIds) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of refs.sourceIds) {
    if (map.getSource(id)) map.removeSource(id);
  }
}
