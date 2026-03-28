"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { cleanupRouteLayers, type DrawableRouteLeg } from "@/lib/map/draw-route";
import { LEG_COLORS, DEADHEAD_COLOR } from "@/lib/route-colors";

/** Minimal selected route — works with both RouteChain and RoundTripChain */
type SelectedRoute = { legs: DrawableRouteLeg[] };

interface RouteMapProps {
  selectedRoute?: SelectedRoute | null;
  /** User's selected origin for drawing start/return deadhead */
  originCoords?: { lat: number; lng: number } | null;
  /** User's selected destination (one-way) for drawing end deadhead */
  destCoords?: { lat: number; lng: number } | null;
  /** Trip mode — determines which point the return deadhead targets */
  tripMode?: "one-way" | "round-trip";
  /** Callback ref for imperative leg hover highlighting */
  onHoverLegRef?: React.MutableRefObject<((legIndex: number | null) => void) | null>;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Cache Mapbox Directions responses to avoid re-fetching when scrolling between cards
const directionsCache = new Map<string, [number, number][]>();

export function RouteMap({
  selectedRoute,
  originCoords,
  destCoords,
  tripMode = "round-trip",
  onHoverLegRef,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const legCountRef = useRef(0);

  // Initialize map (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const isMobile = window.innerWidth < 768;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95.7, 37.1],
      zoom: 4,
      attributionControl: !isMobile,
    });

    mapRef.current = map;

