"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DiscoveredOrder } from "@mwbhtx/haulvisor-core";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import {
  drawDiscoveredRoute,
  clearDiscoveredRoute,
  type DrawnRefs,
} from "@/core/utils/map/draw-discovered-route";

const PROTOMAPS_API_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY ?? "";

/** Construct the Protomaps vector tile style — mirrors route-map.tsx exactly. */
function protomapsStyle(theme: "light" | "dark"): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs:
      "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        tiles: [
          `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${PROTOMAPS_API_KEY}`,
        ],
        maxzoom: 15,
        attribution:
          '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layersWithCustomTheme(
      "protomaps",
      theme === "light" ? MOONLIGHT_THEME : DARK_THEME,
      "en",
    ),
  };
}

interface Props {
  orders: DiscoveredOrder[];
  /** Optional: notified when the pointer enters/leaves a segment by order index. */
  onHoverOrder?: (i: number | null) => void;
  /** Optional: notified when a segment is clicked by order index. */
  onClickOrder?: (i: number) => void;
  /** Optional: notified when an anchor marker is clicked by anchor index. */
  onClickAnchor?: (i: number) => void;
}

/**
 * 200px-tall MapLibre + Protomaps thumbnail showing a discovered route as
 * straight-line segments between region anchors.
 *
 * The map initialises once; when `orders` changes the overlay is cleared and
 * redrawn. Theme switches are handled by swapping the Protomaps style and
 * triggering a redraw via styleVersion.
 */
export function DiscoveredRouteMap({
  orders,
  onHoverOrder: _onHoverOrder,
  onClickOrder: _onClickOrder,
  onClickAnchor: _onClickAnchor,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawnRefsRef = useRef<DrawnRefs | null>(null);
  const { resolvedTheme } = useTheme();

  // Incremented after a style swap so the draw effect re-runs.
  const [styleVersion, setStyleVersion] = useState(0);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isDarkInit =
      document.documentElement.classList.contains("dark");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: protomapsStyle(isDarkInit ? "dark" : "light"),
      center: [-95.7, 37.1],
      zoom: 4,
      attributionControl: false,
      // Disable interaction controls for a non-interactive thumbnail.
      // Remove these lines if you want the map to be pannable/zoomable.
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      dragPan: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
    });

    mapRef.current = map;

    // Keep the canvas in sync with container size on layout reflows
    // (sidebar collapse, parent grid changes, client-side route swap).
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap map style when theme changes, then signal redraw via styleVersion.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const theme = resolvedTheme === "light" ? "light" : "dark";
    const onStyleLoad = () => setStyleVersion((v) => v + 1);
    map.once("style.load", onStyleLoad);
    map.setStyle(protomapsStyle(theme));

    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [resolvedTheme]);

  // Redraw route overlay when orders or style changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      // Clear previous overlay before redrawing.
      if (drawnRefsRef.current) {
        clearDiscoveredRoute(map, drawnRefsRef.current);
        drawnRefsRef.current = null;
      }
      drawnRefsRef.current = drawDiscoveredRoute(map, orders);
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once("load", draw);
      return () => {
        map.off("load", draw);
      };
    }
  }, [orders, styleVersion]);

  return (
    <div
      ref={containerRef}
      style={{ height: 200, width: "100%", borderRadius: 8, overflow: "hidden" }}
      role="region"
      aria-label="Route map showing region anchors and segment connections"
    />
  );
}
