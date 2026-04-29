// 'network' is the unified scored-zone view that replaces standalone volume + optionality tabs.
export type MapMode = 'network' | 'homeNetwork';
export type VisualBucket = 'high' | 'medium' | 'low';
export type EntryStrictness = 'strict' | 'balanced' | 'flexible';
export type HomeNetworkMaxLegs = 2 | 3 | 4;

export type TemporaryHome = { lat: number; lng: number };

export type HomeNetworkNode = {
  bucket: VisualBucket;
  score: number;
  legs: number;
};

export type HomeBaseQuality = {
  bucket: VisualBucket;
  score: number;
  normalizedScore: number;
  networkZoneCount: number;
};

export type EntryAnchor = {
  zoneKey: string;
  distanceMiles: number;
  outsideRadius: boolean;
};

export const VOLUME_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [255, 200,  50],
  medium: [255, 110,  20],
  low:    [200,  45,  45],
};

export const OPTIONALITY_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [ 16, 185, 129],
  medium: [245, 158,  11],
  low:    [239,  68,  68],
};

export const HOME_NETWORK_COLOR: Record<VisualBucket, [number, number, number]> = {
  high:   [ 34, 197,  94],
  medium: [ 56, 189, 248],
  low:    [148, 163, 184],
};

// Tier palette for the unified Network mode. Mirrors haulvisor-core's ZoneTier.
export type ZoneTier = 'gold' | 'silver' | 'bronze' | 'dim';
export const TIER_COLOR: Record<ZoneTier, [number, number, number]> = {
  gold:   [250, 204,  21],  // amber-400
  silver: [203, 213, 225],  // slate-300
  bronze: [217, 119,   6],  // amber-600
  dim:    [ 71,  85, 105],  // slate-600
};
export const TIER_LABEL: Record<ZoneTier, string> = {
  gold:   'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  dim:    'Below tier',
};
