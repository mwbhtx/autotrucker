import { describe, expect, it } from 'vitest';
import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import {
  buildLocalDestinationQualityMap,
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
      const globalTier: ZoneTier = index === 0 ? 'gold' : index === 3 ? 'silver' : 'dim';
      zones.set(destKey, zone(destKey, optionality, globalTier));
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

  it('keeps opportunity tier separate from confidence evidence', () => {
    const zones = new Map<string, FreightZoneSummary>([
      ['selected', zone('selected', 1)],
      ['thin', zone('thin', 95)],
      ['steady', zone('steady', 80)],
      ['weak', zone('weak', 10)],
      ['stale', zone('stale', 20)],
      ['missing-rate', zone('missing-rate', 40)],
    ]);
    const qualities = buildLocalDestinationQualityMap([
      {
        destination_zone_key: 'thin',
        load_count: 4,
        active_days: 1,
        median_gross_rate_per_loaded_mile: 4.2,
        days_since_last_load: 1,
      },
      {
        destination_zone_key: 'steady',
        load_count: 40,
        active_days: 20,
        median_gross_rate_per_loaded_mile: 1.1,
        days_since_last_load: 20,
        median_wait_days: 2,
      },
      {
        destination_zone_key: 'weak',
        load_count: 10,
        active_days: 8,
        median_gross_rate_per_loaded_mile: 1.4,
        days_since_last_load: 4,
      },
      {
        destination_zone_key: 'stale',
        load_count: 12,
        active_days: 6,
        median_gross_rate_per_loaded_mile: 1.8,
        days_since_last_load: 30,
      },
      {
        destination_zone_key: 'missing-rate',
        load_count: 8,
        active_days: 5,
        median_gross_rate_per_loaded_mile: null,
        days_since_last_load: 3,
      },
    ], zones);

    expect(qualities.get('thin')?.tier).toBe('gold');
    expect(qualities.get('thin')?.confidence.level).not.toBe('high');
    expect(qualities.get('steady')?.confidence.level).toBe('high');
  });
});
