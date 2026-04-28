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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/web/components/ui/select";
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
type MapMode = 'volume' | 'optionality' | 'homeNetwork';
type VolumeMetric = 'total' | 'outbound' | 'inbound';
type VisualBucket = 'high' | 'medium' | 'low';
type EntryStrictness = 'strict' | 'balanced' | 'flexible';
type HomeNetworkMaxLegs = 2 | 3 | 4;
type TemporaryHome = { lat: number; lng: number };
type HomeNetworkNode = {
  bucket: VisualBucket;
  score: number;
  outboundLegs: number;
  returnLegs: number;
};
type HomeBaseQuality = {
  bucket: VisualBucket;
  score: number;
  normalizedScore: number;
  networkZoneCount: number;
};
type EntryAnchor = {
  zoneKey: string;
  distanceMiles: number;
  outsideRadius: boolean;
};

type TemporaryHomeSummary = {
  entryAnchors: Array<EntryAnchor & { zone: FreightZoneSummary }>;
  networkZoneCount: number;
};

function zoneVolumeValue(z: FreightZoneSummary, metric: VolumeMetric): number {
  if (metric === 'outbound') return z.outbound_load_count;
  if (metric === 'inbound') return z.inbound_load_count;
  return z.outbound_load_count + z.inbound_load_count;
}

function zoneVolumeBucket(
  z: FreightZoneSummary,
  thresholds: { medium_min: number; high_min: number },
  metric: VolumeMetric,
): VisualBucket {
  const value = zoneVolumeValue(z, metric);
  if (value >= thresholds.high_min) return 'high';
  if (value >= thresholds.medium_min) return 'medium';
  return 'low';
}

const VOLUME_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [255, 200,  50],  // gold
  medium: [255, 110,  20],  // orange
  low:    [200,  45,  45],  // red
};

const OPTIONALITY_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [ 16, 185, 129],  // emerald
  medium: [245, 158,  11],  // amber
  low:    [239,  68,  68],  // red
};

const HOME_NETWORK_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [ 34, 197,  94],  // green
  medium: [ 56, 189, 248],  // sky
  low:    [148, 163, 184],  // slate
};

const ENTRY_STRICTNESS: Record<EntryStrictness, {
  maxWaitDays: number;
  minDataSupport: FreightZoneSummary['data_support'];
  allowOutsideRadiusFallback: boolean;
}> = {
  strict: { maxWaitDays: 1, minDataSupport: 'high', allowOutsideRadiusFallback: false },
  balanced: { maxWaitDays: 3, minDataSupport: 'medium', allowOutsideRadiusFallback: false },
  flexible: { maxWaitDays: 7, minDataSupport: 'low', allowOutsideRadiusFallback: true },
};

