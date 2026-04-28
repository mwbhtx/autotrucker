"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import { arcWidth } from "../utils/freight-network";
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

type FlowType = 'source' | 'sink';

// Zone-level flow classification keeps a 'transit' (balanced) bucket because
// any zone with mixed inbound/outbound is by definition not source- or sink-dominant.
// This is independent of the lane traffic filter, which has no transit option.
type ZoneFlowKind = 'source' | 'sink' | 'transit';

function zoneVolumeBucket(
  z: FreightZoneSummary,
  thresholds: { medium_min: number; high_min: number },
): 'high' | 'medium' | 'low' {
  const total = z.outbound_load_count + z.inbound_load_count;
  if (total >= thresholds.high_min) return 'high';
  if (total >= thresholds.medium_min) return 'medium';
  return 'low';
}

// outbound / (outbound + inbound) ratio thresholds
function zoneFlowType(z: FreightZoneSummary): ZoneFlowKind {
  const total = z.outbound_load_count + z.inbound_load_count;
  if (total === 0) return 'transit';
  const ratio = z.outbound_load_count / total;
  if (ratio > 0.65) return 'source';
  if (ratio < 0.35) return 'sink';
  return 'transit';
}

const FLOW_COLOR: Record<ZoneFlowKind, [number, number, number]> = {
  source:  [ 59, 130, 246],  // blue-500    — export heavy
  transit: [ 16, 185, 129],  // emerald-500 — balanced
  sink:    [239,  68,  68],  // red-500     — import heavy
};

// Node fill color encodes total volume — warm heat scale contrasts electric-blue lanes
const VOLUME_COLOR: Record<'high' | 'medium' | 'low', [number, number, number]> = {
  high:   [255, 200,  50],  // gold
  medium: [255, 110,  20],  // orange
  low:    [200,  45,  45],  // red
};

interface TripDatum {
  path: [number, number][];
  timestamps: [number, number];
  color: [number, number, number, number];
  width: number;
  lane: FreightLaneEntry;
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
  const [activeFlowTypes, setActiveFlowTypes] = useState<Set<FlowType>>(new Set(['source', 'sink']));
  const [activeOptBuckets, setActiveOptBuckets] = useState<Set<string>>(new Set(['high', 'medium', 'low']));
  const [strictMode, setStrictMode] = useState(false);
  const [expandNetwork, setExpandNetwork] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const tripsDataRef = useRef<TripDatum[]>([]);
  const themeRef = useRef(resolvedTheme);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const belowLanesRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aboveLanesRef = useRef<any[]>([]);
  // Stable handler — setters are always the same reference
  const overlayClickRef = useRef((info: { picked: boolean }) => {
    if (!info.picked) { setSelectedZoneKey(null); }
  });

  useEffect(() => { themeRef.current = resolvedTheme; }, [resolvedTheme]);

