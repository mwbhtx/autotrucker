"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import type { Theme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import { arcWidth, bearing, midpoint } from "../utils/freight-network";
import { ZoneTooltip } from "./ZoneTooltip";

const PROTOMAPS_API_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY ?? "";

// Near-black map: land/ocean nearly identical dark navy, only borders visible.
// Roads, labels, landuse all match earth → invisible.
const FREIGHT_DARK_THEME: Theme = {
  background:              "#07090e",
  earth:                   "#0c1018",
  park_a:                  "#0c1018",
  park_b:                  "#0c1018",
  hospital:                "#0c1018",
  industrial:              "#0c1018",
  school:                  "#0c1018",
  wood_a:                  "#0c1018",
  wood_b:                  "#0c1018",
  pedestrian:              "#0c1018",
  scrub_a:                 "#0c1018",
  scrub_b:                 "#0c1018",
  glacier:                 "#0c1018",
  sand:                    "#0c1018",
  beach:                   "#0c1018",
  aerodrome:               "#0c1018",
  runway:                  "#0c1018",
  water:                   "#070a14",
  zoo:                     "#0c1018",
  military:                "#0c1018",
  tunnel_other_casing:     "#0c1018",
  tunnel_minor_casing:     "#0c1018",
  tunnel_link_casing:      "#0c1018",
  tunnel_major_casing:     "#0c1018",
  tunnel_highway_casing:   "#0c1018",
  tunnel_other:            "#0c1018",
  tunnel_minor:            "#0c1018",
  tunnel_link:             "#0c1018",
  tunnel_major:            "#0c1018",
  tunnel_highway:          "#0c1018",
  pier:                    "#0c1018",
  buildings:               "#0c1018",
  minor_service_casing:    "#0c1018",
  minor_casing:            "#0c1018",
  link_casing:             "#0c1018",
  major_casing_late:       "#0c1018",
  highway_casing_late:     "#0c1018",
  major_casing_early:      "#0c1018",
  highway_casing_early:    "#0c1018",
  other:                   "#0c1018",
  minor_service:           "#0c1018",
  minor_a:                 "#0c1018",
  minor_b:                 "#0c1018",
  link:                    "#0c1018",
  major:                   "#0c1018",
  highway:                 "#0c1018",
  railway:                 "#0c1018",
  boundaries:              "#000000",
  bridges_other_casing:    "#0c1018",
  bridges_minor_casing:    "#0c1018",
  bridges_link_casing:     "#0c1018",
  bridges_major_casing:    "#0c1018",
  bridges_highway_casing:  "#0c1018",
  bridges_other:           "#0c1018",
  bridges_minor:           "#0c1018",
  bridges_link:            "#0c1018",
  bridges_major:           "#0c1018",
  bridges_highway:         "#0c1018",
  roads_label_minor:       "#0c1018",
  roads_label_major:       "#0c1018",
  ocean_label:             "#07090e",
  subplace_label:          "#0c1018",
  city_label:              "#0c1018",
  state_label:             "#0c1018",
  country_label:           "#0c1018",
  address_label:           "#0c1018",
  roads_label_minor_halo:  "#0c1018",
  roads_label_major_halo:  "#0c1018",
  subplace_label_halo:     "#0c1018",
  city_label_halo:         "#0c1018",
  state_label_halo:        "#0c1018",
  address_label_halo:      "#0c1018",
  peak_label:              "#0c1018",
  waterway_label:          "#07090e",
};

