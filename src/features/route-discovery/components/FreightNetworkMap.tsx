"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useZoneDetail } from '../hooks/use-zone-detail';
import { useZoneOrders } from '../hooks/use-zone-orders';
import { useSettings } from '@/core/hooks/use-settings';
import maplibregl from "maplibre-gl";
import { layersWithCustomTheme } from "protomaps-themes-base";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { MOONLIGHT_THEME, DARK_THEME } from "@/core/utils/map/themes";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";
import type { FreightNetworkMapResponse, FreightLaneEntry, FreightZoneSummary } from "@mwbhtx/haulvisor-core";
import { haversine } from "@mwbhtx/haulvisor-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/web/components/ui/select";
import { ZoneTooltip } from "./ZoneTooltip";
import type {
  MapMode, VisualBucket, EntryStrictness,
  HomeNetworkMaxLegs, TemporaryHome, HomeNetworkNode, HomeBaseQuality,
  ZoneTier,
} from "../utils/map-mode-types";
import { HOME_NETWORK_COLOR, TIER_COLOR, TIER_LABEL } from "../utils/map-mode-types";
import {
  buildHomeNetwork, buildHomeNetworkFromAnchors, buildHomeBaseQuality,
  homeBaseHeatColor,
  findEntryAnchors, temporaryHomeSummary,
} from "../utils/home-network-graph";
import {
  buildLocalDestinationQualityMap,
  type LocalDestinationQuality,
  selectedNetworkLanePassesTier,
  selectedNetworkTierForZone,
  selectedNetworkZonePassesTier,
} from "../utils/network-tiering";
import { ChevronDown, ChevronRight } from "lucide-react";

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

type ArcKind = 'outbound';

