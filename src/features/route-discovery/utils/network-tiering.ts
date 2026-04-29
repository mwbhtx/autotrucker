import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import type { ZoneTier } from './map-mode-types';

type DestinationLane = {
  destination_zone_key: string;
  load_count: number;
  loads_per_day?: number | null;
  median_gross_rate_per_loaded_mile?: number | null;
  median_rate_per_mile?: number | null;
  days_since_last_load?: number | null;
  active_days?: number | null;
  median_wait_days?: number | null;
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type LocalDestinationQuality = {
  composite: number;
  tier: ZoneTier;
  confidence: {
    score: number;
    level: ConfidenceLevel;
    subscores: {
      volumeSupport: number;
      laneSupport: number;
      activeDaySupport: number;
      rateSupport: number;
    };
  };
  subscores: {
    volume: number;
    recency: number;
    cadence: number;
    rate: number;
    onward: number;
  };
};

type DestinationSignal = {
  destinationZoneKey: string;
  loadCount: number;
  loadsPerDay: number | null;
  daysSinceLastLoad: number | null;
  activeDays: number | null;
  medianWaitDays: number | null;
  medianRatePerMile: number | null;
  onwardScore: number | null;
};

export function tierForRankIndex(index: number, total: number): ZoneTier {
  if (total <= 0) return 'dim';
  const rank = (total - index - 0.5) / total;
  if (rank >= 0.9) return 'gold';
  if (rank >= 0.75) return 'silver';
  if (rank >= 0.5) return 'bronze';
  return 'dim';
}

function percentileRank(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 0;
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < sortedAsc.length && sortedAsc[lo] < value) lo++;
  while (hi > 0 && sortedAsc[hi - 1] > value) hi--;
  const rank = (lo + hi) / 2;
  return rank / sortedAsc.length;
}

