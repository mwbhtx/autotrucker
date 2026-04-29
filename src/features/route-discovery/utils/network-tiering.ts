import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import type { ZoneTier } from './map-mode-types';

type DestinationLane = {
  destination_zone_key: string;
  load_count: number;
};

export function tierForRankIndex(index: number, total: number): ZoneTier {
  if (total <= 0) return 'dim';
  const rank = (total - index - 0.5) / total;
  if (rank >= 0.9) return 'gold';
  if (rank >= 0.75) return 'silver';
  if (rank >= 0.5) return 'bronze';
  return 'dim';
}

export function buildLocalDestinationTierMap(
  outboundLanes: DestinationLane[],
  zoneByKey: ReadonlyMap<string, FreightZoneSummary>,
): Map<string, ZoneTier> {
  const scoreByDest = new Map<string, number>();

  for (const lane of outboundLanes) {
    const optionality = zoneByKey.get(lane.destination_zone_key)?.quality?.subscores.optionality ?? 0;
    const score = lane.load_count * optionality;
    scoreByDest.set(
      lane.destination_zone_key,
      (scoreByDest.get(lane.destination_zone_key) ?? 0) + score,
    );
  }

  const ranked = [...scoreByDest.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const tiers = new Map<string, ZoneTier>();
  ranked.forEach(([zoneKey], index) => {
    tiers.set(zoneKey, tierForRankIndex(index, ranked.length));
  });
  return tiers;
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
