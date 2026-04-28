import { haversine } from '@mwbhtx/haulvisor-core';
import type { FreightLaneEntry, FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import type {
  EntryAnchor, EntryStrictness, HomeBaseQuality, HomeNetworkMaxLegs,
  HomeNetworkNode, TemporaryHome, VisualBucket,
} from './map-mode-types';

export type TemporaryHomeSummary = {
  entryAnchors: Array<EntryAnchor & { zone: FreightZoneSummary }>;
  networkZoneCount: number;
};

const ENTRY_STRICTNESS: Record<EntryStrictness, {
  maxWaitDays: number;
  minDataSupport: FreightZoneSummary['data_support'];
  allowOutsideRadiusFallback: boolean;
}> = {
  strict:   { maxWaitDays: 1, minDataSupport: 'high',   allowOutsideRadiusFallback: false },
  balanced: { maxWaitDays: 3, minDataSupport: 'medium', allowOutsideRadiusFallback: false },
  flexible: { maxWaitDays: 7, minDataSupport: 'low',    allowOutsideRadiusFallback: true  },
};

const DATA_SUPPORT_RANK: Record<FreightZoneSummary['data_support'], number> = {
  low: 0, medium: 1, high: 2,
};

export function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function interpolateColor(
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

export function homeBaseHeatColor(score: number): [number, number, number] {
  if (score < 0.5) return interpolateColor([239, 68, 68], [245, 158, 11], score / 0.5);
  return interpolateColor([245, 158, 11], [34, 197, 94], (score - 0.5) / 0.5);
}

export function isSupportedReverseLane(l: FreightLaneEntry): boolean {
  return l.reverse_strength === 'strong_visible' || l.reverse_strength === 'strong_truncated';
}

export function addEdge(adj: Map<string, Set<string>>, from: string, to: string): void {
  if (!adj.has(from)) adj.set(from, new Set());
  adj.get(from)!.add(to);
}

export function buildDirectedAdjacency(lanes: FreightLaneEntry[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const l of lanes) {
    addEdge(adj, l.origin_zone_key, l.destination_zone_key);
    if (isSupportedReverseLane(l)) addEdge(adj, l.destination_zone_key, l.origin_zone_key);
  }
  return adj;
}

export function reverseAdjacency(adj: Map<string, Set<string>>): Map<string, Set<string>> {
  const reversed = new Map<string, Set<string>>();
  for (const [from, tos] of adj.entries()) {
    for (const to of tos) addEdge(reversed, to, from);
  }
  return reversed;
}

export function bfsDepth(
  adj: Map<string, Set<string>>,
  start: string,
  maxDepth = Infinity,
): Map<string, number> {
  const depth = new Map<string, number>([[start, 0]]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
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

export function buildHomeNetworkFromAnchors(
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
      for (const [zoneKey, d] of bfsDepth(adj, homeZoneKey, maxLegs).entries()) {
        const existing = merged.get(zoneKey);
        if (existing === undefined || d < existing) merged.set(zoneKey, d);
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
      const score = Math.max(0, 100 - outboundLegs * 18 - returnLegs * 18 + volumeScore + optionalityScore - waitPenalty);
      return { zoneKey: z.zone_key, score, outboundLegs, returnLegs };
    })
    .filter((v): v is { zoneKey: string; score: number; outboundLegs: number; returnLegs: number } => v !== null)
    .sort((a, b) => a.score - b.score);
  const scores = candidates.map((c) => c.score);
  const mediumMin = percentileOf(scores, 1 / 3);
  const highMin = percentileOf(scores, 2 / 3);
  return new Map(candidates.map((c) => [
    c.zoneKey,
    {
      bucket: (c.score >= highMin ? 'high' : c.score >= mediumMin ? 'medium' : 'low') as VisualBucket,
      score: c.score,
      outboundLegs: c.outboundLegs,
      returnLegs: c.returnLegs,
    },
  ]));
}

export function buildHomeNetwork(
  lanes: FreightLaneEntry[],
  zones: FreightZoneSummary[],
  homeZoneKey: string | null,
  maxLegs: HomeNetworkMaxLegs,
): Map<string, HomeNetworkNode> {
  if (!homeZoneKey) return new Map();
  return buildHomeNetworkFromAnchors(lanes, zones, [homeZoneKey], maxLegs);
}

export function buildHomeBaseQuality(
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
      if (canReturnHome.has(zoneKey)) networkCount++;
    }
    const trapCount = Math.max(0, reachableCount - Math.max(0, networkCount - 1));
    const totalLoads = z.outbound_load_count + z.inbound_load_count;
    if (networkCount <= 1) return { zoneKey: z.zone_key, score: 0, networkZoneCount: networkCount };
    const volumeScore = Math.log1p(totalLoads) * 5;
    const optionalityScore = z.outbound_entropy * 8;
    const networkScore = networkCount * 8;
    const returnCoverageScore = reachableCount === 0 ? 0 : (networkCount / (reachableCount + 1)) * 30;
    const trapPenalty = trapCount * 12;
    return {
      zoneKey: z.zone_key,
      score: Math.max(0, networkScore + returnCoverageScore + volumeScore + optionalityScore - trapPenalty),
      networkZoneCount: networkCount,
    };
  }).sort((a, b) => a.score - b.score);
  const scores = rawScores.map((s) => s.score);
  const low = rawScores[0]?.score ?? 0;
  const high = rawScores[rawScores.length - 1]?.score ?? 0;
  const mediumMin = percentileOf(scores, 1 / 3);
  const highMin = percentileOf(scores, 2 / 3);
  return new Map(rawScores.map((s) => [
    s.zoneKey,
    {
      score: s.score,
      normalizedScore: high === low ? 1 : (s.score - low) / (high - low),
      bucket: (s.score >= highMin ? 'high' : s.score >= mediumMin ? 'medium' : 'low') as VisualBucket,
      networkZoneCount: s.networkZoneCount,
    },
  ]));
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

export function findEntryAnchors(
  zones: FreightZoneSummary[],
  home: TemporaryHome | null,
  radiusMiles: number,
  strictness: EntryStrictness,
): EntryAnchor[] {
  if (!home) return [];
  const allByDistance = zones
    .map((z) => ({ zone: z, distanceMiles: haversine(home.lat, home.lng, z.centroid_lat, z.centroid_lng) }))
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

export function temporaryHomeSummary(
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
  return { entryAnchors, networkZoneCount: homeNetwork.size };
}
