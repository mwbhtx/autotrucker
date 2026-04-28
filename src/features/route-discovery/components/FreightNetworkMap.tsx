"use client";

// v1 note: reverse lane arcs (weak/none) use faint solid ArcLayer, not dashed.
// Dashed rendering via PathStyleExtension is deferred to v2.

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import { arcWidth, arcOpacity, bearing } from "../utils/freight-network";
import { ZoneTooltip } from "./ZoneTooltip";

const PROTOMAPS_API_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY ?? "";

const NODE_COLOR: Record<FreightZoneSummary['optionality_bucket'], [number, number, number]> = {
  high:     [34,  197,  94],   // #22c55e
  medium:   [245, 158,  11],   // #f59e0b
  low:      [244,  63,  94],   // #f43f5e
  low_data: [ 71,  85, 105],   // #475569
};

function protomapsStyle(theme: "light" | "dark"): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        tiles: [`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${PROTOMAPS_API_KEY}`],
        maxzoom: 15,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layersWithCustomTheme("protomaps", theme === "light" ? MOONLIGHT_THEME : DARK_THEME, "en"),
  };
}

interface ArcTooltipData {
  lane: FreightLaneEntry;
  x: number;
  y: number;
}

interface Props {
  data: FreightNetworkMapResponse;
  period: '30d' | '60d' | '90d';
}