const DATA_SUPPORT_RANK: Record<FreightZoneSummary['data_support'], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function distanceMiles(a: TemporaryHome, b: { centroid_lat: number; centroid_lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(b.centroid_lat - a.lat);
  const dLng = toRad(b.centroid_lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.centroid_lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(h));
}

function zoneWaitDays(z: FreightZoneSummary): number | null {
  if ('outbound_median_wait_days' in z && typeof z.outbound_median_wait_days === 'number') {
    return z.outbound_median_wait_days;
  }
  return null;
}

function isViableEntryAnchor(z: FreightZoneSummary, strictness: EntryStrictness): boolean {
  const config = ENTRY_STRICTNESS[strictness];
  const wait = zoneWaitDays(z);
  const waitPasses = wait === null ? strictness === 'flexible' : wait <= config.maxWaitDays;
  return waitPasses && DATA_SUPPORT_RANK[z.data_support] >= DATA_SUPPORT_RANK[config.minDataSupport];
}

function findEntryAnchors(
  zones: FreightZoneSummary[],
  home: TemporaryHome | null,
  radiusMiles: number,
  strictness: EntryStrictness,
): EntryAnchor[] {
  if (!home) return [];
  const allByDistance = zones
    .map((z) => ({
      zone: z,
      distanceMiles: distanceMiles(home, z),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
  const candidates = allByDistance.filter(({ zone }) => isViableEntryAnchor(zone, strictness));

  const insideRadius = candidates
    .filter((c) => c.distanceMiles <= radiusMiles)
    .map((c) => ({ zoneKey: c.zone.zone_key, distanceMiles: c.distanceMiles, outsideRadius: false }));
  if (insideRadius.length > 0 || !ENTRY_STRICTNESS[strictness].allowOutsideRadiusFallback) {
    const fallback = insideRadius.length > 0
      ? insideRadius
      : allByDistance.map((c) => ({
          zoneKey: c.zone.zone_key,
          distanceMiles: c.distanceMiles,
          outsideRadius: c.distanceMiles > radiusMiles,
        }));
    return fallback.slice(0, 4);
  }
  const flexibleFallback = candidates.length > 0 ? candidates : allByDistance;
  return flexibleFallback
    .slice(0, 3)
    .map((c) => ({ zoneKey: c.zone.zone_key, distanceMiles: c.distanceMiles, outsideRadius: c.distanceMiles > radiusMiles }));
}

function temporaryHomeSummary(
  lanes: FreightLaneEntry[],
  zones: FreightZoneSummary[],
  home: TemporaryHome | null,
  radiusMiles: number,
  strictness: EntryStrictness,
  maxLegs: HomeNetworkMaxLegs,
): TemporaryHomeSummary | null {
  if (!home) return null;
  const laneEndpointZoneKeys = new Set(lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
  const renderableZones = zones.filter((z) => laneEndpointZoneKeys.has(z.zone_key));
  const zoneByKey = new Map(zones.map((z) => [z.zone_key, z]));
  const entryAnchors = findEntryAnchors(renderableZones, home, radiusMiles, strictness)
    .map((anchor) => {
      const zone = zoneByKey.get(anchor.zoneKey);
      return zone ? { ...anchor, zone } : null;
    })
    .filter((v): v is EntryAnchor & { zone: FreightZoneSummary } => v !== null);
  const homeNetwork = buildHomeNetworkFromAnchors(lanes, zones, entryAnchors.map((a) => a.zoneKey), maxLegs);
  return {
    entryAnchors,
    networkZoneCount: homeNetwork.size,
  };
}

function interpolateColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

function homeBaseHeatColor(score: number): [number, number, number] {
  if (score < 0.5) {
    return interpolateColor([239, 68, 68], [245, 158, 11], score / 0.5);
  }
  return interpolateColor([245, 158, 11], [34, 197, 94], (score - 0.5) / 0.5);
}

function isSupportedReverseLane(l: FreightLaneEntry): boolean {
  return l.reverse_strength === 'strong_visible' || l.reverse_strength === 'strong_truncated';
}

function addEdge(adj: Map<string, Set<string>>, from: string, to: string) {
  if (!adj.has(from)) adj.set(from, new Set());
  adj.get(from)!.add(to);
}

function buildDirectedAdjacency(lanes: FreightLaneEntry[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const l of lanes) {
    addEdge(adj, l.origin_zone_key, l.destination_zone_key);
    if (isSupportedReverseLane(l)) addEdge(adj, l.destination_zone_key, l.origin_zone_key);
  }
  return adj;
}

function reverseAdjacency(adj: Map<string, Set<string>>): Map<string, Set<string>> {
  const reversed = new Map<string, Set<string>>();
  for (const [from, tos] of adj.entries()) {
    for (const to of tos) addEdge(reversed, to, from);
  }
  return reversed;
}

function bfsDepth(adj: Map<string, Set<string>>, start: string, maxDepth: number): Map<string, number> {
  const depth = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const currentDepth = depth.get(cur)!;
    if (currentDepth >= maxDepth) continue;
    for (const next of adj.get(cur) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  return depth;
}

function buildHomeNetwork(
  lanes: FreightLaneEntry[],
  zones: FreightZoneSummary[],
  homeZoneKey: string | null,
  maxLegs: HomeNetworkMaxLegs,
): Map<string, HomeNetworkNode> {
  if (!homeZoneKey) return new Map();
  return buildHomeNetworkFromAnchors(lanes, zones, [homeZoneKey], maxLegs);
}

function buildHomeNetworkFromAnchors(
  lanes: FreightLaneEntry[],
  zones: FreightZoneSummary[],
  homeZoneKeys: string[],
  maxLegs: HomeNetworkMaxLegs,
): Map<string, HomeNetworkNode> {
  if (homeZoneKeys.length === 0) return new Map();

  const forward = buildDirectedAdjacency(lanes);
  const backward = reverseAdjacency(forward);
  const mergeDepths = (adj: Map<string, Set<string>>) => {
    const merged = new Map<string, number>();
    for (const homeZoneKey of homeZoneKeys) {
      const depths = bfsDepth(adj, homeZoneKey, maxLegs);
      for (const [zoneKey, depth] of depths.entries()) {
        const existing = merged.get(zoneKey);
        if (existing === undefined || depth < existing) merged.set(zoneKey, depth);
      }
    }
    return merged;
  };
  const reachableFromHome = mergeDepths(forward);
  const canReturnHome = mergeDepths(backward);
  const candidates = zones
    .map((z) => {
      const outboundLegs = reachableFromHome.get(z.zone_key);
      const returnLegs = canReturnHome.get(z.zone_key);
      if (outboundLegs === undefined || returnLegs === undefined) return null;
      if (outboundLegs > maxLegs || returnLegs > maxLegs) return null;
      const volumeScore = Math.min(20, Math.log1p(z.outbound_load_count + z.inbound_load_count) * 4);
      const optionalityScore = Math.min(12, z.outbound_entropy * 4);
      const waitPenalty =
        'outbound_median_wait_days' in z && typeof z.outbound_median_wait_days === 'number'
          ? Math.min(18, Math.max(0, z.outbound_median_wait_days - 1) * 3)
          : 0;
      const score = Math.max(
        0,
        100 - outboundLegs * 18 - returnLegs * 18 + volumeScore + optionalityScore - waitPenalty,
      );
      return { zoneKey: z.zone_key, score, outboundLegs, returnLegs };
    })
    .filter((v): v is { zoneKey: string; score: number; outboundLegs: number; returnLegs: number } => v !== null)
    .sort((a, b) => a.score - b.score);

  const percentile = (p: number) =>
    candidates.length === 0 ? 0 : candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * p))].score;
  const mediumMin = percentile(1 / 3);
  const highMin = percentile(2 / 3);
  return new Map(candidates.map((c) => [
    c.zoneKey,
    {
      bucket: c.score >= highMin ? 'high' : c.score >= mediumMin ? 'medium' : 'low',
      score: c.score,
      outboundLegs: c.outboundLegs,
      returnLegs: c.returnLegs,
    },
  ]));
}

function buildHomeBaseQuality(
  lanes: FreightLaneEntry[],
  zones: FreightZoneSummary[],
  maxLegs: HomeNetworkMaxLegs,
): Map<string, HomeBaseQuality> {
  const forward = buildDirectedAdjacency(lanes);
  const backward = reverseAdjacency(forward);
  const rawScores = zones.map((z) => {
    const reachableFromHome = bfsDepth(forward, z.zone_key, maxLegs);
    const canReturnHome = bfsDepth(backward, z.zone_key, maxLegs);
    const reachableCount = Math.max(0, reachableFromHome.size - 1);
    let networkCount = 0;
    for (const zoneKey of reachableFromHome.keys()) {
      if (canReturnHome.has(zoneKey)) networkCount += 1;
    }
    const networkZoneCount = networkCount;
    const trapCount = Math.max(0, reachableCount - Math.max(0, networkCount - 1));
    const totalLoads = z.outbound_load_count + z.inbound_load_count;
    if (networkCount <= 1) {
      return { zoneKey: z.zone_key, score: 0, networkZoneCount };
    }
    const volumeScore = Math.log1p(totalLoads) * 5;
    const optionalityScore = z.outbound_entropy * 8;
    const networkScore = networkCount * 8;
    const returnCoverageScore = reachableCount === 0 ? 0 : (networkCount / (reachableCount + 1)) * 30;
    const trapPenalty = trapCount * 12;
    return {
      zoneKey: z.zone_key,
      score: Math.max(0, networkScore + returnCoverageScore + volumeScore + optionalityScore - trapPenalty),
      networkZoneCount,
    };
  }).sort((a, b) => a.score - b.score);

  const percentile = (p: number) =>
    rawScores.length === 0 ? 0 : rawScores[Math.min(rawScores.length - 1, Math.floor(rawScores.length * p))].score;
  const low = rawScores[0]?.score ?? 0;
  const high = rawScores[rawScores.length - 1]?.score ?? 0;
  const mediumMin = percentile(1 / 3);
  const highMin = percentile(2 / 3);

  return new Map(rawScores.map((s) => [
    s.zoneKey,
    {
      score: s.score,
      normalizedScore: high === low ? 1 : (s.score - low) / (high - low),
      bucket: s.score >= highMin ? 'high' : s.score >= mediumMin ? 'medium' : 'low',
      networkZoneCount: s.networkZoneCount,
    },
  ]));
}

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
  const [mapMode, setMapMode] = useState<MapMode>('volume');
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('total');
  const [temporaryHome, setTemporaryHome] = useState<TemporaryHome | null>(null);
  const [entryStrictness, setEntryStrictness] = useState<EntryStrictness>('balanced');
  const [homeNetworkMaxLegs, setHomeNetworkMaxLegs] = useState<HomeNetworkMaxLegs>(3);
  const [activeFlowTypes, setActiveFlowTypes] = useState<Set<FlowType>>(new Set(['source', 'sink']));
  const [activeVolumeBuckets, setActiveVolumeBuckets] = useState<Set<VisualBucket>>(new Set(['high', 'medium', 'low']));
  const [activeOptionalityBuckets, setActiveOptionalityBuckets] = useState<Set<VisualBucket>>(new Set(['high', 'medium', 'low']));
  const [activeHomeNetworkBuckets, setActiveHomeNetworkBuckets] = useState<Set<VisualBucket>>(new Set(['high', 'medium', 'low']));
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
    if (!info.picked) {
      setSelectedZoneKey(null);
      setTemporaryHome(null);
    }
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
    setActiveFlowTypes((prev) => {
      const n = new Set(prev);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });
  };
  const toggleVolumeBucket = (b: VisualBucket) => {
    setActiveVolumeBuckets((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  };
  const toggleOptionalityBucket = (b: VisualBucket) => {
    setActiveOptionalityBuckets((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  };
  const toggleHomeNetworkBucket = (b: VisualBucket) => {
    setActiveHomeNetworkBuckets((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  };

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;
  const zoneBucket = useCallback((zone: FreightZoneSummary): VisualBucket => {
    if (mapMode === 'homeNetwork') {
      if (temporaryHome && !selectedZoneKey) {
        const laneEndpointZoneKeys = new Set(data.lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
        const renderableZones = data.zones.filter((z) => laneEndpointZoneKeys.has(z.zone_key));
        const anchors = findEntryAnchors(renderableZones, temporaryHome, data.metadata.zone_radius_miles, entryStrictness);
        return buildHomeNetworkFromAnchors(data.lanes, data.zones, anchors.map((a) => a.zoneKey), homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low';
      }
      return selectedZoneKey
        ? buildHomeNetwork(data.lanes, data.zones, selectedZoneKey, homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low'
        : buildHomeBaseQuality(data.lanes, data.zones, homeNetworkMaxLegs).get(zone.zone_key)?.bucket ?? 'low';
    }
    if (mapMode === 'optionality') {
      return zone.optionality_bucket === 'high' || zone.optionality_bucket === 'medium'
        ? zone.optionality_bucket
        : 'low';
    }

    const laneEndpointZoneKeys = new Set(data.lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
    const volumeValues = data.zones
      .filter((z) => laneEndpointZoneKeys.has(z.zone_key))
      .map((z) => zoneVolumeValue(z, volumeMetric))
      .sort((a, b) => a - b);
    const percentile = (p: number) =>
      volumeValues.length === 0 ? 0 : volumeValues[Math.min(volumeValues.length - 1, Math.floor(volumeValues.length * p))];
    const thresholds = volumeValues.length >= 6
      ? { medium_min: percentile(1 / 3), high_min: percentile(2 / 3) }
      : data.metadata.data_support_thresholds;
    return zoneVolumeBucket(zone, thresholds, volumeMetric);
  }, [data.lanes, data.metadata.data_support_thresholds, data.metadata.zone_radius_miles, data.zones, entryStrictness, homeNetworkMaxLegs, mapMode, selectedZoneKey, temporaryHome, volumeMetric]);

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

    // Dynamic volume thresholds — partition non-low_data zones at the 33rd and 66th
    // percentiles of (outbound + inbound) total. The fixed API thresholds (10/50)
    // collapsed mercer prod into a single high bucket because most surviving zones
    // exceed 50; percentile thresholds keep the legend meaningful regardless of
    // tenant-specific volume scale.
    const apiThresholds = data.metadata.data_support_thresholds;
    const zoneMap = new Map(zones.map((z) => [z.zone_key, z]));
    const laneEndpointZoneKeys = new Set(lanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));
    const renderableZones = zones.filter((z) => laneEndpointZoneKeys.has(z.zone_key));
    const entryAnchors = mapMode === 'homeNetwork' && temporaryHome && !selectedZoneKey
      ? findEntryAnchors(renderableZones, temporaryHome, data.metadata.zone_radius_miles, entryStrictness)
      : [];
    const entryAnchorZoneKeys = new Set(entryAnchors.map((a) => a.zoneKey));
    const homeBaseQuality = mapMode === 'homeNetwork' && !selectedZoneKey && !temporaryHome
      ? buildHomeBaseQuality(lanes, renderableZones, homeNetworkMaxLegs)
      : new Map<string, HomeBaseQuality>();
    const volumeValues = renderableZones
      .map((z) => zoneVolumeValue(z, volumeMetric))
      .sort((a, b) => a - b);
    const percentile = (p: number) =>
      volumeValues.length === 0 ? 0 : volumeValues[Math.min(volumeValues.length - 1, Math.floor(volumeValues.length * p))];
    const volThresholds = volumeValues.length >= 6
      ? { medium_min: percentile(1 / 3), high_min: percentile(2 / 3) }
      : apiThresholds;
    const homeNetwork = mapMode === 'homeNetwork'
      ? selectedZoneKey
        ? buildHomeNetwork(lanes, zones, selectedZoneKey, homeNetworkMaxLegs)
        : buildHomeNetworkFromAnchors(lanes, zones, entryAnchors.map((a) => a.zoneKey), homeNetworkMaxLegs)
      : new Map<string, HomeNetworkNode>();
    const zoneVisualBucket = (z: FreightZoneSummary): VisualBucket =>
      mapMode === 'homeNetwork'
        ? selectedZoneKey
          ? homeNetwork.get(z.zone_key)?.bucket ?? 'low'
          : temporaryHome
            ? homeNetwork.get(z.zone_key)?.bucket ?? (entryAnchorZoneKeys.has(z.zone_key) ? 'low' : 'low')
            : homeBaseQuality.get(z.zone_key)?.bucket ?? 'low'
        : mapMode === 'optionality'
        ? z.optionality_bucket === 'high' || z.optionality_bucket === 'medium' ? z.optionality_bucket : 'low'
        : zoneVolumeBucket(z, volThresholds, volumeMetric);

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
      if (mapMode === 'optionality') {
        return z.optionality_bucket !== 'low_data' && activeOptionalityBuckets.has(zoneVisualBucket(z));
      }
      return activeVolumeBuckets.has(zoneVisualBucket(z));
    };

    // Mode filter always applies to both endpoints — non-matching zones
    // never appear on map or as connected segments, even when a zone is selected.
    const qualityLanes = lanes.filter((l) => {
      const o = zoneMap.get(l.origin_zone_key);
      const d = zoneMap.get(l.destination_zone_key);
      return o && d && zonePassesFilters(o) && zonePassesFilters(d);
    });

    const laneZoneKeys = new Set(qualityLanes.flatMap((l) => [l.origin_zone_key, l.destination_zone_key]));

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
      ? qualityLanes.filter(
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

      const bfsWithDepth = (adj: Map<string, Set<string>>, start: string) => {
        const depth = new Map<string, number>([[start, 0]]);
        const queue = [start];
        while (queue.length) {
          const cur = queue.shift()!;
          const d = depth.get(cur)!;
          for (const nb of adj.get(cur) ?? []) {
            if (!depth.has(nb)) { depth.set(nb, d + 1); queue.push(nb); }
          }
        }
        return depth;
      };

      forwardDepth = sourceOn ? bfsWithDepth(forwardAdj, selectedZoneKey) : new Map([[selectedZoneKey, 0]]);
      reverseDepth = sinkOn ? bfsWithDepth(reverseAdj, selectedZoneKey) : new Map([[selectedZoneKey, 0]]);

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

    // Component lane comet direction follows shortest-path BFS depth from selected:
    //   inbound (sink) on  → comet flows from far endpoint to closer endpoint (toward selected)
    //   outbound (source) on → comet flows from closer endpoint to far endpoint (away from selected)
    //   both on             → both comets render
    // For non-bidirectional lanes the canonical origin→dest direction already matches
    // BFS depth (reverseAdj puts dest closer, forwardAdj puts origin closer), so a
    // single comet at origin→dest is always correct.
    const componentBidirLanes = componentLanes.filter(isBidirectionalLane);
    const componentNonBidirLanes = componentLanes.filter((l) => !isBidirectionalLane(l));

    const bidirComponentTrips: TripDatum[] = [];
    for (const l of componentBidirLanes) {
      const origin = l.origin_zone_key;
      const dest = l.destination_zone_key;
      if (sinkOn) {
        const dOrigin = reverseDepth.get(origin);
        const dDest = reverseDepth.get(dest);
        if (dOrigin !== undefined && dDest !== undefined) {
          // far → near: if origin is closer (smaller depth), reverse the path so comet runs dest→origin.
          bidirComponentTrips.push(makeTripDatum(l, dOrigin <= dDest, true));
        }
      }
      if (sourceOn) {
        const dOrigin = forwardDepth.get(origin);
        const dDest = forwardDepth.get(dest);
        if (dOrigin !== undefined && dDest !== undefined) {
          // near → far: if origin is closer (smaller depth), keep canonical origin→dest.
          bidirComponentTrips.push(makeTripDatum(l, dOrigin > dDest, true));
        }
      }
    }

    tripsDataRef.current = [
      ...bidirBothLanes.flatMap((l) => [cometSelectedToOther(l), cometOtherToSelected(l)]),
      ...outboundDirectLanes.map((l) => cometSelectedToOther(l)),
      ...inboundDirectLanes.map((l) => cometOtherToSelected(l)),
      ...bidirComponentTrips,
      ...componentNonBidirLanes.map((l) => makeTripDatum(l, false, true)),
    ];

    const NODE_RADIUS_PX = 10;
    const NODE_STROKE_PX = 1;

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
        const [r, g, b] = mapMode === 'homeNetwork' && !selectedZoneKey && !temporaryHome
          ? homeBaseHeatColor(homeBaseQuality.get(z.zone_key)?.normalizedScore ?? 0)
          : (() => {
              const colorScale = mapMode === 'homeNetwork'
                ? HOME_NETWORK_COLOR
                : mapMode === 'optionality' ? OPTIONALITY_COLOR : VOLUME_COLOR;
              return colorScale[zoneVisualBucket(z)];
            })();
        return [r, g, b, Math.round(zoneAlpha(z) * 230)];
      },
      getLineColor: (z) => {
        const [r, g, b] = mapMode === 'homeNetwork' && !selectedZoneKey && !temporaryHome
          ? homeBaseHeatColor(homeBaseQuality.get(z.zone_key)?.normalizedScore ?? 0)
          : (() => {
              const colorScale = mapMode === 'homeNetwork'
                ? HOME_NETWORK_COLOR
                : mapMode === 'optionality' ? OPTIONALITY_COLOR : VOLUME_COLOR;
              return colorScale[zoneVisualBucket(z)];
            })();
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
    const entryAnchorZones = temporaryHome
      ? entryAnchors
          .map((a) => {
            const zone = zoneMap.get(a.zoneKey);
            return zone ? { anchor: a, zone } : null;
          })
          .filter((v): v is { anchor: EntryAnchor; zone: FreightZoneSummary } => v !== null)
      : [];
    const deadheadLayer = temporaryHome
      ? new PathLayer<{ anchor: EntryAnchor; zone: FreightZoneSummary }>({
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

    // radius + tracks go below lanes; nodes + halo go above
    belowLanesRef.current = [
      ...(radiusLayer ? [radiusLayer] : []),
      ...(deadheadLayer ? [deadheadLayer] : []),
      componentTrackLayer,
      trackLayer,
    ];
    aboveLanesRef.current = [nodeLayer, ...(temporaryHomeLayer ? [temporaryHomeLayer] : []), ...(haloLayer ? [haloLayer] : [])];
  }, [data, selectedZoneKey, temporaryHome, entryStrictness, homeNetworkMaxLegs, mapMode, volumeMetric, activeFlowTypes, activeVolumeBuckets, activeOptionalityBuckets, activeHomeNetworkBuckets, expandNetwork, resolvedTheme]);

  const noData = data.lanes.length === 0 && data.zones.length === 0;
  const tempHomeSummary = temporaryHomeSummary(
    data.lanes,
    data.zones,
    temporaryHome,
    data.metadata.zone_radius_miles,
    entryStrictness,
    homeNetworkMaxLegs,
  );
  const nearestEntryAnchor = tempHomeSummary?.entryAnchors[0] ?? null;
  const strongestEntryAnchor = tempHomeSummary?.entryAnchors
    .slice()
    .sort((a, b) => (b.zone.outbound_load_count + b.zone.inbound_load_count) - (a.zone.outbound_load_count + a.zone.inbound_load_count))[0] ?? null;

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
          <p className="text-xs text-muted-foreground/60 italic">
            {mapMode === 'homeNetwork'
              ? temporaryHome ? 'Right-click another spot to move temporary home' : 'Click a hub or right-click the map to set home'
              : 'Click any hub to see its lanes'}
          </p>
        </div>
      )}

      {selectedZone && (
        <div className="absolute bottom-4 left-4 z-10">
          <ZoneTooltip
            zone={selectedZone}
            period={period}
            mode={mapMode}
            volumeMetric={volumeMetric}
            visualBucket={zoneBucket(selectedZone)}
            homeSelected={mapMode === 'homeNetwork' && (!!selectedZoneKey || !!temporaryHome)}
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
            mode={mapMode}
            volumeMetric={volumeMetric}
            visualBucket={zoneBucket(hoveredZone)}
            homeSelected={mapMode === 'homeNetwork' && (!!selectedZoneKey || !!temporaryHome)}
          />
        </div>
      )}

      {mapMode === 'homeNetwork' && temporaryHome && !selectedZone && !hoveredZone && tempHomeSummary && (
        <div className="absolute bottom-4 left-4 z-10">
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

      <div className="absolute top-4 right-4 z-10 bg-background border rounded-lg px-5 py-4 text-base space-y-3 min-w-[300px]">
        <div>
          <p className="font-semibold text-base">Mode</p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border bg-muted/30 p-1">
            {([
              { mode: 'volume', label: 'Volume' },
              { mode: 'optionality', label: 'Optionality' },
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

        {/* Traffic filter — controls lanes shown on zone click */}
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

        {mapMode === 'volume' ? (
          <>
            <p className="font-semibold text-base pt-2 border-t border-border/50">Volume</p>
            <Select value={volumeMetric} onValueChange={(value) => setVolumeMetric(value as VolumeMetric)}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground/60 -mt-2">
              {volumeMetric === 'total' ? 'Outbound + inbound loads' : `${volumeMetric === 'outbound' ? 'Outbound' : 'Inbound'} loads only`} · relative to visible lanes
            </p>
            {([
              { bucket: 'high',   dot: 'bg-yellow-400',  label: 'High (top 33%)' },
              { bucket: 'medium', dot: 'bg-orange-500',  label: 'Medium (middle 33%)' },
              { bucket: 'low',    dot: 'bg-red-600',     label: 'Low (bottom 33%)' },
            ] as const).map(({ bucket, dot, label }) => {
              const active = activeVolumeBuckets.has(bucket);
              return (
                <label key={bucket} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={active} onChange={() => toggleVolumeBucket(bucket)} className="sr-only" />
                  <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                    {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
                </label>
              );
            })}
          </>
        ) : mapMode === 'optionality' ? (
          <>
            <p className="font-semibold text-base pt-2 border-t border-border/50">Outbound Optionality</p>
            <p className="text-sm text-muted-foreground/60 -mt-2">Entropy of outbound lane choices · company-relative</p>
            {([
              { bucket: 'high',   dot: 'bg-emerald-500', label: 'High (top 33%)' },
              { bucket: 'medium', dot: 'bg-amber-500',   label: 'Medium (middle 33%)' },
              { bucket: 'low',    dot: 'bg-red-500',     label: 'Low (bottom 33%)' },
            ] as const).map(({ bucket, dot, label }) => {
              const active = activeOptionalityBuckets.has(bucket);
              return (
                <label key={bucket} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={active} onChange={() => toggleOptionalityBucket(bucket)} className="sr-only" />
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