function percentileValue(values: Array<number | null | undefined>, p: number): number {
  const sorted = values
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

function rankSignal(values: Array<number | null>): (value: number | null) => number {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return () => 0;
  const sorted = present.slice().sort((a, b) => a - b);
  return (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return 0;
    return Math.round(percentileRank(sorted, value) * 100);
  };
}

function rankSignalInverse(values: Array<number | null>): (value: number | null) => number {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return () => 0;
  const sorted = present.slice().sort((a, b) => a - b);
  return (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return 0;
    return Math.round((1 - percentileRank(sorted, value)) * 100);
  };
}

function evidenceScore(value: number | null | undefined, reference: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return 0;
  const ref = Number.isFinite(reference) && reference > 0 ? reference : value;
  return Math.round((1 - Math.exp(-value / ref)) * 100);
}

function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function laneRate(lane: DestinationLane): number | null {
  return lane.median_gross_rate_per_loaded_mile ?? lane.median_rate_per_mile ?? null;
}

function buildDestinationSignals(
  outboundLanes: DestinationLane[],
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
): DestinationSignal[] {
  const aggregate = new Map<string, {
    destinationZoneKey: string;
    loadCount: number;
    loadsPerDay: number;
    activeDays: number;
    daysSinceLastLoad: number | null;
    weightedRateTotal: number;
    weightedRateLoads: number;
    weightedWaitTotal: number;
    weightedWaitLoads: number;
    onwardScore: number | null;
  }>();

  for (const lane of outboundLanes) {
    const destZone = zoneByKey.get(lane.destination_zone_key);
    const current = aggregate.get(lane.destination_zone_key) ?? {
      destinationZoneKey: lane.destination_zone_key,
      loadCount: 0,
      loadsPerDay: 0,
      activeDays: 0,
      daysSinceLastLoad: null,
      weightedRateTotal: 0,
      weightedRateLoads: 0,
      weightedWaitTotal: 0,
      weightedWaitLoads: 0,
      onwardScore: destZone?.quality?.composite ?? destZone?.quality?.subscores.optionality ?? null,
    };
    current.loadCount += lane.load_count;
    current.loadsPerDay += lane.loads_per_day ?? 0;
    current.activeDays += lane.active_days ?? 0;
    current.daysSinceLastLoad = current.daysSinceLastLoad === null
      ? lane.days_since_last_load ?? null
      : Math.min(current.daysSinceLastLoad, lane.days_since_last_load ?? current.daysSinceLastLoad);
    const rate = laneRate(lane);
    if (rate !== null && Number.isFinite(rate)) {
      current.weightedRateTotal += rate * lane.load_count;
      current.weightedRateLoads += lane.load_count;
    }
    if (lane.median_wait_days !== null && lane.median_wait_days !== undefined && Number.isFinite(lane.median_wait_days)) {
      current.weightedWaitTotal += lane.median_wait_days * lane.load_count;
      current.weightedWaitLoads += lane.load_count;
    }
    aggregate.set(lane.destination_zone_key, current);
  }

  return [...aggregate.values()].map((item) => ({
    destinationZoneKey: item.destinationZoneKey,
    loadCount: item.loadCount,
    loadsPerDay: item.loadsPerDay || null,
    daysSinceLastLoad: item.daysSinceLastLoad,
    activeDays: item.activeDays || null,
    medianWaitDays: item.weightedWaitLoads > 0 ? item.weightedWaitTotal / item.weightedWaitLoads : null,
    medianRatePerMile: item.weightedRateLoads > 0 ? item.weightedRateTotal / item.weightedRateLoads : null,
    onwardScore: item.onwardScore,
  }));
}

export function buildLocalDestinationQualityMap(
  outboundLanes: DestinationLane[],
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
): Map<string, LocalDestinationQuality> {
  const signals = buildDestinationSignals(outboundLanes, zoneByKey);
  if (signals.length === 0) return new Map();

  const rankVolume = rankSignal(signals.map((s) => s.loadCount));
  const rankRecency = rankSignalInverse(signals.map((s) => s.daysSinceLastLoad));
  const rankActiveDays = rankSignal(signals.map((s) => s.activeDays));
  const rankMedianWait = rankSignalInverse(signals.map((s) => s.medianWaitDays));
  const rankRate = rankSignal(signals.map((s) => s.medianRatePerMile));
  const rankOnward = rankSignal(signals.map((s) => s.onwardScore));
  const volumeReference = percentileValue(signals.map((s) => s.loadCount), 0.75);
  const activeDayReference = percentileValue(signals.map((s) => s.activeDays), 0.75);

  const scored = signals.map((signal) => {
    const activeDayScore = rankActiveDays(signal.activeDays);
    const waitScore = rankMedianWait(signal.medianWaitDays);
    const cadence = activeDayScore > 0 && waitScore > 0
      ? Math.round(activeDayScore * 0.65 + waitScore * 0.35)
      : Math.max(activeDayScore, waitScore);
    const subscores: LocalDestinationQuality['subscores'] = {
      volume: rankVolume(signal.loadCount),
      recency: rankRecency(signal.daysSinceLastLoad),
      cadence,
      rate: rankRate(signal.medianRatePerMile),
      onward: rankOnward(signal.onwardScore),
    };
    const composite = Math.round(
      (subscores.volume * 1.0
        + subscores.recency * 0.8
        + subscores.cadence * 0.7
        + subscores.rate * 1.0
        + subscores.onward * 0.9) / 4.4,
    );
    const volumeSupport = evidenceScore(signal.loadCount, volumeReference);
    const activeDaySupport = evidenceScore(signal.activeDays, activeDayReference);
    const rateSupport = signal.medianRatePerMile !== null && Number.isFinite(signal.medianRatePerMile) ? 100 : 0;
    const confidenceScore = Math.round(volumeSupport * 0.50 + activeDaySupport * 0.30 + rateSupport * 0.20);
    return {
      destinationZoneKey: signal.destinationZoneKey,
      quality: {
        composite,
        tier: 'dim' as ZoneTier,
        confidence: {
          score: confidenceScore,
          level: confidenceLevel(confidenceScore),
          subscores: {
            volumeSupport,
            laneSupport: 100,
            activeDaySupport,
            rateSupport,
          },
        },
        subscores,
      },
    };
  });

  const compositeSortedAsc = scored.map((s) => s.quality.composite).sort((a, b) => a - b);
  return new Map(scored.map(({ destinationZoneKey, quality }) => {
    const rank = percentileRank(compositeSortedAsc, quality.composite);
    const tier: ZoneTier = rank >= 0.9 ? 'gold' : rank >= 0.75 ? 'silver' : rank >= 0.5 ? 'bronze' : 'dim';
    return [destinationZoneKey, { ...quality, tier }];
  }));
}

export function buildLocalDestinationTierMap(
  outboundLanes: DestinationLane[],
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
): Map<string, ZoneTier> {
  return new Map(
    [...buildLocalDestinationQualityMap(outboundLanes, zoneByKey)].map(([zoneKey, quality]) => [zoneKey, quality.tier]),
  );
}

export function selectedNetworkTierForZone(
  zone: FreightZoneSummary,
  localTierByDest: ReadonlyMap<string, ZoneTier>,
): ZoneTier {
  return localTierByDest.get(zone.zone_key) ?? zone.quality?.tier ?? 'dim';
}

export function selectedNetworkTierForZoneKey(
  zoneKey: string,
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
  localTierByDest: ReadonlyMap<string, ZoneTier>,
): ZoneTier {
  return localTierByDest.get(zoneKey) ?? zoneByKey.get(zoneKey)?.quality?.tier ?? 'dim';
}

export function selectedNetworkZonePassesTier(
  zone: FreightZoneSummary,
  activeTiers: ReadonlySet<ZoneTier>,
  localTierByDest: ReadonlyMap<string, ZoneTier>,
): boolean {
  return activeTiers.has(selectedNetworkTierForZone(zone, localTierByDest));
}

export function selectedNetworkLanePassesTier(
  lane: DestinationLane & { origin_zone_key: string },
  selectedZoneKey: string,
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
  activeTiers: ReadonlySet<ZoneTier>,
  localTierByDest: ReadonlyMap<string, ZoneTier>,
): boolean {
  if (lane.origin_zone_key !== selectedZoneKey) return false;
  return activeTiers.has(selectedNetworkTierForZoneKey(lane.destination_zone_key, zoneByKey, localTierByDest));
}