    // Hide non-US labels
    map.on("style.load", () => {
      const style = map.getStyle();
      if (!style?.layers) return;
      for (const layer of style.layers) {
        if (layer.type !== "symbol") continue;
        const id = layer.id;
        // Hide continent labels entirely
        if (id.includes("continent")) {
          map.setLayoutProperty(id, "visibility", "none");
          continue;
        }
        // Hide country labels entirely
        if (id.includes("country")) {
          map.setLayoutProperty(id, "visibility", "none");
          continue;
        }
        // For place/state/city labels, filter to US only
        if (id.includes("place") || id.includes("state") || id.includes("settlement")) {
          const existing = map.getFilter(id);
          map.setFilter(id, [
            "all",
            ...(existing ? [existing] : []),
            ["any",
              ["!", ["has", "iso_3166_1"]],
              ["==", ["get", "iso_3166_1"], "US"],
            ],
          ]);
        }
        // Dim all text labels so they don't compete with route lines
        map.setPaintProperty(id, "text-color", "rgba(255,255,255,0.4)");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw selected route on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    const draw = async () => {
      // Clean up ALL previous route layers
      cleanupRouteLayers(map);

      const route = selectedRoute;

      let legs: { origin: [number, number]; dest: [number, number] }[] = [];

      if (route && route.legs.length > 0) {
        legs = route.legs.map((leg) => ({
          origin: [leg.origin_lng, leg.origin_lat] as [number, number],
          dest: [leg.destination_lng, leg.destination_lat] as [number, number],
        }));
      }

      if (legs.length === 0) { legCountRef.current = 0; return; }
      legCountRef.current = legs.length;

      // Draw straight lines immediately for instant feedback
      for (let i = 0; i < legs.length; i++) {
        const legId = `route-leg-${i}`;
        map.addSource(legId, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: [legs[i].origin, legs[i].dest] }, properties: {} },
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

      // Draw ALL deadhead segments as dashed lines
      const deadheadSegments: { id: string; coords: [number, number][] }[] = [];

      // Start deadhead: origin → first pickup
      if (originCoords && route && route.legs.length > 0) {
        const first = route.legs[0];
        const originPt: [number, number] = [originCoords.lng, originCoords.lat];
        const pickupPt: [number, number] = [first.origin_lng, first.origin_lat];
        if (originPt[0] !== pickupPt[0] || originPt[1] !== pickupPt[1]) {
          deadheadSegments.push({ id: "route-dh-start", coords: [originPt, pickupPt] });
        }
      }

      // Between-leg deadhead
      if (route && route.legs.length > 1) {
        for (let i = 1; i < route.legs.length; i++) {
          const prev = route.legs[i - 1];
          const curr = route.legs[i];
          deadheadSegments.push({
            id: `route-deadhead-${i}`,
            coords: [
              [prev.destination_lng, prev.destination_lat],
              [curr.origin_lng, curr.origin_lat],
            ],
          });
        }
      }

      // Return deadhead: last dropoff → origin (round-trip) or → destination (one-way)
      // Skip return deadhead for one-way with no destination — there's nowhere to return to
      const returnTarget = tripMode === "one-way" ? destCoords : (originCoords ?? destCoords);
      if (returnTarget && route) {
        const lastLegData = route.legs[route.legs.length - 1];
        const dropoffPt: [number, number] = [lastLegData.destination_lng, lastLegData.destination_lat];
        const returnPt: [number, number] = [returnTarget.lng, returnTarget.lat];
        if (dropoffPt[0] !== returnPt[0] || dropoffPt[1] !== returnPt[1]) {
          deadheadSegments.push({ id: "route-dh-return", coords: [dropoffPt, returnPt] });
        }
      }

      // Draw all deadhead segments
      for (const seg of deadheadSegments) {
        map.addSource(seg.id, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: seg.coords }, properties: {} },
        });
        map.addLayer({
          id: seg.id,
          type: "line",
          source: seg.id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": DEADHEAD_COLOR, "line-width": 2, "line-dasharray": [6, 4] },
        });
      }

      // Start and finish markers only
      const firstLeg = legs[0];
      const lastLeg = legs[legs.length - 1];
      const endpoints: GeoJSON.Feature[] = [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: firstLeg.origin },
          properties: { type: "pickup" },
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: lastLeg.dest },
          properties: { type: "finish" },
        },
      ];

      map.addSource("route-endpoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: endpoints },
      });

      // Pickup dot (green)
      map.addLayer({
        id: "route-endpoints",
        type: "circle",
        source: "route-endpoints",
        filter: ["==", ["get", "type"], "pickup"],
        paint: {
          "circle-radius": 8,
          "circle-color": "#22c55e",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // Checkered flag for finish
      if (!map.hasImage("checkered-flag")) {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        const sq = 4;
        for (let y = 0; y < size; y += sq) {
          for (let x = 0; x < size; x += sq) {
            ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? "#000000" : "#ffffff";
            ctx.fillRect(x, y, sq, sq);
          }
        }
        ctx.restore();
        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage("checkered-flag", { width: size, height: size, data: new Uint8Array(imageData.data.buffer) });
      }

      map.addLayer({
        id: "route-endpoints-flag",
        type: "symbol",
        source: "route-endpoints",
        filter: ["==", ["get", "type"], "finish"],
        layout: {
          "icon-image": "checkered-flag",
          "icon-size": 1,
          "icon-allow-overlap": true,
        },
      });

      // Fit bounds to route (include deadhead segments)
      const bounds = new mapboxgl.LngLatBounds();
      for (const leg of legs) {
        bounds.extend(leg.origin);
        bounds.extend(leg.dest);
      }
      for (const seg of deadheadSegments) {
        for (const coord of seg.coords) bounds.extend(coord);
      }
      const mobile = window.innerWidth < 768;

      if (!mobile) {
        // Desktop: expand bounds slightly so the route doesn't hug the edges
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const latPad = (ne.lat - sw.lat) * 0.25;
        const lngPad = (ne.lng - sw.lng) * 0.25;
        bounds.extend([sw.lng - lngPad, sw.lat - latPad]);
        bounds.extend([ne.lng + lngPad, ne.lat + latPad]);
      }

      // Mobile: fit route into visible map area (above cards at 40vh)
      const vh = mobile ? window.innerHeight : 0;
      const mobileBotPad = mobile ? Math.round(vh * 0.60) : 50;
      map.fitBounds(bounds, {
        padding: mobile
          ? { top: 80, bottom: mobileBotPad, left: 30, right: 30 }
          : { top: 60, bottom: 50, left: 700, right: 50 },
        maxZoom: 10,
        duration: 500,
      });

      // Upgrade all lines (loaded + deadhead) to road geometries in background
      const allSegments = [
        ...legs.map((leg, i) => ({ id: `route-leg-${i}`, coords: [leg.origin, leg.dest] as [number, number][] })),
        ...deadheadSegments,
      ];
      Promise.all(
        allSegments.map(async (seg) => {
          const [a, b] = [seg.coords[0], seg.coords[seg.coords.length - 1]];
          const key = `${a[0]},${a[1]};${b[0]},${b[1]}`;
          if (directionsCache.has(key)) return { id: seg.id, coords: directionsCache.get(key)! };
          try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${key}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
            const res = await fetch(url);
            const data = await res.json();
            const coords: [number, number][] = data.routes?.[0]?.geometry?.coordinates ?? [a, b];
            directionsCache.set(key, coords);
            return { id: seg.id, coords };
          } catch {
            return { id: seg.id, coords: [a, b] as [number, number][] };
          }
        }),
      ).then((results) => {
        if (cancelled) return;
        for (const { id, coords } of results) {
          const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
          if (source) {
            source.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
          }
        }
      });
    };

    let timerId: ReturnType<typeof setTimeout>;
    const tryDraw = () => {
      if (map.isStyleLoaded()) {
        draw();
      } else {
        timerId = setTimeout(tryDraw, 100);
      }
    };
    tryDraw();
    return () => { cancelled = true; clearTimeout(timerId); };
  }, [selectedRoute, originCoords, destCoords, tripMode]);

  // Expose imperative hover handler — bypasses React render cycle for instant feedback
  const handleHoverLeg = useCallback((legIndex: number | null) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const count = legCountRef.current;
    for (let i = 0; i < count; i++) {
      const layerId = `route-leg-${i}`;
      if (!map.getLayer(layerId)) continue;
      if (legIndex === null) {
        map.setPaintProperty(layerId, "line-opacity", 1);
        map.setPaintProperty(layerId, "line-width", 3);
      } else if (i === legIndex) {
        map.setPaintProperty(layerId, "line-opacity", 1);
        map.setPaintProperty(layerId, "line-width", 5);
      } else {
        map.setPaintProperty(layerId, "line-opacity", 0.2);
        map.setPaintProperty(layerId, "line-width", 3);
      }
    }
  }, []);

  useEffect(() => {
    if (onHoverLegRef) onHoverLegRef.current = handleHoverLeg;
    return () => { if (onHoverLegRef) onHoverLegRef.current = null; };
  }, [onHoverLegRef, handleHoverLeg]);

  return (
    <div ref={containerRef} className="h-full w-full" />
  );
}