function protomapsStyle(): maplibregl.StyleSpecification {
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
    layers: layersWithCustomTheme("protomaps", FREIGHT_DARK_THEME, "en"),
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

  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<FreightZoneSummary | null>(null);
  const [arcTooltip, setArcTooltip] = useState<ArcTooltipData | null>(null);
  const [activeFlowTypes, setActiveFlowTypes] = useState<Set<FlowType>>(new Set(['source', 'transit', 'sink']));

  const toggleFlowType = (type: FlowType) => {
    setActiveFlowTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;

  const handleCloseZonePanel = useCallback(() => setSelectedZoneKey(null), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: protomapsStyle(),
      center: [-95, 38],
      zoom: 3.5,
      minZoom: 3,
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
    setHoveredZone(null);
    setArcTooltip(null);
  }, [data]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const { lanes, zones } = data;
    const allCounts = lanes.map((l) => l.load_count);

    // Lines only visible when a zone is selected
    const outboundLanes = selectedZoneKey
      ? lanes.filter((l) => l.origin_zone_key === selectedZoneKey)
      : [];
    const inboundLanes = selectedZoneKey
      ? lanes.filter((l) => l.destination_zone_key === selectedZoneKey && l.origin_zone_key !== selectedZoneKey)
      : [];

    // All endpoints of selected zone's lanes — always shown so lines have visible targets
    const connectedZoneKeys = selectedZoneKey
      ? new Set([...outboundLanes, ...inboundLanes].flatMap((l) => [l.origin_zone_key, l.destination_zone_key]))
      : null;

    // Zones: connected endpoints always shown (bypass filter so lines have visible targets);
    // idle view filtered by flow type.
    const laneZoneKeys = new Set(lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
    const activeZones = zones.filter((z) => {
      if (!laneZoneKeys.has(z.zone_key)) return false;
      if (connectedZoneKeys?.has(z.zone_key)) return true;
      return activeFlowTypes.has(zoneFlowType(z));
    });
    const maxOutbound = Math.max(1, ...activeZones.map((z) => z.outbound_load_count));

    const zoneAlpha = (z: FreightZoneSummary) => {
      if (!connectedZoneKeys) return 0.85;
      if (z.zone_key === selectedZoneKey) return 1;
      return connectedZoneKeys.has(z.zone_key) ? 0.9 : 0.2;
    };

    // Outbound lanes: brand green
    const outboundLineLayer = new LineLayer<FreightLaneEntry>({
      id: 'outbound-lanes',
      data: outboundLanes,
      getSourcePosition: (l) => [l.origin_centroid_lng, l.origin_centroid_lat],
      getTargetPosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getColor: [163, 230, 53, 220],
      getWidth: (l) => arcWidth(l.load_count, allCounts),
      widthUnits: 'pixels',
      widthMinPixels: 1.5,
      pickable: true,
      onHover: ({ object, x, y }) => {
        setArcTooltip(object ? { lane: object, x, y } : null);
      },
    });

    // Inbound lanes: blue, fainter
    const inboundLineLayer = new LineLayer<FreightLaneEntry>({
      id: 'inbound-lanes',
      data: inboundLanes,
      getSourcePosition: (l) => [l.origin_centroid_lng, l.origin_centroid_lat],
      getTargetPosition: (l) => [l.destination_centroid_lng, l.destination_centroid_lat],
      getColor: [99, 179, 237, 140],
      getWidth: (l) => arcWidth(l.load_count, allCounts),
      widthUnits: 'pixels',
      widthMinPixels: 1,
      pickable: false,
    });

    // Arrow at lane midpoint (not endpoint) — cleaner direction signal
    const arrowLayer = new TextLayer<FreightLaneEntry>({
      id: 'arrowheads',
      data: outboundLanes,
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
      getColor: [163, 230, 53, 220],
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
      layers: [inboundLineLayer, outboundLineLayer, arrowLayer, nodeLayer, labelLayer],
      onClick: (info) => {
        if (!info.picked) {
          setSelectedZoneKey(null);
          setArcTooltip(null);
        }
      },
    });
  }, [data, selectedZoneKey, arcTooltip, activeFlowTypes]);

  const noData = data.lanes.length === 0 && data.zones.length === 0;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[520px] rounded-lg overflow-hidden" />

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

      <div className="absolute bottom-4 right-4 bg-background/90 border rounded-md px-3 py-2 text-xs space-y-1.5">
        <p className="font-semibold text-[11px] mb-1">Zone type</p>
        {([
          { type: 'source',  dot: 'bg-blue-500',  label: 'Source  (export heavy)' },
          { type: 'transit', dot: 'bg-lime-400',  label: 'Transit  (balanced)' },
          { type: 'sink',    dot: 'bg-red-500',   label: 'Sink  (import heavy)' },
        ] as const).map(({ type, dot, label }) => {
          const active = activeFlowTypes.has(type);
          return (
            <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={() => toggleFlowType(type)} className="sr-only" />
              <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${active ? `${dot} border-transparent` : 'border-border bg-transparent'}`}>
                {active && <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={active ? "text-foreground" : "text-muted-foreground/50"}>{label}</span>
            </label>
          );
        })}
        <div className="pt-1 mt-0.5 border-t border-border/50 space-y-0.5 text-[10px] text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#a3e635] inline-block" />
            Outbound lanes
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#63b3ed] inline-block opacity-60" />
            Inbound lanes
          </div>
        </div>
      </div>
    </div>
  );
}
