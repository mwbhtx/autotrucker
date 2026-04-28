import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import type { VisualBucket, VolumeMetric } from './map-mode-types';

export function zoneVolumeValue(z: FreightZoneSummary, metric: VolumeMetric): number {
  if (metric === 'outbound') return z.outbound_load_count;
  if (metric === 'inbound') return z.inbound_load_count;
  return z.outbound_load_count + z.inbound_load_count;
}

export function zoneVolumeBucket(
  z: FreightZoneSummary,
  thresholds: { medium_min: number; high_min: number },
  metric: VolumeMetric,
): VisualBucket {
  const value = zoneVolumeValue(z, metric);
  if (value >= thresholds.high_min) return 'high';
  if (value >= thresholds.medium_min) return 'medium';
  return 'low';
}

/** Normalize load_count to arc width in pixels [1, 6]. */
export function arcWidth(loadCount: number, allCounts: number[]): number {
  if (allCounts.length === 0) return 1;
  const max = Math.max(...allCounts);
  const min = Math.min(...allCounts);
  if (max === min) return 3;
  return 1 + ((loadCount - min) / (max - min)) * 5;
}

/** Normalize loads_per_day to opacity [0.3, 1.0]. */
export function arcOpacity(loadsPerDay: number, allLoadsPerDay: number[]): number {
  if (allLoadsPerDay.length === 0) return 0.65;
  const max = Math.max(...allLoadsPerDay);
  const min = Math.min(...allLoadsPerDay);
  if (max === min) return 0.65;
  return 0.3 + ((loadsPerDay - min) / (max - min)) * 0.7;
}

/**
 * Geodetic bearing from A→B in degrees (0=North, clockwise).
 * TextLayer arrowhead angle: `90 - bearing(origin, dest)`
 * because ▶ natural orientation is east (0° = no rotation = east in screen space).
 */
export function bearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x =
    Math.cos(lat1R) * Math.sin(lat2R) -
    Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Geographic midpoint of two lat/lng pairs. */
export function midpoint(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): [number, number] {
  return [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
}
