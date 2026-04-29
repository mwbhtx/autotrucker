"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useZoneDetail } from '../hooks/use-zone-detail';
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/web/components/ui/select";
import { ZoneTooltip } from "./ZoneTooltip";
import type {
  FlowType, MapMode, VisualBucket, EntryStrictness,
  HomeNetworkMaxLegs, TemporaryHome, HomeNetworkNode, HomeBaseQuality,
  ZoneTier,
} from "../utils/map-mode-types";
import { HOME_NETWORK_COLOR, TIER_COLOR } from "../utils/map-mode-types";
import {
  addEdge, bfsDepth,
  buildHomeNetwork, buildHomeNetworkFromAnchors, buildHomeBaseQuality,
  homeBaseHeatColor, isSupportedReverseLane,
  findEntryAnchors, temporaryHomeSummary,
} from "../utils/home-network-graph";
import {
  PRESET_THRESHOLDS,
  applyZoneFilters,
  type ScorePreset,
  type ZoneFilterThresholds,
  type ZoneSignals,
} from "@mwbhtx/haulvisor-core";

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

function makeSetToggler<T>(setter: (fn: (prev: Set<T>) => Set<T>) => void) {
  return (item: T) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  });
}

function bezierArc(
  from: [number, number],
  to: [number, number],
  side: 1 | -1,
  segments = 32,
): [number, number][] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [from, to];
  const px = -dy / len;
  const py = dx / len;
  const BULGE = 0.22;
  const cx = (from[0] + to[0]) / 2 + side * px * len * BULGE;
  const cy = (from[1] + to[1]) / 2 + side * py * len * BULGE;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    pts.push([
      mt * mt * from[0] + 2 * mt * t * cx + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * cy + t * t * to[1],
    ]);
  }
  return pts;
}

type ArcKind = 'outbound' | 'inbound' | 'forwardChain' | 'reverseChain';

// Continuation chains share semantics + palette with their direct counterparts:
// forwardChain (downstream of selected) reads as outbound flow extension.
// reverseChain (upstream of selected) reads as inbound flow extension.
const ARC_COLOR: Record<ArcKind, [number, number, number]> = {
  outbound:     [ 96, 165, 250],  // blue-400
  inbound:      [248, 113, 113],  // red-400
  forwardChain: [ 96, 165, 250],
  reverseChain: [248, 113, 113],
};

type LaneArc = {
  pts: [number, number][];
  cumFrac: number[];   // arc-length-parameterized fraction at each pts[i]
  kind: ArcKind;
  isDirect: boolean;   // direct = touches selected zone; chain = expanded network
};

type ArcSubseg = {
  path: [number, number][];
  color: [number, number, number, number];
  width: number;
};

function buildLaneArc(
  from: [number, number],
  to: [number, number],
  side: 1 | -1,
  kind: ArcKind,
  isDirect: boolean,
): LaneArc {
  const pts = bezierArc(from, to, side);
  const cumFrac: number[] = [0];
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.sqrt(dx * dx + dy * dy);
    segLens.push(l);
    total += l;
  }
  let acc = 0;
  for (const l of segLens) {
    acc += total === 0 ? 0 : l / total;
    cumFrac.push(acc);
  }
  return { pts, cumFrac, kind, isDirect };
}

function sampleArcAt(arc: LaneArc, frac: number): [number, number] {
  const { pts, cumFrac } = arc;
  if (frac <= 0) return pts[0];
  if (frac >= 1) return pts[pts.length - 1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (frac <= cumFrac[i + 1]) {
      const span = cumFrac[i + 1] - cumFrac[i] || 1;
      const localT = (frac - cumFrac[i]) / span;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * localT,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * localT,
      ];
    }
  }
  return pts[pts.length - 1];
}

function arcSubpath(arc: LaneArc, startFrac: number, endFrac: number): [number, number][] {
  const path: [number, number][] = [sampleArcAt(arc, startFrac)];
  for (let i = 1; i < arc.pts.length; i++) {
    if (arc.cumFrac[i] > startFrac && arc.cumFrac[i] < endFrac) path.push(arc.pts[i]);
  }
  path.push(sampleArcAt(arc, endFrac));
  return path;
}

const DASH_COUNT = 3;
const DASH_FRACTION = 0.16;     // visible dash length (fraction of arc)
const DASH_ALPHA_DIRECT = 240;
const DASH_ALPHA_CHAIN = 180;
const DASH_WIDTH_DIRECT = 3;
const DASH_WIDTH_CHAIN = 2;

