"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import { LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import { arcWidth, bearing, midpoint } from "../utils/freight-network";
import { ZoneTooltip } from "./ZoneTooltip";

const PROTOMAPS_API_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY ?? "";

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

type FlowType = 'source' | 'transit' | 'sink';

// outbound / (outbound + inbound) ratio thresholds
function zoneFlowType(z: FreightZoneSummary): FlowType {
  const total = z.outbound_load_count + z.inbound_load_count;
  if (total === 0) return 'transit';
  const ratio = z.outbound_load_count / total;
  if (ratio > 0.65) return 'source';
  if (ratio < 0.35) return 'sink';
  return 'transit';
}

const FLOW_COLOR: Record<FlowType, [number, number, number]> = {
  source:  [ 59, 130, 246],  // blue-500  — export heavy
  transit: [163, 230,  53],  // lime-400  — balanced (brand primary)
  sink:    [239,  68,  68],  // red-500   — import heavy
};

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
  const [activeFlowTypes, setActiveFlowTypes] = useState<Set<FlowType>>(new Set(['source', 'transit', 'sink']));
  const [activeOptBuckets, setActiveOptBuckets] = useState<Set<string>>(new Set(['high']));
  const [strictMode, setStrictMode] = useState(false);

  const toggleFlowType = (type: FlowType) => {
    setActiveFlowTypes((prev) => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; });
  };
  const toggleOptBucket = (b: string) => {
    setActiveOptBuckets((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });
  };

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;

  const handleCloseZonePanel = useCallback(() => setSelectedZoneKey(null), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const isDark = document.documentElement.classList.contains("dark");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: protomapsStyle(isDark ? "dark" : "light"),
      center: [-97, 40],
      zoom: 4,
      minZoom: 3.5,
      maxZoom: 12,
      maxBounds: [[-175, 15], [-50, 72]],
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

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(protomapsStyle(resolvedTheme === "dark" ? "dark" : "light"));
  }, [resolvedTheme]);

  useEffect(() => {
    setHoveredZone(null);
    setArcTooltip(null);
  }, [data]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const { lanes, zones } = data;
    const allCounts = lanes.map((l) => l.load_count);

    // Zone passes both active filters (flow type + optionality bucket)
    const zonePassesFilters = (z: FreightZoneSummary) =>
      z.optionality_bucket !== 'low_data' &&
      activeFlowTypes.has(zoneFlowType(z)) &&
      activeOptBuckets.has(z.optionality_bucket);

    // Strict mode: lanes only shown when BOTH endpoints pass filters
    const laneZoneKeys = new Set(lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
    const zoneMap = new Map(zones.map((z) => [z.zone_key, z]));

    const visibleLanes = strictMode
      ? lanes.filter((l) => {
          const o = zoneMap.get(l.origin_zone_key);
          const d = zoneMap.get(l.destination_zone_key);
          return o && d && zonePassesFilters(o) && zonePassesFilters(d);
        })
      : lanes;

    const strictLaneZoneKeys = strictMode
      ? new Set(visibleLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]))
      : laneZoneKeys;

    // Lines only visible when a zone is selected
    const allOutbound = selectedZoneKey
      ? visibleLanes.filter((l) => l.origin_zone_key === selectedZoneKey)
      : [];
    // Transit = strong bidirectional; Outbound = one-way out
    const transitLanes = allOutbound.filter(
      (l) => l.reverse_strength === 'strong_visible' || l.reverse_strength === 'strong_truncated',
    );
    const pureOutboundLanes = allOutbound.filter(
      (l) => l.reverse_strength !== 'strong_visible' && l.reverse_strength !== 'strong_truncated',
    );
    // Transit destination keys — skip those in inbound layer (already shown as transit)
    const transitDestKeys = new Set(transitLanes.map((l) => l.destination_zone_key));
    const pureInboundLanes = selectedZoneKey
      ? visibleLanes.filter(
          (l) =>
            l.destination_zone_key === selectedZoneKey &&
            l.origin_zone_key !== selectedZoneKey &&
            !transitDestKeys.has(l.origin_zone_key),
        )
      : [];

    const allShownLanes = [...transitLanes, ...pureOutboundLanes, ...pureInboundLanes];

    // All endpoints of selected zone's lanes — always shown so lines have visible targets
    const connectedZoneKeys = selectedZoneKey
      ? new Set(allShownLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]))
      : null;

    // When zone selected: show ONLY connected endpoints + selected zone.
    // Idle view: filter by flow type + optionality.
    const activeZones = zones.filter((z) => {
      if (connectedZoneKeys) return connectedZoneKeys.has(z.zone_key);
      if (!strictLaneZoneKeys.has(z.zone_key)) return false;
      return zonePassesFilters(z);
    });
    const maxOutbound = Math.max(1, ...activeZones.map((z) => z.outbound_load_count));

    const zoneAlpha = (z: FreightZoneSummary) => {
      if (!connectedZoneKeys) return 0.85;
      if (z.zone_key === selectedZoneKey) return 1;
      return connectedZoneKeys.has(z.zone_key) ? 0.9 : 0.2;
    };

    const lineLayerBase = {
      getSourcePosition: (l: FreightLaneEntry) => [l.origin_centroid_lng, l.origin_centroid_lat] as [number, number],
      getTargetPosition: (l: FreightLaneEntry) => [l.destination_centroid_lng, l.destination_centroid_lat] as [number, number],
      getWidth: (l: FreightLaneEntry) => arcWidth(l.load_count, allCounts),
      widthUnits: 'pixels' as const,
      widthMinPixels: 1.5,
      pickable: true,
      onHover: ({ object, x, y }: { object?: FreightLaneEntry; x: number; y: number }) => {
        setArcTooltip(object ? { lane: object, x, y } : null);
      },
    };

    // Transit (strong bidirectional): lime
    const transitLineLayer = new LineLayer<FreightLaneEntry>({ ...lineLayerBase, id: 'transit-lanes', data: transitLanes, getColor: [163, 230, 53, 220] });
    // Outbound (one-way out): blue
    const outboundLineLayer = new LineLayer<FreightLaneEntry>({ ...lineLayerBase, id: 'outbound-lanes', data: pureOutboundLanes, getColor: [59, 130, 246, 200] });
    // Inbound (one-way in): red
    const inboundLineLayer = new LineLayer<FreightLaneEntry>({ ...lineLayerBase, id: 'inbound-lanes', data: pureInboundLanes, getColor: [239, 68, 68, 180] });

    // Arrows at midpoint for outbound + transit (direction signal)
    const arrowData = [...transitLanes, ...pureOutboundLanes];
    const arrowColors: Record<string, [number, number, number, number]> = {};
    transitLanes.forEach((l) => { arrowColors[l.origin_zone_key + l.destination_zone_key] = [163, 230, 53, 220]; });
    pureOutboundLanes.forEach((l) => { arrowColors[l.origin_zone_key + l.destination_zone_key] = [59, 130, 246, 200]; });

    const arrowLayer = new TextLayer<FreightLaneEntry>({
      id: 'arrowheads',
      data: arrowData,
      getPosition: (l) => {
        const [midLat, midLng] = midpoint(
          l.origin_centroid_lat, l.origin_centroid_lng,
          l.destination_centroid_lat, l.destination_centroid_lng,
        );
        return [midLng, midLat];
      },
      getText: () => '▶',
      getAngle: (l) =>
        90 - bearing(l.origin_centroid_lat, l.origin_centroid_lng, l.destination_centroid_lat, l.destination_centroid_lng),
      getSize: 13,
      getColor: (l) => arrowColors[l.origin_zone_key + l.destination_zone_key] ?? [163, 230, 53, 220],
      sizeUnits: 'pixels',
      pickable: false,
    });

    // Zone dots — always visible, small, clickable
    const nodeLayer = new ScatterplotLayer<FreightZoneSummary>({
      id: 'zone-nodes',
      data: activeZones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      radiusUnits: 'pixels',
      getRadius: (z) => {
        const base = Math.max(4, Math.min(14, (z.outbound_load_count / maxOutbound) * 14));
        return z.zone_key === selectedZoneKey ? base + 3 : base;
      },
      filled: true,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: (z) => z.zone_key === selectedZoneKey ? 2 : 1,
      getFillColor: (z) => {
        const [r, g, b] = FLOW_COLOR[zoneFlowType(z)];
        return [r, g, b, Math.round(zoneAlpha(z) * 160)];
      },
      getLineColor: (z) => {
        const [r, g, b] = FLOW_COLOR[zoneFlowType(z)];
        return [r, g, b, Math.round(zoneAlpha(z) * 255)];
      },
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          setSelectedZoneKey(object.zone_key === selectedZoneKey ? null : object.zone_key);
          setHoveredZone(null);
          setArcTooltip(null);
        }
      },
      onHover: ({ object }) => {
        if (!selectedZoneKey) setHoveredZone(object ?? null);
      },
    });

    // City labels — only for selected zone's connected endpoints
    const labelZones = connectedZoneKeys
      ? activeZones.filter((z) => connectedZoneKeys.has(z.zone_key))
      : [];
    const labelLayer = new TextLayer<FreightZoneSummary>({
      id: 'zone-labels',
      data: labelZones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      getText: (z) => `${z.display_city}, ${z.display_state}`,
      getSize: 11,
      getColor: [255, 255, 255, 200],
      getPixelOffset: [0, -18],
      sizeUnits: 'pixels',
      pickable: false,
    });

    overlayRef.current.setProps({
      layers: [inboundLineLayer, transitLineLayer, outboundLineLayer, arrowLayer, nodeLayer, labelLayer],
      onClick: (info) => {
        if (!info.picked) {
          setSelectedZoneKey(null);
          setArcTooltip(null);
        }
      },
    });
  }, [data, selectedZoneKey, arcTooltip, activeFlowTypes, activeOptBuckets, strictMode]);

  const noData = data.lanes.length === 0 && data.zones.length === 0;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[calc(100vh-22rem)] min-h-[400px] rounded-lg overflow-hidden" />

      {noData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 border rounded-lg px-6 py-4 text-center">
            <p className="text-sm font-medium">No historical lanes found for this period.</p>
            <p className="text-xs text-muted-foreground mt-1">Try a longer period or check that orders are synced.</p>
          </div>
        </div>
      )}

      {!selectedZoneKey && !hoveredZone && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
          <p className="text-xs text-muted-foreground/60 italic">Click any hub to see its lanes</p>
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
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-background/90 border rounded-md px-3 py-2 text-xs space-y-2 min-w-[190px]">

        {/* Flow type */}
        <p className="font-semibold text-[11px]">Flow type</p>
        {([
          { type: 'source',  dot: 'bg-blue-500', label: 'Source (export heavy)' },
          { type: 'transit', dot: 'bg-lime-400', label: 'Transit (balanced)' },
          { type: 'sink',    dot: 'bg-red-500',  label: 'Sink (import heavy)' },
        ] as const).map(({ type, dot, label }) => {
          const active = activeFlowTypes.has(type);
          return (
            <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={() => toggleFlowType(type)} className="sr-only" />
              <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                {active && <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
            </label>
          );
        })}

        {/* Optionality */}
        <p className="font-semibold text-[11px] pt-1 border-t border-border/50">Optionality</p>
        {([
          { bucket: 'high',   dot: 'bg-emerald-500', label: `High  (H ≥ ${data.metadata.optionality_thresholds.medium_max} bits)` },
          { bucket: 'medium', dot: 'bg-amber-500',   label: `Medium  (${data.metadata.optionality_thresholds.low_max}–${data.metadata.optionality_thresholds.medium_max} bits)` },
          { bucket: 'low',    dot: 'bg-rose-500',    label: `Low  (H < ${data.metadata.optionality_thresholds.low_max} bits)` },
        ]).map(({ bucket, dot, label }) => {
          const active = activeOptBuckets.has(bucket);
          return (
            <label key={bucket} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={() => toggleOptBucket(bucket)} className="sr-only" />
              <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                {active && <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
            </label>
          );
        })}

        {/* Strict mode */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none pt-1 border-t border-border/50">
          <input type="checkbox" checked={strictMode} onChange={() => setStrictMode((v) => !v)} className="sr-only" />
          <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${strictMode ? 'bg-primary border-transparent' : 'border-border'}`}>
            {strictMode && <svg className="w-2 h-2 text-primary-foreground" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          <span className={strictMode ? 'text-foreground font-medium' : 'text-muted-foreground/70'}>
            Matching endpoints only
          </span>
        </label>
        {strictMode && (
          <p className="text-[10px] text-muted-foreground/60 -mt-1 pl-[18px]">
            Lanes where both hubs pass all filters
          </p>
        )}

        {/* Lane legend */}
        <div className="space-y-0.5 text-[10px] text-muted-foreground/60 pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#a3e635] inline-block" />Transit (both ways)</div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-500 inline-block" />Outbound (one-way)</div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 inline-block" />Inbound (one-way)</div>
        </div>
      </div>
    </div>
  );
}
