import { describe, expect, it } from 'vitest';
import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import {
  buildLocalDestinationTierMap,
  selectedNetworkLanePassesTier,
  tierForRankIndex,
} from './network-tiering';
import type { ZoneTier } from './map-mode-types';

function zone(zoneKey: string, optionality: number, tier: ZoneTier = 'dim'): FreightZoneSummary {
  return {
    zone_key: zoneKey,
    display_city: zoneKey,
    display_state: 'TX',
    centroid_lat: 0,
    centroid_lng: 0,
    outbound_load_count: 1,
    outbound_lane_count: 1,
    outbound_entropy: 1,
    optionality_bucket: 'medium',
    data_support: 'medium',
    quality: {
      composite: optionality,
      tier,
      subscores: {
        volume: 0,
        optionality,
        recency: 0,
        cadence: 0,
        rate: 0,
      },
    },
  } as FreightZoneSummary;
}

describe('network tiering', () => {
  it('uses the same percentile bands as global zone tiers', () => {
    expect(tierForRankIndex(0, 100)).toBe('gold');
    expect(tierForRankIndex(10, 100)).toBe('silver');
    expect(tierForRankIndex(25, 100)).toBe('bronze');
    expect(tierForRankIndex(50, 100)).toBe('dim');
  });

  it('filters selected-hub lanes by outbound destination tier only', () => {
    const zones = new Map<string, FreightZoneSummary>([['selected', zone('selected', 1)]]);
    const lanes = Array.from({ length: 20 }, (_, index) => {
      const destKey = index === 0 ? 'gold-dest' : index === 3 ? 'silver-dest' : `dest-${index}`;
      const optionality = 100 - index;
      zones.set(destKey, zone(destKey, optionality));
      return { origin_zone_key: 'selected', destination_zone_key: destKey, load_count: optionality };
    });
    const localTiers = buildLocalDestinationTierMap(lanes, zones);
    const goldLane = lanes[0];
    const silverLane = lanes[3];

    expect(localTiers.get('gold-dest')).toBe('gold');
    expect(localTiers.get('silver-dest')).toBe('silver');
    expect(
      selectedNetworkLanePassesTier(goldLane, 'selected', zones, new Set<ZoneTier>(['silver']), localTiers),
    ).toBe(false);
    expect(
      selectedNetworkLanePassesTier(silverLane, 'selected', zones, new Set<ZoneTier>(['silver']), localTiers),
    ).toBe(true);
  });

  it('does not surface lanes pointing back into the selected hub', () => {
    const zones = new Map([
      ['selected', zone('selected', 1)],
      ['other', zone('other', 100, 'gold')],
    ]);
    const localTiers = new Map<string, ZoneTier>([['other', 'gold']]);
    const laneToSelected = { origin_zone_key: 'other', destination_zone_key: 'selected', load_count: 10 };

    expect(
      selectedNetworkLanePassesTier(laneToSelected, 'selected', zones, new Set<ZoneTier>(['gold']), localTiers),
    ).toBe(false);
  });
});