function buildDashSubsegs(arcs: LaneArc[], phase: number): ArcSubseg[] {
  const result: ArcSubseg[] = [];
  for (const arc of arcs) {
    const baseColor = ARC_COLOR[arc.kind];
    const alpha = arc.isDirect ? DASH_ALPHA_DIRECT : DASH_ALPHA_CHAIN;
    const width = arc.isDirect ? DASH_WIDTH_DIRECT : DASH_WIDTH_CHAIN;
    const color: [number, number, number, number] = [baseColor[0], baseColor[1], baseColor[2], alpha];
    for (let k = 0; k < DASH_COUNT; k++) {
      const start = (k / DASH_COUNT + phase) % 1;
      const end = start + DASH_FRACTION;
      if (end <= 1) {
        result.push({ path: arcSubpath(arc, start, end), color, width });
      } else {
        result.push({ path: arcSubpath(arc, start, 1), color, width });
        result.push({ path: arcSubpath(arc, 0, end - 1), color, width });
      }
    }
  }
  return result;
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
  const [mapMode, setMapMode] = useState<MapMode>('network');
  const [temporaryHome, setTemporaryHome] = useState<TemporaryHome | null>(null);
  const [entryStrictness, setEntryStrictness] = useState<EntryStrictness>('balanced');
  const [homeNetworkMaxLegs, setHomeNetworkMaxLegs] = useState<HomeNetworkMaxLegs>(3);
  const [activeFlowTypes, setActiveFlowTypes] = useState<Set<FlowType>>(new Set(['source']));
  // Network mode state — preset gates which zones pass quality thresholds, tiers
  // gate which scored zones render. Default = balanced + show gold + silver.
  const [activePreset, setActivePreset] = useState<ScorePreset>('balanced');
  const [activeZoneTiers, setActiveZoneTiers] = useState<Set<ZoneTier>>(new Set(['gold', 'silver']));
  const [activeDestTiers, setActiveDestTiers] = useState<Set<ZoneTier>>(new Set(['gold', 'silver']));
  const [activeHomeNetworkBuckets, setActiveHomeNetworkBuckets] = useState<Set<VisualBucket>>(new Set(['high', 'medium', 'low']));
  const [expandNetwork, setExpandNetwork] = useState(false);
  const themeRef = useRef(resolvedTheme);
  // Stable handler — setters are always the same reference
  const overlayClickRef = useRef((info: { picked: boolean }) => {
    if (!info.picked) {
      setSelectedZoneKey(null);
      setTemporaryHome(null);
    }
  });

  // Animation state — dashes flow along arcs, pulse expands selected halo.
  // Stored in refs (not React state) to avoid 60fps re-renders. RAF loop reads
  // staticLayersRef + arcsRef + selectedHaloPosRef and emits dash + pulse layers.
  const arcsRef = useRef<LaneArc[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staticLayersRef = useRef<any[]>([]);
  const selectedHaloPosRef = useRef<[number, number] | null>(null);

  useEffect(() => { themeRef.current = resolvedTheme; }, [resolvedTheme]);

  const toggleFlowType = makeSetToggler<FlowType>(setActiveFlowTypes);
  const toggleZoneTier = makeSetToggler<ZoneTier>(setActiveZoneTiers);
  const toggleDestTier = makeSetToggler<ZoneTier>(setActiveDestTiers);
  const toggleHomeNetworkBucket = makeSetToggler<VisualBucket>(setActiveHomeNetworkBuckets);

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;

  const zoneDetail = useZoneDetail(
    mapMode === 'network' ? selectedZoneKey : null,
    period,
  );

  // Unfiltered — all outbound lanes for the selected zone. Used for local tier
  // scoring so percentile ranks are stable regardless of the destination tier filter.
  const allDetailLanes: FreightLaneEntry[] = useMemo(() => {
    if (!selectedZoneKey || !zoneDetail.data || !selectedZone) return [];
    const zoneByKey = new Map(data.zones.map((z) => [z.zone_key, z]));
    return zoneDetail.data.outbound_lanes.map((dl) => {
      const destZone = zoneByKey.get(dl.destination_zone_key);
      return {
        origin_zone_key: selectedZoneKey,
        origin_display_city: selectedZone.display_city,
        origin_display_state: selectedZone.display_state,
        origin_centroid_lat: selectedZone.centroid_lat,
        origin_centroid_lng: selectedZone.centroid_lng,
        destination_zone_key: dl.destination_zone_key,
        destination_display_city: dl.destination_display_city,
        destination_display_state: dl.destination_display_state,
        destination_centroid_lat: destZone?.centroid_lat ?? dl.destination_centroid_lat,
        destination_centroid_lng: destZone?.centroid_lng ?? dl.destination_centroid_lng,
        load_count: dl.load_count,
        loads_per_day: dl.loads_per_day,
        median_gross_rate_per_loaded_mile: dl.median_rate_per_mile,
        reverse_load_count: dl.reverse_load_count,
        reverse_loads_per_day: 0,
        reverse_strength:
          dl.reverse_load_count >= 5
            ? 'strong_truncated'
            : dl.reverse_load_count > 0
            ? 'weak'
            : 'none',
      };
    });
  }, [selectedZoneKey, selectedZone, zoneDetail.data, data.zones]);

  // Filtered by activeDestTiers — drives display (dots + arcs).
  const detailLanes: FreightLaneEntry[] = useMemo(
    () => allDetailLanes.filter((l) => {
      const tier = data.zones.find((z) => z.zone_key === l.destination_zone_key)?.quality?.tier ?? 'dim';
      return activeDestTiers.has(tier);
    }),
    [allDetailLanes, data.zones, activeDestTiers],
  );

  // Bucket lookup is now homeNetwork-only. Network mode reads quality.tier directly.
  const zoneBucket = useCallback((zone: FreightZoneSummary): VisualBucket | undefined => {
    if (mapMode !== 'homeNetwork') return undefined;
    if (temporaryHome && !selectedZoneKey) {
      const laneEndpointZoneKeys = new Set(data.lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
      const renderableZones = data.zones.filter((z) => laneEndpointZoneKeys.has(z.zone_key));
      const anchors = findEntryAnchors(renderableZones, temporaryHome, data.metadata.zone_radius_miles, entryStrictness);
      return buildHomeNetworkFromAnchors(data.lanes, data.zones, anchors.map((a) => a.zoneKey), homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low';
    }
    return selectedZoneKey
      ? buildHomeNetwork(data.lanes, data.zones, selectedZoneKey, homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low'
      : buildHomeBaseQuality(data.lanes, data.zones, homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low';
  }, [data.lanes, data.metadata.zone_radius_miles, data.zones, entryStrictness, homeNetworkMaxLegs, mapMode, selectedZoneKey, temporaryHome]);

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
      maxBounds: [[-168, 15], [-52, 72]],
      renderWorldCopies: false,
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
    const map = mapRef.current;
    if (!map) return;
    const handleContextMenu = (event: maplibregl.MapMouseEvent) => {
      if (mapMode !== 'homeNetwork') return;
      event.preventDefault();
      setTemporaryHome({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      setSelectedZoneKey(null);
      setHoveredZone(null);
    };
    map.on('contextmenu', handleContextMenu);
    return () => {
      map.off('contextmenu', handleContextMenu);
    };
  }, [mapMode]);

  useEffect(() => {
    if (!overlayRef.current) return;

    const { lanes, zones } = data;

    const zoneMap = new Map(zones.map((z) => [z.zone_key, z]));
    const laneEndpointZoneKeys = new Set(lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
    const renderableZones = zones.filter((z) => laneEndpointZoneKeys.has(z.zone_key));
    const entryAnchors = mapMode === 'homeNetwork' && temporaryHome && !selectedZoneKey
      ? findEntryAnchors(renderableZones, temporaryHome, data.metadata.zone_radius_miles, entryStrictness)
      : [];
    const homeBaseQuality = mapMode === 'homeNetwork' && !selectedZoneKey && !temporaryHome
      ? buildHomeBaseQuality(lanes, renderableZones, homeNetworkMaxLegs)
      : new Map<string, HomeBaseQuality>();
    const homeNetwork = mapMode === 'homeNetwork'
      ? selectedZoneKey
        ? buildHomeNetwork(lanes, zones, selectedZoneKey, homeNetworkMaxLegs)
        : buildHomeNetworkFromAnchors(lanes, zones, entryAnchors.map((a) => a.zoneKey), homeNetworkMaxLegs)
      : new Map<string, HomeNetworkNode>();

    // Network mode: apply preset thresholds via core's applyZoneFilters, then gate
    // by tier visibility. Re-uses the same filter primitives that downstream
    // routes-search will use, so insights map and order ranking stay aligned.
    const presetThresholds: ZoneFilterThresholds = PRESET_THRESHOLDS[activePreset];
    const networkSignals: ZoneSignals[] = mapMode === 'network' ? renderableZones.map((z) => ({
      zoneKey: z.zone_key,
      outboundLoadCount: z.outbound_load_count,
      inboundLoadCount: z.inbound_load_count,
      outboundEntropy: z.outbound_entropy,
      outboundLaneCount: z.outbound_lane_count,
      daysSinceLastOutbound: z.outbound_days_since_last_load ?? null,
      outboundActiveDays: z.outbound_active_days ?? 0,
      outboundMedianWaitDays: z.outbound_median_wait_days ?? null,
      outboundMedianRatePerMile: z.outbound_median_rate_per_mile ?? null,
      outboundReturnStrength: z.outbound_return_strength ?? 0,
    })) : [];
    const filterPassByZone = mapMode === 'network'
      ? new Map(applyZoneFilters(networkSignals, presetThresholds).map((r) => [r.zoneKey, r.passes]))
      : new Map<string, boolean>();

    // Map mode controls zone visibility and color; Traffic filter only affects lane display on click.
    const zonePassesFilters = (z: FreightZoneSummary) => {
      if (mapMode === 'homeNetwork') {
        if (temporaryHome && !selectedZoneKey) {
          const homeNode = homeNetwork.get(z.zone_key);
          return !!homeNode && activeHomeNetworkBuckets.has(homeNode.bucket);
        }
        if (!selectedZoneKey) {
          const quality = homeBaseQuality.get(z.zone_key);
          return !!quality && quality.networkZoneCount > 1 && activeHomeNetworkBuckets.has(quality.bucket);
        }
        const homeNode = homeNetwork.get(z.zone_key);
        return !!homeNode && activeHomeNetworkBuckets.has(homeNode.bucket);
      }
      // Network mode: must have a quality score, must pass preset thresholds,
      // tier must be in the user's active visibility set.
      if (!z.quality) return false;
      if (!filterPassByZone.get(z.zone_key)) return false;
      return activeZoneTiers.has(z.quality.tier);
    };

    // Quality lanes: tier-filtered, drives the unselected global map view only.
    const qualityLanes = lanes.filter((l) => {
      const o = zoneMap.get(l.origin_zone_key);
      const d = zoneMap.get(l.destination_zone_key);
      return o && d && zonePassesFilters(o) && zonePassesFilters(d);
    });

    // Raw lanes: both zones exist in data, no tier/preset filter.
    // Used for the selected-zone view so ALL historical connections are shown,
    // independent of what the tier toggle is set to.
    const rawLanes = lanes.filter(
      (l) => zoneMap.has(l.origin_zone_key) && zoneMap.has(l.destination_zone_key)
    );

    const laneZoneKeys = new Set(qualityLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));

    // When zone detail is loaded, replace outbound lanes with complete set (no top-75 cap).
    // Inbound lanes (rawLanes filtered to destination=selected) still come from global data.
    const lanePool = (mapMode === 'network' && selectedZoneKey)
      ? (detailLanes.length > 0
          ? [
              ...detailLanes,
              ...rawLanes.filter((l) => l.destination_zone_key === selectedZoneKey),
            ]
          : rawLanes)
      : qualityLanes;

    // Lanes touching the selected zone — both endpoints' perspectives.
    // Bidirectional (transit) lanes contain both an outbound and inbound flow:
    //   source on  → render outbound comet (selected → other endpoint)
    //   sink on    → render inbound comet (other endpoint → selected)
    //   both on    → render both comets (legacy "transit" appearance)
    // Non-bidirectional lanes have a single fixed direction:
    //   origin=selected (outbound) → shown only with source on
    //   dest=selected   (inbound)  → shown only with sink on

    const sourceOn = activeFlowTypes.has('source');
    const sinkOn = activeFlowTypes.has('sink');

    const lanesAtSelected = selectedZoneKey
      ? lanePool.filter(
          (l) => l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey
        )
      : [];

    const bidirBothLanes: FreightLaneEntry[] = [];   // bidirectional + both filters → both comets
    const outboundDirectLanes: FreightLaneEntry[] = []; // single outbound comet (selected → other)
    const inboundDirectLanes: FreightLaneEntry[] = [];  // single inbound comet (other → selected)

    for (const l of lanesAtSelected) {
      const isBi = isSupportedReverseLane(l);
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

    // Local tier re-rank: when a zone is selected in network mode, score ALL
    // historical outbound destinations from this hub relative to each other.
    // Scored from rawLanes (not quality-filtered) so tier toggle doesn't affect
    // which destinations exist or how they rank.
    // Score = lane.load_count × dest optionality subscore.
    // Rank order: gold (best) → silver(s) → bronze (weakest).
    const localTierByZone = new Map<string, ZoneTier>();
    if (mapMode === 'network' && selectedZoneKey) {
      const allRawOutbound = allDetailLanes.length > 0
        ? allDetailLanes
        : rawLanes.filter((l) => l.origin_zone_key === selectedZoneKey);
      const scored = allRawOutbound.map((l) => {
        const dest = zoneMap.get(l.destination_zone_key);
        const score = l.load_count * (dest?.quality?.subscores.optionality ?? 0);
        return { destKey: l.destination_zone_key, score };
      });
      if (scored.length > 0) {
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        const n = scored.length;
        sorted.forEach(({ destKey }, i) => {
          const pct = n === 1 ? 0 : i / (n - 1);
          const tier: ZoneTier = pct < 0.34 ? 'gold' : pct < 0.67 ? 'silver' : 'bronze';
          localTierByZone.set(destKey, tier);
        });
      }
    }

    const directShownLanes = mapMode === 'homeNetwork' && (selectedZoneKey || temporaryHome)
      ? qualityLanes
      : [...bidirBothLanes, ...outboundDirectLanes, ...inboundDirectLanes];

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
    // Per-zone BFS depth from selected; lets us draw bidir component-lane comets
    // along the shortest-path direction instead of the canonical origin→dest order.
    let forwardDepth: Map<string, number> = new Map();
    let reverseDepth: Map<string, number> = new Map();
    if (expandNetwork && selectedZoneKey) {
      const forwardAdj = new Map<string, Set<string>>();
      const reverseAdj = new Map<string, Set<string>>();

      for (const l of qualityLanes) {
        if (isSupportedReverseLane(l)) {
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

      forwardDepth = sourceOn ? bfsDepth(forwardAdj, selectedZoneKey) : new Map([[selectedZoneKey, 0]]);
      reverseDepth = sinkOn ? bfsDepth(reverseAdj, selectedZoneKey) : new Map([[selectedZoneKey, 0]]);

      componentLanes = qualityLanes.filter((l) => {
        if (l.origin_zone_key === selectedZoneKey || l.destination_zone_key === selectedZoneKey) return false;
        if (sourceOn
          && forwardDepth.has(l.origin_zone_key)
          && forwardDepth.has(l.destination_zone_key)) return true;
        if (sinkOn
          && reverseDepth.has(l.origin_zone_key)
          && reverseDepth.has(l.destination_zone_key)) return true;
        return false;
      });
    }

    const allShownLanes = [...directShownLanes, ...componentLanes];

    // BFS through traffic-filtered lanes only — zones reachable from selection
    // Prevents disconnected clusters that pass traffic filter from appearing
    const connectedZoneKeys = selectedZoneKey && mapMode !== 'homeNetwork'
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
    // Idle view: show zones that pass the selected module's filters.
    const activeZones = zones.filter((z) => {
      if (mapMode === 'homeNetwork' && temporaryHome && !selectedZoneKey) return zonePassesFilters(z);
      if (mapMode === 'homeNetwork' && selectedZoneKey) return zonePassesFilters(z);
      if (connectedZoneKeys) return connectedZoneKeys.has(z.zone_key);
      if (!laneZoneKeys.has(z.zone_key)) return false;
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

    // Build bezier-arc geometry for every lane that needs animated dash flow.
    // Direct lanes touch selected (outbound = leaves selected, inbound = enters selected).
    // Chain lanes are component-expansion lanes (transitive forward/reverse hops).
    // Inbound uses side=+1 (matching outbound) so bulge lands on opposite physical side
    // from outbound — without the flip, direction reversal cancels with side=-1 and
    // the two arcs of a bidirectional lane render on the exact same path.
    const laneArcs: LaneArc[] = [];

    const outboundFromTo = (l: FreightLaneEntry): [[number, number], [number, number]] => {
      const rev = l.destination_zone_key === selectedZoneKey;
      return [
        rev ? [l.destination_centroid_lng, l.destination_centroid_lat] : [l.origin_centroid_lng, l.origin_centroid_lat],
        rev ? [l.origin_centroid_lng, l.origin_centroid_lat] : [l.destination_centroid_lng, l.destination_centroid_lat],
      ];
    };
    const inboundFromTo = (l: FreightLaneEntry): [[number, number], [number, number]] => {
      const rev = l.origin_zone_key === selectedZoneKey;
      return [
        rev ? [l.destination_centroid_lng, l.destination_centroid_lat] : [l.origin_centroid_lng, l.origin_centroid_lat],
        rev ? [l.origin_centroid_lng, l.origin_centroid_lat] : [l.destination_centroid_lng, l.destination_centroid_lat],
      ];
    };

    for (const l of [...bidirBothLanes, ...outboundDirectLanes]) {
      const [from, to] = outboundFromTo(l);
      laneArcs.push(buildLaneArc(from, to, 1, 'outbound', true));
    }
    for (const l of [...bidirBothLanes, ...inboundDirectLanes]) {
      const [from, to] = inboundFromTo(l);
      laneArcs.push(buildLaneArc(from, to, 1, 'inbound', true));
    }

    // Component (full network) lanes: direction follows BFS depth so dashes flow
    // away from selected for forward chain, toward selected for reverse chain.
    for (const l of componentLanes) {
      const inForward = sourceOn
        && forwardDepth.has(l.origin_zone_key)
        && forwardDepth.has(l.destination_zone_key);
      const inReverse = sinkOn
        && reverseDepth.has(l.origin_zone_key)
        && reverseDepth.has(l.destination_zone_key);
      if (inForward) {
        const od = forwardDepth.get(l.origin_zone_key)!;
        const dd = forwardDepth.get(l.destination_zone_key)!;
        // Lower depth → higher depth: continuation of outbound flow
        const [from, to]: [[number, number], [number, number]] = od <= dd
          ? [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]]
          : [[l.destination_centroid_lng, l.destination_centroid_lat], [l.origin_centroid_lng, l.origin_centroid_lat]];
        laneArcs.push(buildLaneArc(from, to, 1, 'forwardChain', false));
      } else if (inReverse) {
        const od = reverseDepth.get(l.origin_zone_key)!;
        const dd = reverseDepth.get(l.destination_zone_key)!;
        // Lower reverse depth = closer to selected; flow goes deeper-depth → selected
        const [from, to]: [[number, number], [number, number]] = od >= dd
          ? [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]]
          : [[l.destination_centroid_lng, l.destination_centroid_lat], [l.origin_centroid_lng, l.origin_centroid_lat]];
        laneArcs.push(buildLaneArc(from, to, 1, 'reverseChain', false));
      }
    }

    const NODE_RADIUS_PX = 10;
    const NODE_STROKE_PX = 1;

    // Color resolver per active map mode:
    //  • network — tier color from server-computed quality.tier (gold/silver/bronze/dim)
    //  • homeNetwork (idle) — heat ramp on home-base normalized score
    //  • homeNetwork (selected/temp) — discrete bucket color from network membership
    const pickZoneColor = (z: FreightZoneSummary): [number, number, number] => {
      if (mapMode === 'network') {
        // When a hub is selected, destination nodes show local tier (rank among THIS hub's
        // options) rather than global tier, so the user sees relative quality from here.
        const localTier = localTierByZone.get(z.zone_key);
        return TIER_COLOR[localTier ?? z.quality?.tier ?? 'dim'];
      }
      if (!selectedZoneKey && !temporaryHome) {
        return homeBaseHeatColor(homeBaseQuality.get(z.zone_key)?.normalizedScore ?? 0);
      }
      const bucket = homeNetwork.get(z.zone_key)?.bucket ?? 'low';
      return HOME_NETWORK_COLOR[bucket];
    };

    // Zone dots — color follows the active map mode. Radius and stroke are uniform.
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
        const [r, g, b] = pickZoneColor(z);
        return [r, g, b, Math.round(zoneAlpha(z) * 230)];
      },
      getLineColor: (z) => {
        const [r, g, b] = pickZoneColor(z);
        return [Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30), Math.round(zoneAlpha(z) * 255)];
      },
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          const next = object.zone_key === selectedZoneKey ? null : object.zone_key;
          setSelectedZoneKey(next);
          if (mapMode === 'homeNetwork') setTemporaryHome(null);
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
    // Static crisp halo around selected node. Animated breathing pulse is a
    // separate layer driven by RAF (see animation effect below).
    const haloLayer = selectedZoneOnMap
      ? new ScatterplotLayer<FreightZoneSummary>({
          id: 'zone-halo',
          data: [selectedZoneOnMap],
          getPosition: (z) => [z.centroid_lng, z.centroid_lat],
          radiusUnits: 'pixels',
          getRadius: () => NODE_RADIUS_PX + 5,
          filled: false,
          stroked: true,
          getLineColor: [255, 255, 255, 220],
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          pickable: false,
        })
      : null;
    selectedHaloPosRef.current = selectedZoneOnMap
      ? [selectedZoneOnMap.centroid_lng, selectedZoneOnMap.centroid_lat]
      : null;

    // homeNetwork mode shows wider topology lanes that don't carry an outbound/inbound
    // semantic relative to the selected zone — render them as straight dim connectors
    // distinct from the animated dash treatment.
    const directConnectionSet = new Set<FreightLaneEntry>([...bidirBothLanes, ...outboundDirectLanes, ...inboundDirectLanes]);
    const remainingNetworkLanes = directShownLanes.filter((l) => !directConnectionSet.has(l));
    const networkTrackLayer = remainingNetworkLanes.length > 0 && !!selectedZoneKey ? new PathLayer<FreightLaneEntry>({
      id: 'network-tracks',
      data: remainingNetworkLanes,
      getPath: (l) => [[l.origin_centroid_lng, l.origin_centroid_lat], [l.destination_centroid_lng, l.destination_centroid_lat]],
      getWidth: () => 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      getColor: () => (themeRef.current === 'dark' ? [0, 160, 220, 55] : [0, 80, 150, 55]) as [number, number, number, number],
      pickable: false,
    }) : null;

    // Static dim base trail along every animated arc. Stays visible when animation
    // pauses (tab blur, screenshots) and gives the dashes a track to ride on.
    const baseTrailLayer = laneArcs.length > 0 ? new PathLayer<LaneArc>({
      id: 'lane-base-trails',
      data: laneArcs,
      getPath: (a) => a.pts,
      getColor: (a) => {
        const [r, g, b] = ARC_COLOR[a.kind];
        return [r, g, b, a.isDirect ? 55 : 35] as [number, number, number, number];
      },
      getWidth: (a) => a.isDirect ? 1.5 : 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      capRounded: true,
      jointRounded: true,
      pickable: false,
    }) : null;
    const entryAnchorZones = temporaryHome
      ? entryAnchors
          .map((a) => {
            const zone = zoneMap.get(a.zoneKey);
            return zone ? { anchor: a, zone } : null;
          })
          .filter((v): v is { anchor: typeof entryAnchors[0]; zone: FreightZoneSummary } => v !== null)
      : [];
    const deadheadLayer = temporaryHome
      ? new PathLayer<{ anchor: typeof entryAnchors[0]; zone: FreightZoneSummary }>({
          id: 'home-deadhead-connectors',
          data: entryAnchorZones,
          getPath: ({ zone }) => [[temporaryHome.lng, temporaryHome.lat], [zone.centroid_lng, zone.centroid_lat]],
          getWidth: ({ anchor }) => anchor.outsideRadius ? 2 : 3,
          widthUnits: 'pixels',
          widthMinPixels: 2,
          getColor: ({ anchor }) => anchor.outsideRadius ? [239, 68, 68, 120] : [239, 68, 68, 190],
          pickable: false,
        })
      : null;
    const temporaryHomeLayer = temporaryHome
      ? new ScatterplotLayer<TemporaryHome>({
          id: 'temporary-home-marker',
          data: [temporaryHome],
          getPosition: (h) => [h.lng, h.lat],
          radiusUnits: 'pixels',
          getRadius: 8,
          filled: true,
          stroked: true,
          getFillColor: [239, 68, 68, 240],
          getLineColor: [255, 255, 255, 240],
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          pickable: false,
        })
      : null;

    // Stash arcs + static layers so the RAF loop can re-emit dash + pulse layers
    // each frame without re-running this whole effect. Dash + pulse layers are
    // injected between baseTrailLayer and nodeLayer in the RAF tick.
    arcsRef.current = laneArcs;
    staticLayersRef.current = [
      ...(radiusLayer ? [radiusLayer] : []),
      ...(deadheadLayer ? [deadheadLayer] : []),
      ...(networkTrackLayer ? [networkTrackLayer] : []),
      ...(baseTrailLayer ? [baseTrailLayer] : []),
      // dash layer + pulse layer get spliced in here by the RAF loop
      nodeLayer,
      ...(temporaryHomeLayer ? [temporaryHomeLayer] : []),
      ...(haloLayer ? [haloLayer] : []),
    ];

    // Initial paint without waiting for RAF — guarantees something is drawn even
    // if the animation tick hasn't fired yet.
    overlayRef.current?.setProps({
      layers: staticLayersRef.current,
      onClick: overlayClickRef.current,
    });
  }, [data, selectedZoneKey, temporaryHome, entryStrictness, homeNetworkMaxLegs, mapMode, activePreset, activeZoneTiers, activeDestTiers, activeFlowTypes, activeHomeNetworkBuckets, expandNetwork, allDetailLanes, detailLanes]);

  // Animation loop: marching dashes flow along arcs, pulse breathes around selected node.
  // Reads from refs only — no React state writes per frame, no full effect re-run.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const DASH_CYCLE_MS = 2400;   // one full dash traversal of arc
    const PULSE_CYCLE_MS = 1800;
    const PULSE_BASE_PX = 14;
    const PULSE_AMP_PX = 8;

    const tick = (now: number) => {
      const overlay = overlayRef.current;
      if (overlay) {
        const dashPhase = ((now - start) % DASH_CYCLE_MS) / DASH_CYCLE_MS;
        const pulseT = ((now - start) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
        // Ease-out expansion + fade: large + faint near end of cycle
        const radius = PULSE_BASE_PX + PULSE_AMP_PX * pulseT;
        const pulseAlpha = Math.round(180 * (1 - pulseT));

        const dashSegs = arcsRef.current.length > 0
          ? buildDashSubsegs(arcsRef.current, dashPhase)
          : [];

        const dashLayer = dashSegs.length > 0 ? new PathLayer<ArcSubseg>({
          id: 'lane-dash-flow',
          data: dashSegs,
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: (d) => d.width,
          widthUnits: 'pixels',
          widthMinPixels: 1.5,
          capRounded: true,
          jointRounded: true,
          pickable: false,
        }) : null;

        const pulseLayer = selectedHaloPosRef.current && pulseAlpha > 0 ? new ScatterplotLayer<{ pos: [number, number] }>({
          id: 'zone-pulse',
          data: [{ pos: selectedHaloPosRef.current }],
          getPosition: (d) => d.pos,
          radiusUnits: 'pixels',
          getRadius: radius,
          filled: false,
          stroked: true,
          getLineColor: [255, 255, 255, pulseAlpha],
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          pickable: false,
          updateTriggers: { getRadius: radius, getLineColor: pulseAlpha },
        }) : null;

        // Splice dash + pulse into the static layer list just before nodeLayer.
        // Find nodeLayer position; fall back to appending if not found.
        const layers = staticLayersRef.current.slice();
        const nodeIdx = layers.findIndex((l) => (l as { id?: string })?.id === 'zone-nodes');
        const insertIdx = nodeIdx >= 0 ? nodeIdx : layers.length;
        const animated = [
          ...(dashLayer ? [dashLayer] : []),
          ...(pulseLayer ? [pulseLayer] : []),
        ];
        layers.splice(insertIdx, 0, ...animated);

        overlay.setProps({ layers, onClick: overlayClickRef.current });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const noData = data.lanes.length === 0 && data.zones.length === 0;
  const tempHomeSummary = useMemo(
    () => temporaryHomeSummary(
      data.lanes, data.zones, temporaryHome,
      data.metadata.zone_radius_miles, entryStrictness, homeNetworkMaxLegs,
    ),
    [data.lanes, data.zones, temporaryHome, data.metadata.zone_radius_miles, entryStrictness, homeNetworkMaxLegs],
  );
  const nearestEntryAnchor = tempHomeSummary?.entryAnchors[0] ?? null;
  const strongestEntryAnchor = tempHomeSummary?.entryAnchors
    .slice()
    .sort((a, b) => (b.zone.outbound_load_count + b.zone.inbound_load_count) - (a.zone.outbound_load_count + a.zone.inbound_load_count))[0] ?? null;

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden" />

      {noData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 border rounded-lg px-6 py-4 text-center">
            <p className="text-sm font-medium">No historical lanes found for this period.</p>
            <p className="text-xs text-muted-foreground mt-1">Try a longer period or check that orders are synced.</p>
          </div>
        </div>
      )}

      {selectedZoneKey && zoneDetail.isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-background/90 border rounded-md px-3 py-1.5 text-sm text-muted-foreground">
            Loading zone detail…
          </div>
        </div>
      )}

      {!selectedZoneKey && !hoveredZone && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
          <p className="text-xs text-muted-foreground/60 italic">
            {mapMode === 'homeNetwork'
              ? temporaryHome ? 'Right-click another spot to move temporary home' : 'Click a hub or right-click the map to set home'
              : 'Click any hub to see its lanes'}
          </p>
        </div>
      )}

      {selectedZone && (
        <div className="absolute top-20 left-4 z-10 max-h-[calc(100%-6rem)] overflow-y-auto">
          <ZoneTooltip
            zone={selectedZone}
            period={period}
            mode={mapMode}
            visualBucket={zoneBucket(selectedZone)}
            homeSelected={mapMode === 'homeNetwork' && (!!selectedZoneKey || !!temporaryHome)}
            showClose
            onClose={handleCloseZonePanel}
          />
        </div>
      )}

      {!selectedZone && hoveredZone && (
        <div className="absolute top-20 left-4 z-10 max-h-[calc(100%-6rem)] overflow-y-auto pointer-events-none">
          <ZoneTooltip
            zone={hoveredZone}
            period={period}
            mode={mapMode}
            visualBucket={zoneBucket(hoveredZone)}
            homeSelected={mapMode === 'homeNetwork' && (!!selectedZoneKey || !!temporaryHome)}
          />
        </div>
      )}

      {mapMode === 'homeNetwork' && temporaryHome && !selectedZone && !hoveredZone && tempHomeSummary && (
        <div className="absolute top-20 left-4 z-10 max-h-[calc(100%-6rem)] overflow-y-auto">
          <div className="bg-background/95 border rounded-lg shadow-lg p-5 min-w-[320px] max-w-[390px] text-base">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="font-semibold text-base">Temporary Home</p>
                <p className="text-base mt-1 text-muted-foreground">
                  Entry network from nearby freight anchors.
                </p>
              </div>
              <button
                onClick={() => setTemporaryHome(null)}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none mt-0.5"
                aria-label="Clear temporary home"
              >
                ×
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
              <dt className="text-muted-foreground">Entry anchors</dt>
              <dd className="font-medium">{tempHomeSummary.entryAnchors.length}</dd>
              <dt className="text-muted-foreground">Network zones</dt>
              <dd className="font-medium">{tempHomeSummary.networkZoneCount}</dd>
              <dt className="text-muted-foreground">Search radius</dt>
              <dd className="font-medium">{data.metadata.zone_radius_miles} mi</dd>
              <dt className="text-muted-foreground">Entry filter</dt>
              <dd className="font-medium capitalize">{entryStrictness}</dd>
              <dt className="text-muted-foreground">Max network legs</dt>
              <dd className="font-medium">{homeNetworkMaxLegs}</dd>
              <dt className="text-muted-foreground">Nearest anchor</dt>
              <dd className="font-medium">
                {nearestEntryAnchor ? `${nearestEntryAnchor.zone.display_city}, ${nearestEntryAnchor.zone.display_state} (${Math.round(nearestEntryAnchor.distanceMiles)} mi)` : 'None'}
              </dd>
              <dt className="text-muted-foreground">Highest-volume anchor</dt>
              <dd className="font-medium">
                {strongestEntryAnchor ? `${strongestEntryAnchor.zone.display_city}, ${strongestEntryAnchor.zone.display_state} (${Math.round(strongestEntryAnchor.distanceMiles)} mi)` : 'None'}
              </dd>
            </dl>

            <p className="text-base text-muted-foreground mt-4">
              Red lines show deadhead from home to freight entry anchors.
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto bg-background border rounded-lg px-5 py-4 text-base space-y-3 min-w-[300px]">
        <div>
          <p className="font-semibold text-base">Mode</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
            {([
              { mode: 'network', label: 'Network' },
              { mode: 'homeNetwork', label: 'Home' },
            ] as const).map(({ mode, label }) => {
              const active = mapMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMapMode(mode)}
                  aria-pressed={active}
                  className={`h-8 rounded-sm border px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Traffic filter — controls lanes shown on zone click. Always visible in
            Network and Home modes since both can render bidirectional flow. */}
        <p className="font-semibold text-base pt-2 border-t border-border/50">Traffic</p>
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

        {mapMode === 'network' ? (
          <>
            <p className="font-semibold text-base pt-2 border-t border-border/50">Quality preset</p>
            <p className="text-sm text-muted-foreground/60 -mt-2">Threshold gate before tier ranking</p>
            <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1">
              {([
                { value: 'aggressive',   label: 'Loose'   },
                { value: 'balanced',     label: 'Balanced' },
                { value: 'conservative', label: 'Strict'   },
              ] as const).map(({ value, label }) => {
                const active = activePreset === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActivePreset(value)}
                    aria-pressed={active}
                    className={`h-8 rounded-sm border px-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="font-semibold text-base pt-2 border-t border-border/50">{selectedZoneKey ? 'Destination Tiers' : 'Zone Tiers'}</p>
            <p className="text-sm text-muted-foreground/60 -mt-2">{selectedZoneKey ? 'Filter destination nodes by quality tier' : 'Composite score grouped by percentile band'}</p>
            {([
              { tier: 'gold',   dot: 'bg-amber-400',  label: 'Gold (top 10%)' },
              { tier: 'silver', dot: 'bg-slate-300',  label: 'Silver (next 15%)' },
              { tier: 'bronze', dot: 'bg-amber-700',  label: 'Bronze (next 25%)' },
              { tier: 'dim',    dot: 'bg-slate-600',  label: 'Below tier' },
            ] as const).map(({ tier, dot, label }) => {
              const activeTiers = selectedZoneKey ? activeDestTiers : activeZoneTiers;
              const toggle = selectedZoneKey ? toggleDestTier : toggleZoneTier;
              const active = activeTiers.has(tier);
              return (
                <label key={tier} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={active} onChange={() => toggle(tier)} className="sr-only" />
                  <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                    {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
                </label>
              );
            })}
          </>
        ) : (
          <>
            <p className="font-semibold text-base pt-2 border-t border-border/50">Home Network</p>
            <p className="text-sm text-muted-foreground/60 -mt-2">
              {selectedZone
                ? `Home base: ${selectedZone.display_city}, ${selectedZone.display_state}`
                : temporaryHome
                  ? 'Temporary home connects to nearest entry anchors'
                  : 'Heat map compares possible home bases'}
            </p>
            <Select value={entryStrictness} onValueChange={(value) => setEntryStrictness(value as EntryStrictness)}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict entry</SelectItem>
                <SelectItem value="balanced">Balanced entry</SelectItem>
                <SelectItem value="flexible">Flexible entry</SelectItem>
              </SelectContent>
            </Select>
            <Select value={homeNetworkMaxLegs.toString()} onValueChange={(value) => setHomeNetworkMaxLegs(Number(value) as HomeNetworkMaxLegs)}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Max 2 legs</SelectItem>
                <SelectItem value="3">Max 3 legs</SelectItem>
                <SelectItem value="4">Max 4 legs</SelectItem>
              </SelectContent>
            </Select>
            {temporaryHome && !selectedZone && (
              <button
                type="button"
                onClick={() => setTemporaryHome(null)}
                className="h-8 w-full rounded-sm border text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              >
                Clear temporary home
              </button>
            )}
            {([
              { bucket: 'high',   dot: 'bg-green-500', label: 'High (top 33%)' },
              { bucket: 'medium', dot: 'bg-sky-400',   label: 'Medium (middle 33%)' },
              { bucket: 'low',    dot: 'bg-slate-400', label: 'Low (bottom 33%)' },
            ] as const).map(({ bucket, dot, label }) => {
              const active = activeHomeNetworkBuckets.has(bucket);
              return (
                <label key={bucket} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={active} onChange={() => toggleHomeNetworkBucket(bucket)} className="sr-only" />
                  <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                    {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
                </label>
              );
            })}
          </>
        )}

        {/* Expand network — hidden in homeNetwork mode (full network always shown there) */}
        {mapMode !== 'homeNetwork' && (
          <>
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
          </>
        )}

      </div>
    </div>
  );
}