export function FreightNetworkMap({ data, period }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const { resolvedTheme } = useTheme();

  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<FreightZoneSummary | null>(null);
  const [arcTooltip, setArcTooltip] = useState<ArcTooltipData | null>(null);

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;

  const handleCloseZonePanel = useCallback(() => setSelectedZoneKey(null), []);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const isDark = document.documentElement.classList.contains("dark");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: protomapsStyle(isDark ? "dark" : "light"),
      center: [-95, 38],
      zoom: 3.5,
      attributionControl: false,
    });

    // Cast required: @deck.gl/mapbox implements IControl at runtime but TS types diverge.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Swap Protomaps style on theme change.
  // MapboxOverlay is a map control and survives style reloads.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(protomapsStyle(resolvedTheme === "dark" ? "dark" : "light"));
  }, [resolvedTheme]);

  // Clear stale hover state when the dataset changes (e.g. user switches period).
  useEffect(() => {
    setHoveredZone(null);
    setArcTooltip(null);
  }, [data]);

  // Update deck.gl layers when data or interaction state changes
  useEffect(() => {
    if (!overlayRef.current) return;

    const { lanes, zones } = data;
    const allCounts = lanes.map((l) => l.load_count);
    const allRates = lanes.map((l) => l.loads_per_day);

    // Zones connected to the selected zone (for dimming unconnected items)
    const connectedZoneKeys = selectedZoneKey
      ? new Set(
          lanes
            .filter((l) => l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey)
            .flatMap((l) => [l.origin_zone_key, l.destination_zone_key]),
        )
      : null;

    const laneAlpha = (l: FreightLaneEntry) => {
      const base = arcOpacity(l.loads_per_day, allRates);
      if (!connectedZoneKeys) return base;
      return connectedZoneKeys.has(l.origin_zone_key) || connectedZoneKeys.has(l.destination_zone_key)
        ? base
        : 0.05;
    };

    const zoneAlpha = (z: FreightZoneSummary) => {
      if (!connectedZoneKeys) return 0.85;
      return connectedZoneKeys.has(z.zone_key) ? 1 : 0.15;
    };

    const mainArcLayer = new ArcLayer<FreightLaneEntry>({
      id: 'main-arcs',
      data: lanes,
      getSourcePosition: (l) => [l.origin_centroid_lng, l.origin_centroid_lat],
      getTargetPosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getSourceColor: (l) => [59, 130, 246, Math.round(laneAlpha(l) * 255)],   // blue-500
      getTargetColor: (l) => [139, 92, 246, Math.round(laneAlpha(l) * 255)],   // violet-500
      getWidth: (l) => arcWidth(l.load_count, allCounts),
      pickable: true,
      onHover: ({ object, x, y }) => {
        setArcTooltip(object ? { lane: object, x, y } : null);
      },
    });

    const weakRevLanes = lanes.filter((l) => l.reverse_strength === 'weak');
    const weakArcLayer = new ArcLayer<FreightLaneEntry>({
      id: 'weak-reverse-arcs',
      data: weakRevLanes,
      getSourcePosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getTargetPosition: (l) => [l.origin_centroid_lng, l.origin_centroid_lat],
      getSourceColor: (l) => [148, 163, 184, Math.round(laneAlpha(l) * 0.20 * 255)],
      getTargetColor: (l) => [148, 163, 184, Math.round(laneAlpha(l) * 0.20 * 255)],
      getWidth: 1,
      pickable: false,
    });

    const ghostLanes = (() => {
      const fromSelected = selectedZoneKey
        ? lanes.filter(
            (l) =>
              l.reverse_strength === 'none' &&
              (l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey),
          )
        : [];
      const fromHover = arcTooltip?.lane.reverse_strength === 'none' ? [arcTooltip.lane] : [];
      const seen = new Set<string>();
      return [...fromSelected, ...fromHover].filter((l) => {
        const k = `${l.origin_zone_key}:${l.destination_zone_key}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    })();
    const ghostArcLayer = new ArcLayer<FreightLaneEntry>({
      id: 'ghost-reverse-arcs',
      data: ghostLanes,
      getSourcePosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getTargetPosition: (l) => [l.origin_centroid_lng, l.origin_centroid_lat],
      getSourceColor: [148, 163, 184, Math.round(0.08 * 255)],
      getTargetColor: [148, 163, 184, Math.round(0.08 * 255)],
      getWidth: 1,
      pickable: false,
    });

    const arrowLayer = new TextLayer<FreightLaneEntry>({
      id: 'arrowheads',
      data: lanes,
      getPosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getText: () => '▶',
      getAngle: (l) =>
        90 - bearing(l.origin_centroid_lat, l.origin_centroid_lng, l.destination_centroid_lat, l.destination_centroid_lng),
      getSize: 12,
      getColor: (l) => [99, 102, 241, Math.round(laneAlpha(l) * 180)],
      sizeUnits: 'pixels',
      pickable: false,
    });

    const nodeLayer = new ScatterplotLayer<FreightZoneSummary>({
      id: 'zone-nodes',
      data: zones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      getRadius: (z) => Math.max(30_000, Math.sqrt(z.outbound_load_count) * 8_000),
      getFillColor: (z) => {
        const [r, g, b] = NODE_COLOR[z.optionality_bucket];
        return [r, g, b, Math.round(zoneAlpha(z) * 200)];
      },
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          setSelectedZoneKey(object.zone_key);
          setHoveredZone(null);
          setArcTooltip(null);
        }
      },
      onHover: ({ object }) => {
        if (!selectedZoneKey) setHoveredZone(object ?? null);
      },
    });

    const labelZones = zones.filter((z) => z.outbound_load_count >= data.metadata.min_zone_outbound_loads);
    const labelLayer = new TextLayer<FreightZoneSummary>({
      id: 'zone-labels',
      data: labelZones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      getText: (z) => `${z.display_city}, ${z.display_state}`,
      getSize: 11,
      getColor: (z) => [255, 255, 255, Math.round(zoneAlpha(z) * 180)],
      getPixelOffset: [0, -20],
      sizeUnits: 'pixels',
      pickable: false,
    });

    overlayRef.current.setProps({
      layers: [mainArcLayer, weakArcLayer, ghostArcLayer, arrowLayer, nodeLayer, labelLayer],
      onClick: (info) => {
        if (!info.picked) {
          setSelectedZoneKey(null);
          setArcTooltip(null);
        }
      },
    });
  }, [data, selectedZoneKey, arcTooltip]);

  const noData = data.lanes.length === 0 && data.zones.length === 0;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[500px] rounded-lg overflow-hidden" />

      {noData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 border rounded-lg px-6 py-4 text-center">
            <p className="text-sm font-medium">No historical lanes found for this period.</p>
            <p className="text-xs text-muted-foreground mt-1">Try a longer period or check that orders are synced.</p>
          </div>
        </div>
      )}

      {selectedZone && (
        <div className="absolute bottom-4 left-4 z-10">
          <ZoneTooltip
            zone={selectedZone}
            period={period}
            periodNote={data.metadata.period_note}
            showClose
            onClose={handleCloseZonePanel}
          />
        </div>
      )}

      {!selectedZone && hoveredZone && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <ZoneTooltip
            zone={hoveredZone}
            period={period}
            periodNote={data.metadata.period_note}
          />
        </div>
      )}

      {arcTooltip && !selectedZone && !hoveredZone && (
        <div
          className="absolute z-10 bg-background/95 border rounded-md shadow-md px-3 py-2 text-xs pointer-events-none min-w-[200px]"
          style={{ left: arcTooltip.x + 12, top: arcTooltip.y - 40 }}
        >
          <p className="font-semibold mb-1">
            {arcTooltip.lane.origin_display_city}, {arcTooltip.lane.origin_display_state}
            {' → '}
            {arcTooltip.lane.destination_display_city}, {arcTooltip.lane.destination_display_state}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">Loads</dt>
            <dd className="font-medium">{arcTooltip.lane.load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Loads/day</dt>
            <dd className="font-medium">{arcTooltip.lane.loads_per_day.toFixed(2)}</dd>
            {arcTooltip.lane.median_gross_rate_per_loaded_mile !== null && (
              <>
                <dt className="text-muted-foreground">Median $/mi</dt>
                <dd className="font-medium">${arcTooltip.lane.median_gross_rate_per_loaded_mile.toFixed(2)}</dd>
              </>
            )}
          </dl>
          {arcTooltip.lane.reverse_strength === 'none' && (
            <p className="text-muted-foreground mt-1 italic">No reverse traffic observed</p>
          )}
          {arcTooltip.lane.reverse_strength === 'weak' && (
            <p className="text-muted-foreground mt-1 italic">
              Weak reverse — {arcTooltip.lane.reverse_load_count} loads
            </p>
          )}
          {arcTooltip.lane.reverse_strength === 'strong_truncated' && (
            <p className="text-muted-foreground mt-1 italic">
              Healthy reverse — {arcTooltip.lane.reverse_load_count} loads (not in top {data.metadata.lane_limit})
            </p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-background/90 border rounded-md px-3 py-2 text-xs space-y-1">
        <p className="font-semibold text-[11px] mb-1">Outbound optionality</p>
        {(["high", "medium", "low", "low_data"] as const).map((bucket) => {
          const colors: Record<string, string> = {
            high:     "bg-green-500",
            medium:   "bg-amber-500",
            low:      "bg-rose-500",
            low_data: "bg-slate-500",
          };
          const labels: Record<string, string> = {
            high:     `High  (H ≥ ${data.metadata.optionality_thresholds.medium_max} bits)`,
            medium:   `Medium  (${data.metadata.optionality_thresholds.low_max}–${data.metadata.optionality_thresholds.medium_max} bits)`,
            low:      `Low  (H < ${data.metadata.optionality_thresholds.low_max} bits)`,
            low_data: `Thin data (< ${data.metadata.min_zone_outbound_loads} loads)`,
          };
          return (
            <div key={bucket} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[bucket]}`} />
              <span className="text-muted-foreground">{labels[bucket]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