  // Animation loop — TripsLayer comet trails, no React re-renders
  useEffect(() => {
    const LOOP_MS = 2400;
    const TRAIL_MS = 700;
    // Loop includes trail so comet fully exits before next one fires
    const CYCLE_MS = LOOP_MS + TRAIL_MS;
    let startTs: number | null = null;

    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = (ts - startTs) % CYCLE_MS;

      if (overlayRef.current && (tripsDataRef.current.length || aboveLanesRef.current.length)) {
        const tripsLayer = new TripsLayer<TripDatum>({
          id: 'trips',
          data: tripsDataRef.current,
          getPath: (d) => d.path,
          getTimestamps: (d) => d.timestamps,
          getColor: (d) => d.color,
          getWidth: () => 6,
          widthUnits: 'pixels',
          widthMinPixels: 6,
          currentTime: t,
          trailLength: TRAIL_MS,
          rounded: true,
          pickable: false,
        });

        overlayRef.current.setProps({
          layers: [...belowLanesRef.current, tripsLayer, ...aboveLanesRef.current],
          onClick: overlayClickRef.current,
        });
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

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
      bounds: [[-125, 24], [-66, 49]],
      fitBoundsOptions: { padding: 80 },
      minZoom: 4,
      maxZoom: 12,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();

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
  }, [data]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const { lanes, zones } = data;
    const allCounts = lanes.map((l) => l.load_count);

    const volThresholds = data.metadata.data_support_thresholds;

    // Temporary diagnostic — confirm whether mercer prod actually has medium/low
    // volume zones surviving the low_data filter, or whether everything visible is high.
    if (typeof window !== 'undefined') {
      const dist = { low_data: 0, low: 0, medium: 0, high: 0 };
      for (const z of zones) {
        if (z.optionality_bucket === 'low_data') { dist.low_data++; continue; }
        dist[zoneVolumeBucket(z, volThresholds)]++;
      }
      // eslint-disable-next-line no-console
      console.log('[freight-map] volume distribution', dist, 'thresholds', volThresholds, 'total zones', zones.length);
    }
    // Volume alone controls zone visibility; Traffic filter only affects lane display on click
    const zonePassesFilters = (z: FreightZoneSummary) =>
      z.optionality_bucket !== 'low_data' &&
      activeOptBuckets.has(zoneVolumeBucket(z, volThresholds));

    const zoneMap = new Map(zones.map((z) => [z.zone_key, z]));

    // Volume filter always applies to both endpoints — low_data and non-matching volume zones
    // never appear on map or as connected segments, even when a zone is selected.
    const qualityLanes = lanes.filter((l) => {
      const o = zoneMap.get(l.origin_zone_key);
      const d = zoneMap.get(l.destination_zone_key);
      return o && d && zonePassesFilters(o) && zonePassesFilters(d);
    });

    const laneZoneKeys = new Set(qualityLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));

    // Strict mode: additionally requires BOTH endpoints to share all active lane filters
    const visibleLanes = strictMode
      ? qualityLanes.filter((l) => {
          const o = zoneMap.get(l.origin_zone_key);
          const d = zoneMap.get(l.destination_zone_key);
          return o && d && zonePassesFilters(o) && zonePassesFilters(d);
        })
      : qualityLanes;

    const strictLaneZoneKeys = strictMode
      ? new Set(visibleLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]))
      : laneZoneKeys;

    // Lanes touching the selected zone — both endpoints' perspectives.
    // Bidirectional (transit) lanes contain both an outbound and inbound flow:
    //   source on  → render outbound comet (selected → other endpoint)
    //   sink on    → render inbound comet (other endpoint → selected)
    //   both on    → render both comets (legacy "transit" appearance)
    // Non-bidirectional lanes have a single fixed direction:
    //   origin=selected (outbound) → shown only with source on
    //   dest=selected   (inbound)  → shown only with sink on
    const isBidirectionalLane = (l: FreightLaneEntry) =>
      l.reverse_strength === 'strong_visible' || l.reverse_strength === 'strong_truncated';

    const sourceOn = activeFlowTypes.has('source');
    const sinkOn = activeFlowTypes.has('sink');

    const lanesAtSelected = selectedZoneKey
      ? visibleLanes.filter(
          (l) => l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey,
        )
      : [];

    const bidirBothLanes: FreightLaneEntry[] = [];   // bidirectional + both filters → both comets
    const outboundDirectLanes: FreightLaneEntry[] = []; // single outbound comet (selected → other)
    const inboundDirectLanes: FreightLaneEntry[] = [];  // single inbound comet (other → selected)

    for (const l of lanesAtSelected) {
      const isBi = isBidirectionalLane(l);
      const otherIsOrigin = l.destination_zone_key === selectedZoneKey;
      if (isBi) {
        if (sourceOn && sinkOn) bidirBothLanes.push(l);
        else if (sourceOn) outboundDirectLanes.push(l);
        else if (sinkOn) inboundDirectLanes.push(l);
      } else if (otherIsOrigin) {
        if (sinkOn) inboundDirectLanes.push(l);
      } else {
        if (sourceOn) outboundDirectLanes.push(l);
      }
    }

    const directShownLanes = [...bidirBothLanes, ...outboundDirectLanes, ...inboundDirectLanes];

    // Directed transitive reachability from selected node:
    //   sink (inbound) on    → reverse-BFS: zones with directed path X→…→selected
    //   source (outbound) on → forward-BFS: zones reachable via selected→…→X
    //   both on              → union of upstream and downstream sets
    // Bidirectional lanes carry both inbound and outbound flow; they contribute:
    //   forward edges in both directions when 'source' is on
    //   reverse edges in both directions when 'sink' is on
    // Non-bidirectional lane origin→dest contributes:
    //   forward edge origin→dest when 'source' active
    //   reverse edge dest→origin when 'sink' active
    let componentLanes: FreightLaneEntry[] = [];
    let componentZoneKeys: Set<string> = new Set();
    if (expandNetwork && selectedZoneKey) {
      const forwardAdj = new Map<string, Set<string>>();
      const reverseAdj = new Map<string, Set<string>>();
      const addEdge = (m: Map<string, Set<string>>, a: string, b: string) => {
        if (!m.has(a)) m.set(a, new Set());
        m.get(a)!.add(b);
      };

      for (const l of qualityLanes) {
        if (isBidirectionalLane(l)) {
          if (sourceOn) {
            addEdge(forwardAdj, l.origin_zone_key, l.destination_zone_key);
            addEdge(forwardAdj, l.destination_zone_key, l.origin_zone_key);
          }
          if (sinkOn) {
            addEdge(reverseAdj, l.origin_zone_key, l.destination_zone_key);
            addEdge(reverseAdj, l.destination_zone_key, l.origin_zone_key);
          }
        } else {
          if (sourceOn) addEdge(forwardAdj, l.origin_zone_key, l.destination_zone_key);
          if (sinkOn) addEdge(reverseAdj, l.destination_zone_key, l.origin_zone_key);
        }
      }

      const bfs = (adj: Map<string, Set<string>>, start: string) => {
        const visited = new Set<string>([start]);
        const queue = [start];
        while (queue.length) {
          const cur = queue.shift()!;
          for (const nb of adj.get(cur) ?? []) {
            if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
          }
        }
        return visited;
      };

      const forwardReachable = sourceOn ? bfs(forwardAdj, selectedZoneKey) : new Set<string>([selectedZoneKey]);
      const reverseReachable = sinkOn ? bfs(reverseAdj, selectedZoneKey) : new Set<string>([selectedZoneKey]);

      componentZoneKeys = new Set<string>([...forwardReachable, ...reverseReachable]);

      componentLanes = qualityLanes.filter((l) => {
        if (l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey) return false;
        if (sourceOn
          && forwardReachable.has(l.origin_zone_key)
          && forwardReachable.has(l.destination_zone_key)) return true;
        if (sinkOn
          && reverseReachable.has(l.origin_zone_key)
          && reverseReachable.has(l.destination_zone_key)) return true;
        return false;
      });
    }

    const allShownLanes = [...directShownLanes, ...componentLanes];

    // BFS through traffic-filtered lanes only — zones reachable from selection
    // Prevents disconnected clusters that pass traffic filter from appearing
    const connectedZoneKeys = selectedZoneKey
      ? (() => {
          const fadj = new Map<string, Set<string>>();
          for (const l of allShownLanes) {
            if (!fadj.has(l.origin_zone_key)) fadj.set(l.origin_zone_key, new Set());
            if (!fadj.has(l.destination_zone_key)) fadj.set(l.destination_zone_key, new Set());
            fadj.get(l.origin_zone_key)!.add(l.destination_zone_key);
            fadj.get(l.destination_zone_key)!.add(l.origin_zone_key);
          }
          const reachable = new Set<string>([selectedZoneKey]);
          const q = [selectedZoneKey];
          while (q.length) {
            const cur = q.shift()!;
            for (const nb of fadj.get(cur) ?? []) {
              if (!reachable.has(nb)) { reachable.add(nb); q.push(nb); }
            }
          }
          return reachable;
        })()
      : null;

    // Drop component lanes whose endpoints aren't reachable through filtered lanes
    if (connectedZoneKeys) {
      componentLanes = componentLanes.filter(
        (l) => connectedZoneKeys.has(l.origin_zone_key) && connectedZoneKeys.has(l.destination_zone_key),
      );
    }

    // When zone selected: show ONLY connected endpoints + selected zone.
    // Idle view: filter by flow type + optionality.
    const activeZones = zones.filter((z) => {
      if (connectedZoneKeys) return connectedZoneKeys.has(z.zone_key);
      if (!strictLaneZoneKeys.has(z.zone_key)) return false;
      return zonePassesFilters(z);
    });

    const directConnectedKeys = selectedZoneKey
      ? new Set(directShownLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]))
      : null;

    const zoneAlpha = (z: FreightZoneSummary) => {
      if (!connectedZoneKeys) return 1.0;
      if (z.zone_key === selectedZoneKey) return 1.0;
      if (directConnectedKeys?.has(z.zone_key)) return 1.0;
      return 0.35; // component nodes beyond direct connections
    };

    // Comet trail data — stagger start times so comets don't all fire at once
    const LOOP_MS = 2400;
    const cometColor: [number, number, number, number] = [0, 200, 255, 255];     // electric blue
    const componentColor: [number, number, number, number] = [0, 160, 210, 120]; // dim blue for network expansion

    const makeTripDatum = (l: FreightLaneEntry, reversed = false, dim = false): TripDatum => ({
      path: reversed
        ? [[l.destination_centroid_lng, l.destination_centroid_lat], [l.origin_centroid_lng, l.origin_centroid_lat]]
        : [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]],
      timestamps: [0, LOOP_MS],
      color: dim ? componentColor : cometColor,
      width: 6,
      lane: l,
    });

    // Comet direction is relative to the selected zone, not the lane's canonical direction.
    // For an outbound comet (selected → other), reverse the path when the lane stores
    // selected as the destination. For an inbound comet, reverse when selected is the origin.
    const cometSelectedToOther = (l: FreightLaneEntry) =>
      makeTripDatum(l, l.destination_zone_key === selectedZoneKey);
    const cometOtherToSelected = (l: FreightLaneEntry) =>
      makeTripDatum(l, l.origin_zone_key === selectedZoneKey);

    // Component bidirectional lanes carry flow in both directions; render both comets
    // so a lane between two upstream/downstream nodes can't be misread as a one-way
    // dead end (a single canonical-direction comet hid the reverse flow).
    const componentBidirLanes = componentLanes.filter(isBidirectionalLane);
    const componentNonBidirLanes = componentLanes.filter((l) => !isBidirectionalLane(l));

    tripsDataRef.current = [
      ...bidirBothLanes.flatMap((l) => [cometSelectedToOther(l), cometOtherToSelected(l)]),
      ...outboundDirectLanes.map((l) => cometSelectedToOther(l)),
      ...inboundDirectLanes.map((l) => cometOtherToSelected(l)),
      ...componentBidirLanes.flatMap((l) => [
        makeTripDatum(l, false, true),
        makeTripDatum(l, true, true),
      ]),
      ...componentNonBidirLanes.map((l) => makeTripDatum(l, false, true)),
    ];

    const NODE_RADIUS_PX = 10;
    const NODE_STROKE_PX = 1;

    // Zone dots — color = volume bucket. Radius and stroke are uniform.
    const nodeLayer = new ScatterplotLayer<FreightZoneSummary>({
      id: 'zone-nodes',
      data: activeZones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      radiusUnits: 'pixels',
      getRadius: NODE_RADIUS_PX,
      filled: true,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: NODE_STROKE_PX,
      getFillColor: (z) => {
        const [r, g, b] = VOLUME_COLOR[zoneVolumeBucket(z, volThresholds)];
        return [r, g, b, Math.round(zoneAlpha(z) * 230)];
      },
      getLineColor: (z) => {
        const [r, g, b] = VOLUME_COLOR[zoneVolumeBucket(z, volThresholds)];
        return [Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30), Math.round(zoneAlpha(z) * 255)];
      },
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          const next = object.zone_key === selectedZoneKey ? null : object.zone_key;
          setSelectedZoneKey(next);
          setHoveredZone(null);
          if (next && mapRef.current) {
            mapRef.current.easeTo({
              center: [object.centroid_lng, object.centroid_lat],
              duration: 600,
            });
          }
        }
      },
      onHover: ({ object }) => {
        if (!selectedZoneKey) setHoveredZone(object ?? null);
      },
    });

    // Zone radius circle + selection halo — only when a zone is selected.
    // Cells are ~N miles wide (ZONE_CELL_DEGREES); half-width ≈ visual extent from center.
    const zoneRadiusMiles = data.metadata.zone_radius_miles;
    const radiusMeters = (zoneRadiusMiles / 2) * 1609.34;
    const selectedZoneOnMap = selectedZoneKey
      ? activeZones.find((z) => z.zone_key === selectedZoneKey)
      : null;
    const radiusLayer = selectedZoneOnMap
      ? new ScatterplotLayer<FreightZoneSummary>({
          id: 'zone-radius',
          data: [selectedZoneOnMap],
          getPosition: (z) => [z.centroid_lng, z.centroid_lat],
          getRadius: () => radiusMeters,
          radiusUnits: 'meters',
          filled: true,
          stroked: true,
          getFillColor: [255, 255, 255, 18],
          getLineColor: [255, 255, 255, 80],
          lineWidthUnits: 'pixels',
          getLineWidth: 1,
          pickable: false,
        })
      : null;
    const haloLayer = selectedZoneOnMap
      ? new ScatterplotLayer<FreightZoneSummary>({
          id: 'zone-halo',
          data: [selectedZoneOnMap],
          getPosition: (z) => [z.centroid_lng, z.centroid_lat],
          radiusUnits: 'pixels',
          getRadius: () => NODE_RADIUS_PX + 6,
          filled: false,
          stroked: true,
          getLineColor: [255, 255, 255, 220],
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          pickable: false,
        })
      : null;

    // Faint static tracks — lane paths always visible between comet sweeps
    const isDark = resolvedTheme === 'dark';
    const directLanes = directShownLanes;
    const trackLayer = new PathLayer<FreightLaneEntry>({
      id: 'lane-tracks',
      data: directLanes,
      getPath: (l) => [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]],
      getWidth: () => 6,
      widthUnits: 'pixels',
      widthMinPixels: 6,
      getColor: () => (isDark ? [0, 180, 240, 130] : [0, 100, 180, 130]) as [number, number, number, number],
      pickable: false,
    });
    const componentTrackLayer = new PathLayer<FreightLaneEntry>({
      id: 'component-tracks',
      data: componentLanes,
      getPath: (l) => [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]],
      getWidth: () => 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      getColor: () => (isDark ? [0, 140, 200, 50] : [0, 80, 150, 50]) as [number, number, number, number],
      pickable: false,
    });

    // radius + tracks go below lanes; nodes + halo go above
    belowLanesRef.current = [...(radiusLayer ? [radiusLayer] : []), componentTrackLayer, trackLayer];
    aboveLanesRef.current = [nodeLayer, ...(haloLayer ? [haloLayer] : [])];
  }, [data, selectedZoneKey, activeFlowTypes, activeOptBuckets, strictMode, expandNetwork, resolvedTheme]);

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

      <div className="absolute bottom-4 right-4 z-10 bg-background border rounded-lg px-5 py-4 text-base space-y-3 min-w-[300px]">

        {/* Traffic filter — controls lanes shown on zone click */}
        <p className="font-semibold text-base">Traffic</p>
        <p className="text-sm text-muted-foreground/60 -mt-2">Filters lanes shown when a hub is selected</p>
        {([
          { type: 'source', dot: 'bg-blue-500', label: 'Outbound' },
          { type: 'sink',   dot: 'bg-red-500',  label: 'Inbound' },
        ] as const).map(({ type, dot, label }) => {
          const active = activeFlowTypes.has(type);
          return (
            <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={() => toggleFlowType(type)} className="sr-only" />
              <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
            </label>
          );
        })}

        {/* Outbound Volume — currently bucketed by entropy (variety), not load count.
            Confirm with product whether to swap to data_support (count) to match label. */}
        <p className="font-semibold text-base pt-2 border-t border-border/50">Volume</p>
        {([
          { bucket: 'high',   dot: 'bg-yellow-400',  label: 'High' },
          { bucket: 'medium', dot: 'bg-orange-500',  label: 'Medium' },
          { bucket: 'low',    dot: 'bg-red-600',     label: 'Low' },
        ]).map(({ bucket, dot, label }) => {
          const active = activeOptBuckets.has(bucket);
          return (
            <label key={bucket} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={active} onChange={() => toggleOptBucket(bucket)} className="sr-only" />
              <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
            </label>
          );
        })}

        {/* Strict mode */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-2 border-t border-border/50">
          <input type="checkbox" checked={strictMode} onChange={() => setStrictMode((v) => !v)} className="sr-only" />
          <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${strictMode ? 'bg-primary border-transparent' : 'border-border'}`}>
            {strictMode && <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          <span className={strictMode ? 'text-foreground font-medium' : 'text-muted-foreground/70'}>
            Matching endpoints only
          </span>
        </label>
        <p className="text-base text-muted-foreground/60 -mt-1 pl-[26px]">
          Lanes where both hubs pass all filters
        </p>

        {/* Expand network */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-2 border-t border-border/50">
          <input type="checkbox" checked={expandNetwork} onChange={() => setExpandNetwork((v) => !v)} className="sr-only" />
          <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${expandNetwork ? 'bg-primary border-transparent' : 'border-border'}`}>
            {expandNetwork && <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          <span className={expandNetwork ? 'text-foreground font-medium' : 'text-muted-foreground/70'}>
            Show full network
          </span>
        </label>
        <p className="text-base text-muted-foreground/60 -mt-1 pl-[26px]">
          All lanes connected to selected hub
        </p>

      </div>
    </div>
  );
}