const ARC_COLOR: Record<ArcKind, [number, number, number]> = {
  outbound: [ 96, 165, 250],  // blue-400
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

type NetworkLaneEntry = Pick<
  FreightLaneEntry,
  | 'origin_zone_key'
  | 'origin_display_city'
  | 'origin_display_state'
  | 'origin_centroid_lat'
  | 'origin_centroid_lng'
  | 'destination_zone_key'
  | 'destination_display_city'
  | 'destination_display_state'
  | 'destination_centroid_lat'
  | 'destination_centroid_lng'
  | 'load_count'
  | 'loads_per_day'
  | 'median_gross_rate_per_loaded_mile'
>;

type NetworkLaneEvidence = {
  days_since_last_load?: number | null;
  active_days?: number | null;
  median_wait_days?: number | null;
};

type NetworkLane = NetworkLaneEntry & NetworkLaneEvidence;

type DestinationSummary = {
  zoneKey: string;
  label: string;
  loadCount: number;
  quality: LocalDestinationQuality;
};

export function FreightNetworkMap({ data, period }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const { resolvedTheme } = useTheme();

  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<FreightZoneSummary | null>(null);
  const [hoveredDestZoneKey, setHoveredDestZoneKey] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('network');
  const [temporaryHome, setTemporaryHome] = useState<TemporaryHome | null>(null);
  const [entryStrictness, setEntryStrictness] = useState<EntryStrictness>('balanced');
  const [homeNetworkMaxLegs, setHomeNetworkMaxLegs] = useState<HomeNetworkMaxLegs>(3);
  // Network mode state: tiers gate visibility, confidence explains evidence
  // without hiding the best available opportunities behind fixed load-count floors.
  const [activeZoneTiers, setActiveZoneTiers] = useState<Set<ZoneTier>>(new Set(['gold', 'silver', 'bronze']));
  const [activeDestTiers, setActiveDestTiers] = useState<Set<ZoneTier>>(new Set(['gold', 'silver', 'bronze']));
  const [availableLanesOnly, setAvailableLanesOnly] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [hoveredPanelDestKey, setHoveredPanelDestKey] = useState<string | null>(null);
  const [outboundOptionsExpanded, setOutboundOptionsExpanded] = useState(false);
  const [activeHomeNetworkBuckets, setActiveHomeNetworkBuckets] = useState<Set<VisualBucket>>(new Set(['high', 'medium', 'low']));
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

  const toggleZoneTier = makeSetToggler<ZoneTier>(setActiveZoneTiers);
  const toggleDestTier = makeSetToggler<ZoneTier>(setActiveDestTiers);
  const toggleHomeNetworkBucket = makeSetToggler<VisualBucket>(setActiveHomeNetworkBuckets);

  const selectedZone = selectedZoneKey
    ? data.zones.find((z) => z.zone_key === selectedZoneKey) ?? null
    : null;
  const zoneByKey = useMemo(() => new Map(data.zones.map((z) => [z.zone_key, z])), [data.zones]);

  const zoneDetail = useZoneDetail(
    mapMode === 'network' ? selectedZoneKey : null,
    period,
  );

  const zoneOrders = useZoneOrders(
    mapMode === 'network' ? selectedZone : null,
    data.metadata.zone_radius_miles,
  );

  const { data: settings } = useSettings();
  const orderUrlTemplate = settings?.order_url_template as string | undefined;

  // Unfiltered — all outbound lanes for the selected zone. Used for local tier
  // scoring so percentile ranks are stable regardless of the destination tier filter.
  const allDestLanes: NetworkLane[] = useMemo(() => {
    if (!selectedZoneKey || !zoneDetail.data || !selectedZone) return [];
    return zoneDetail.data.outbound_lanes.map((dl) => {
      const laneEvidence = dl as typeof dl & NetworkLaneEvidence;
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
        days_since_last_load: dl.days_since_last_load,
        active_days: laneEvidence.active_days ?? null,
        median_wait_days: laneEvidence.median_wait_days ?? null,
      };
    });
  }, [selectedZoneKey, selectedZone, zoneDetail.data, zoneByKey]);

  const selectedOutboundLanePool = useMemo<NetworkLane[]>(() => {
    if (!selectedZoneKey) return [];
    if (allDestLanes.length > 0) return allDestLanes;
    return data.lanes.filter((l) => (
      l.origin_zone_key === selectedZoneKey
      && zoneByKey.has(l.destination_zone_key)
    ));
  }, [allDestLanes, data.lanes, selectedZoneKey, zoneByKey]);

  const selectedDestinationQualityByKey = useMemo(
    () => selectedZoneKey
      ? buildLocalDestinationQualityMap(selectedOutboundLanePool, zoneByKey)
      : new Map<string, LocalDestinationQuality>(),
    [selectedOutboundLanePool, selectedZoneKey, zoneByKey],
  );

  const selectedDestinationSummaries = useMemo<DestinationSummary[]>(() => {
    const loadCountByDest = new Map<string, number>();
    for (const lane of selectedOutboundLanePool) {
      loadCountByDest.set(
        lane.destination_zone_key,
        (loadCountByDest.get(lane.destination_zone_key) ?? 0) + lane.load_count,
      );
    }
    return [...selectedDestinationQualityByKey.entries()]
      .map(([zoneKey, quality]) => {
        const zone = zoneByKey.get(zoneKey);
        return {
          zoneKey,
          label: zone ? `${zone.display_city}, ${zone.display_state}` : zoneKey,
          loadCount: loadCountByDest.get(zoneKey) ?? 0,
          quality,
        };
      })
      .sort((a, b) => {
          const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2, dim: 3 };
          const tierDiff = (tierOrder[a.quality.tier] ?? 3) - (tierOrder[b.quality.tier] ?? 3);
          if (tierDiff !== 0) return tierDiff;
          return b.quality.composite - a.quality.composite || b.loadCount - a.loadCount || a.label.localeCompare(b.label);
        })
      .slice(0, 5);
  }, [selectedDestinationQualityByKey, selectedOutboundLanePool, zoneByKey]);

  const laneByDest = useMemo(
    () => new Map(selectedOutboundLanePool.map((l) => [l.destination_zone_key, l])),
    [selectedOutboundLanePool],
  );

  // Destination zone keys that have at least one available order going to that state.
  const destZoneKeysWithOrders = useMemo<Set<string> | null>(() => {
    if (!availableLanesOnly || !zoneOrders.data) return null;
    const orderDestStates = new Set(
      zoneOrders.data.map((o) => o.destination_state).filter(Boolean),
    );
    const result = new Set<string>();
    for (const lane of selectedOutboundLanePool) {
      const destZone = zoneByKey.get(lane.destination_zone_key);
      if (destZone && orderDestStates.has(destZone.display_state)) {
        result.add(lane.destination_zone_key);
      }
    }
    return result;
  }, [availableLanesOnly, zoneOrders.data, selectedOutboundLanePool, zoneByKey]);

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

  const handleCloseZonePanel = useCallback(() => {
    setSelectedZoneKey(null);
    setAvailableLanesOnly(false);
    setOrdersPage(0);
  }, []);

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

    // Map mode controls zone visibility and color.
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
      // Network mode: must have a quality score and tier must be in the
      // visibility set. Confidence is displayed, not used as a hard gate.
      if (!z.quality) return false;
      return activeZoneTiers.has(z.quality.tier);
    };

    // Quality lanes: tier-filtered, drives the unselected global map view only.
    const qualityLanes = lanes.filter((l) => {
      const o = zoneMap.get(l.origin_zone_key);
      const d = zoneMap.get(l.destination_zone_key);
      return o && d && zonePassesFilters(o) && zonePassesFilters(d);
    });

    // Raw lanes: both zones exist in data, no tier filter.
    // Used for the selected-zone view so all historical outbound lanes are shown,
    // independent of what the tier toggle is set to.
    const rawLanes: NetworkLane[] = lanes.filter(
      (l) => zoneMap.has(l.origin_zone_key) && zoneMap.has(l.destination_zone_key)
    );

    // Local tier re-rank: when a zone is selected in network mode, score ALL
    // historical outbound destinations from this hub relative to each other.
    // Scored from rawLanes (not quality-filtered) so tier toggle doesn't affect
    // which destinations exist or how they rank.
    // Score uses lane volume, recency, cadence, rate, and destination onward opportunity.
    // Rank order mirrors global tiers: gold / silver / bronze / dim by percentile.
    const selectedOutboundLanes = mapMode === 'network' && selectedZoneKey
      ? selectedOutboundLanePool.length > 0
        ? selectedOutboundLanePool
        : rawLanes.filter((l) => l.origin_zone_key === selectedZoneKey)
      : [];
    const localQualityByDest = selectedZoneKey ? selectedDestinationQualityByKey : new Map<string, LocalDestinationQuality>();
    const localTierByDest = selectedZoneKey
      ? new Map([...localQualityByDest].map(([zoneKey, quality]) => [zoneKey, quality.tier]))
      : new Map<string, ZoneTier>();
    const visibleSelectedOutboundLanes = selectedZoneKey
      ? selectedOutboundLanes.filter((l) => {
          if (l.origin_zone_key !== selectedZoneKey) return false;
          const localTier = localQualityByDest.get(l.destination_zone_key)?.tier ?? 'dim';
          if (!activeDestTiers.has(localTier)) return false;
          if (destZoneKeysWithOrders && !destZoneKeysWithOrders.has(l.destination_zone_key)) return false;
          return true;
        })
      : [];

    // Network selected view is outbound-only: show destinations from the selected hub.
    const lanePool = (mapMode === 'network' && selectedZoneKey)
      ? visibleSelectedOutboundLanes
      : qualityLanes;

    // Lanes touching the selected zone: outbound only.
    const outboundDirectLanes = selectedZoneKey
      ? lanePool.filter((l) => l.origin_zone_key === selectedZoneKey)
      : [];

    const directShownLanes = mapMode === 'homeNetwork' && (selectedZoneKey || temporaryHome)
      ? qualityLanes
      : outboundDirectLanes;

    const allShownLanes = [...directShownLanes];

    // BFS through shown lanes only, preventing disconnected clusters from appearing.
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

    // When zone selected: show ONLY connected endpoints + selected zone.
    // Idle view: show zones that pass the selected module's filters.
    const activeZones = zones.filter((z) => {
      if (mapMode === 'homeNetwork' && temporaryHome && !selectedZoneKey) return zonePassesFilters(z);
      if (mapMode === 'homeNetwork' && selectedZoneKey) return zonePassesFilters(z);
      if (connectedZoneKeys) {
        if (!connectedZoneKeys.has(z.zone_key)) return false;
        if (z.zone_key === selectedZoneKey) return true;
        // Filter by local tier — same signal used to color the dot.
        const localTier = localQualityByDest.get(z.zone_key)?.tier ?? 'dim';
        return activeDestTiers.has(localTier);
      }
      // Global (no selection): gate on laneEndpointZoneKeys so a zone's own
      // tier score drives visibility, not its lane partners' tiers.
      if (!laneEndpointZoneKeys.has(z.zone_key)) return false;
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

    // Build bezier-arc geometry for every outbound lane that needs animated flow.
    const laneArcs: LaneArc[] = [];

    const outboundFromTo = (l: NetworkLaneEntry): [[number, number], [number, number]] => {
      return [
        [l.origin_centroid_lng, l.origin_centroid_lat],
        [l.destination_centroid_lng, l.destination_centroid_lat],
      ];
    };

    const arcLanes = hoveredPanelDestKey
      ? outboundDirectLanes.filter((l) => l.destination_zone_key === hoveredPanelDestKey)
      : outboundDirectLanes;
    for (const l of arcLanes) {
      const [from, to] = outboundFromTo(l);
      laneArcs.push(buildLaneArc(from, to, 1, 'outbound', true));
    }

    const NODE_RADIUS_PX = 10;
    const NODE_RADIUS_DEST_MIN = 5;
    const NODE_RADIUS_DEST_MAX = 14;
    const NODE_STROKE_PX = 1;

    // Load count per destination from the selected hub — drives dot size scaling.
    const loadCountByDestKey = new Map<string, number>();
    for (const lane of selectedOutboundLanePool) {
      loadCountByDestKey.set(
        lane.destination_zone_key,
        (loadCountByDestKey.get(lane.destination_zone_key) ?? 0) + lane.load_count,
      );
    }
    const maxDestLoadCount = Math.max(1, ...[...loadCountByDestKey.values()]);

    // Color resolver per active map mode:
    //  • network — global quality.tier so dot color = "how good is this hub?"
    //  • homeNetwork (idle) — heat ramp on home-base normalized score
    //  • homeNetwork (selected/temp) — discrete bucket color from network membership
    const pickZoneColor = (z: FreightZoneSummary): [number, number, number] => {
      if (mapMode === 'network') {
        // When a hub is selected, destination dots use local tier color (opportunity from here).
        // Selected hub itself and unselected global view use global tier color.
        if (selectedZoneKey && z.zone_key !== selectedZoneKey) {
          const localTier = localQualityByDest.get(z.zone_key)?.tier ?? 'dim';
          return TIER_COLOR[localTier];
        }
        return TIER_COLOR[selectedNetworkTierForZone(z, localTierByDest)];
      }
      if (!selectedZoneKey && !temporaryHome) {
        return homeBaseHeatColor(homeBaseQuality.get(z.zone_key)?.normalizedScore ?? 0);
      }
      const bucket = homeNetwork.get(z.zone_key)?.bucket ?? 'low';
      return HOME_NETWORK_COLOR[bucket];
    };

    // Zone dots — color = hub global tier; size = lane volume from selected hub (when selected).
    const nodeLayer = new ScatterplotLayer<FreightZoneSummary>({
      id: 'zone-nodes',
      data: activeZones,
      getPosition: (z) => [z.centroid_lng, z.centroid_lat],
      radiusUnits: 'pixels',
      getRadius: (z) => {
        if (!selectedZoneKey || z.zone_key === selectedZoneKey) return NODE_RADIUS_PX;
        const count = loadCountByDestKey.get(z.zone_key) ?? 0;
        if (count === 0) return NODE_RADIUS_DEST_MIN;
        return Math.round(
          NODE_RADIUS_DEST_MIN
          + (NODE_RADIUS_DEST_MAX - NODE_RADIUS_DEST_MIN) * Math.sqrt(count / maxDestLoadCount),
        );
      },
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
          setHoveredDestZoneKey(null);
          setOrdersPage(0);
          if (!next) setAvailableLanesOnly(false);
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
        if (!selectedZoneKey) {
          setHoveredZone(object ?? null);
        } else {
          setHoveredDestZoneKey(
            object && object.zone_key !== selectedZoneKey ? object.zone_key : null,
          );
        }
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

    // Home mode can show wider topology lanes; render non-direct connectors as
    // straight dim tracks distinct from animated outbound flow.
    const directConnectionSet = new Set<NetworkLaneEntry>(outboundDirectLanes);
    const remainingNetworkLanes = directShownLanes.filter((l) => !directConnectionSet.has(l));
    const networkTrackLayer = remainingNetworkLanes.length > 0 && !!selectedZoneKey ? new PathLayer<NetworkLaneEntry>({
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
        return [r, g, b, a.isDirect ? 180 : 110] as [number, number, number, number];
      },
      getWidth: (a) => a.isDirect ? 2 : 1,
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
  }, [data, selectedZoneKey, temporaryHome, entryStrictness, homeNetworkMaxLegs, mapMode, activeZoneTiers, activeDestTiers, activeHomeNetworkBuckets, selectedOutboundLanePool, selectedDestinationQualityByKey, destZoneKeysWithOrders, hoveredPanelDestKey]);

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

        const dashLayer = null; // animations disabled — static arcs only

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
    .sort((a, b) => b.zone.outbound_load_count - a.zone.outbound_load_count)[0] ?? null;

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

      {selectedZone && (() => {
        const hoveredDestZone = hoveredDestZoneKey ? zoneByKey.get(hoveredDestZoneKey) ?? null : null;

        if (hoveredDestZone) {
          const lane = laneByDest.get(hoveredDestZone.zone_key);
          return (
            <div className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto pointer-events-none">
              <ZoneTooltip zone={hoveredDestZone} period={period} mode={mapMode} />
              {lane && (
                <div className="mt-3 bg-background/95 border rounded-lg shadow-lg p-5 min-w-[320px] max-w-[420px] text-base">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Lane from {selectedZone.display_city}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
                    <dt className="text-muted-foreground">Loads</dt>
                    <dd className="font-medium tabular-nums">{lane.load_count.toLocaleString()}</dd>
                    <dt className="text-muted-foreground">Loads / day</dt>
                    <dd className="font-medium tabular-nums">{lane.loads_per_day?.toFixed(2) ?? '—'}</dd>
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="font-medium tabular-nums">
                      {lane.median_gross_rate_per_loaded_mile != null ? `$${lane.median_gross_rate_per_loaded_mile.toFixed(2)}/mi` : '—'}
                    </dd>
                    <dt className="text-muted-foreground">Last load</dt>
                    <dd className="font-medium tabular-nums">
                      {lane.days_since_last_load != null ? `${Math.round(lane.days_since_last_load)}d ago` : '—'}
                    </dd>
                    {lane.median_wait_days != null && (
                      <>
                        <dt className="text-muted-foreground">Typical wait</dt>
                        <dd className="font-medium tabular-nums">{Math.round(lane.median_wait_days)}d</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
            <ZoneTooltip
              zone={selectedZone}
              period={period}
              mode={mapMode}
              visualBucket={zoneBucket(selectedZone)}
              homeSelected={mapMode === 'homeNetwork' && (!!selectedZoneKey || !!temporaryHome)}
              showClose
              onClose={handleCloseZonePanel}
            />
            {mapMode === 'network' && selectedDestinationSummaries.length > 0 && (
              <div className="mt-3 bg-background/95 border rounded-lg shadow-lg min-w-[320px] max-w-[420px] text-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setOutboundOptionsExpanded((v) => !v)}
                >
                  <div>
                    <p className="font-semibold text-base">Top Lanes</p>
                    {!outboundOptionsExpanded && (
                      <p className="text-xs text-muted-foreground">{selectedDestinationSummaries.length} destinations</p>
                    )}
                  </div>
                  {outboundOptionsExpanded
                    ? <ChevronDown className="shrink-0 w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="shrink-0 w-4 h-4 text-muted-foreground" />
                  }
                </button>
                {outboundOptionsExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-muted-foreground -mt-1 mb-2">Hover a node for details</p>
                    {selectedDestinationSummaries.map(({ zoneKey, label, loadCount, quality }) => {
                      const localTier = quality.tier;
                      const [r, g, b] = TIER_COLOR[localTier];
                      const lane = laneByDest.get(zoneKey);
                      const destZone = zoneByKey.get(zoneKey);
                      return (
                        <div
                          key={zoneKey}
                          className={`rounded-md border px-3 py-2 transition-opacity cursor-default ${
                            hoveredPanelDestKey && hoveredPanelDestKey !== zoneKey
                              ? 'opacity-40 bg-background/50'
                              : 'bg-background/70'
                          }`}
                          onMouseEnter={() => setHoveredPanelDestKey(zoneKey)}
                          onMouseLeave={() => setHoveredPanelDestKey(null)}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="truncate font-medium text-sm">{label}</p>
                            <span
                              className="shrink-0 inline-flex rounded-sm px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`, color: `rgb(${r}, ${g}, ${b})` }}
                            >
                              {TIER_LABEL[localTier]}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Lane: {loadCount.toLocaleString()} loads
                            {lane?.median_gross_rate_per_loaded_mile != null ? ` · $${lane.median_gross_rate_per_loaded_mile.toFixed(2)}/mi` : ''}
                            {lane?.days_since_last_load != null ? ` · ${Math.round(lane.days_since_last_load)}d ago` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Hub: {destZone?.outbound_lane_count ?? 0} outbound lane{(destZone?.outbound_lane_count ?? 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {mapMode === 'network' && (() => {
              const PAGE_SIZE = 5;
              const allOrders = zoneOrders.data ?? [];
              const totalPages = Math.max(1, Math.ceil(allOrders.length / PAGE_SIZE));
              const safePage = Math.min(ordersPage, totalPages - 1);
              const pageOrders = allOrders.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
              return (
                <div className="mt-3 bg-background/95 border rounded-lg shadow-lg p-4 min-w-[320px] max-w-[420px] text-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-base">Available orders</p>
                      <p className="text-xs text-muted-foreground">Open · sorted by rate/mi</p>
                    </div>
                    {!zoneOrders.isLoading && zoneOrders.data != null && (
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        Orders {allOrders.length}
                      </span>
                    )}
                  </div>
                  {zoneOrders.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : zoneOrders.isError ? (
                    <p className="text-xs text-muted-foreground">Failed to load orders.</p>
                  ) : !allOrders.length ? (
                    <p className="text-xs text-muted-foreground">No open orders found in this area.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {pageOrders.map((order) => {
                          const orderUrl = orderUrlTemplate
                            ? orderUrlTemplate.replace('{{ORDER_ID}}', order.order_id)
                            : null;
                          const routeLabel = `${order.origin_city}, ${order.origin_state} → ${order.destination_city}, ${order.destination_state}`;
                          return (
                            <div key={order.order_id} className="rounded-md border bg-background/70 px-3 py-2">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                {orderUrl ? (
                                  <a
                                    href={orderUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate text-sm font-medium hover:underline"
                                  >
                                    {routeLabel}
                                  </a>
                                ) : (
                                  <p className="truncate text-sm font-medium">{routeLabel}</p>
                                )}
                                <p className="shrink-0 text-xs font-semibold tabular-nums">
                                  ${order.rate_per_mile.toFixed(2)}/mi
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                ${order.pay.toLocaleString()} · {order.miles.toLocaleString()} mi · {order.trailer_type}
                                {order.pickup_date_early_local ? ` · ${order.pickup_date_early_local.slice(0, 10)}` : ''}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
                            disabled={safePage === 0}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ← Prev
                          </button>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {safePage + 1} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOrdersPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={safePage === totalPages - 1}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {!selectedZone && hoveredZone && (
        <div className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto pointer-events-none">
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
        <div className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto">
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

        {mapMode === 'network' ? (
          <>
            <p className="font-semibold text-base pt-2 border-t border-border/50">{selectedZoneKey ? 'Opportunity Tiers' : 'Zone Tiers'}</p>
            <p className="text-sm text-muted-foreground/60 -mt-2">
              {selectedZoneKey ? 'Best next moves from this hub' : 'Best outbound zones inside this dataset'}
            </p>
            {([
              { tier: 'gold',   dot: 'bg-amber-400',  label: 'Gold (top 10%)' },
              { tier: 'silver', dot: 'bg-slate-300',  label: 'Silver (next 15%)' },
              { tier: 'bronze', dot: 'bg-amber-700',  label: 'Bronze (next 25%)' },
              { tier: 'dim',    dot: 'bg-slate-600',  label: 'Below tier' },
            ] as const).map(({ tier, dot, label }) => {
              const active = selectedZoneKey ? activeDestTiers.has(tier) : activeZoneTiers.has(tier);
              return (
                <label key={tier} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={active} onChange={() => selectedZoneKey ? toggleDestTier(tier) : toggleZoneTier(tier)} className="sr-only" />
                  <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${active ? `${dot} border-transparent` : 'border-border'}`}>
                    {active && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className={active ? 'text-foreground' : 'text-muted-foreground/50'}>{label}</span>
                </label>
              );
            })}

            {selectedZoneKey && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none pt-2 border-t border-border/50">
                <input type="checkbox" checked={availableLanesOnly} onChange={() => setAvailableLanesOnly((v) => !v)} className="sr-only" />
                <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${availableLanesOnly ? 'bg-primary border-transparent' : 'border-border'}`}>
                  {availableLanesOnly && <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <span className={availableLanesOnly ? 'text-foreground font-medium' : 'text-muted-foreground/70'}>Available orders only</span>
              </label>
            )}
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

      </div>
    </div>
  );
}
