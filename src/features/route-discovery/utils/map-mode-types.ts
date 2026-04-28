export type FlowType = 'source' | 'sink';
export type MapMode = 'volume' | 'optionality' | 'homeNetwork';
export type VolumeMetric = 'total' | 'outbound' | 'inbound';
export type VisualBucket = 'high' | 'medium' | 'low';
export type EntryStrictness = 'strict' | 'balanced' | 'flexible';
export type HomeNetworkMaxLegs = 2 | 3 | 4;

export type TemporaryHome = { lat: number; lng: number };

export type HomeNetworkNode = {
  bucket: VisualBucket;
  score: number;
  outboundLegs: number;
  returnLegs: number;
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
