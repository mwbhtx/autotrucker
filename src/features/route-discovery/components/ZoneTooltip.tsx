"use client";

import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';

type MapMode = 'volume' | 'optionality' | 'homeNetwork';
type VolumeMetric = 'total' | 'outbound' | 'inbound';
type VisualBucket = 'high' | 'medium' | 'low';
type FreightZoneWithCadence = FreightZoneSummary & {
  outbound_active_days?: number;
  outbound_days_since_last_load?: number | null;
  outbound_median_wait_days?: number | null;
};

interface ZoneTooltipProps {
  zone: FreightZoneWithCadence;
  period: '30d' | '60d' | '90d';
  mode?: MapMode;
  volumeMetric?: VolumeMetric;
  visualBucket?: VisualBucket;
  homeSelected?: boolean;
  showClose?: boolean;
  onClose?: () => void;
}

const PERIOD_LABEL: Record<string, string> = {
  '30d': 'last 30 days',
  '60d': 'last 60 days',
  '90d': 'last 90 days',
};

const BUCKET_LABEL: Record<VisualBucket, string> = {
  high: 'High (top 33%)',
  medium: 'Medium (middle 33%)',
  low: 'Low (bottom 33%)',
};

function volumeValue(zone: FreightZoneSummary, metric: VolumeMetric): number {
  if (metric === 'outbound') return zone.outbound_load_count;
  if (metric === 'inbound') return zone.inbound_load_count;
  return zone.outbound_load_count + zone.inbound_load_count;
}

function marketRead(outboundPct: number, inboundPct: number): string {
  if (inboundPct >= 65) return 'Mostly receives freight; outbound activity is limited.';
  if (outboundPct >= 65) return 'Mostly originates freight; inbound balance is lighter.';
  return 'Balanced inbound and outbound freight activity.';
}

function optionalityRead(zone: FreightZoneWithCadence, effectiveDestinations: number): string {
  if (zone.optionality_bucket === 'low_data') return 'Not enough outbound history to judge route choices.';
  if (effectiveDestinations < 2) return 'Outbound choices are concentrated; this market can be hard to leave.';
  if (effectiveDestinations < 4) return 'Some outbound choices exist, but options are still fairly limited.';
  return 'Outbound freight is spread across several destinations.';
}

function homeNetworkRead(bucketLabel: string | undefined, homeSelected: boolean): string {
  if (!bucketLabel) return 'Select a home hub to evaluate this market.';
  return homeSelected
    ? 'Part of the selected home-friendly network.'
    : 'Potential home base, scored by its leave-and-return network.';
}

function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not enough history';
  if (value < 1) return '<1 day';
  return `${value.toFixed(value < 10 ? 1 : 0)} days`;
}

function formatTypicalWait(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not enough history';
  if (value < 1) return '<1 day';
  if (value > 7) return '>7 days';
  return `${Math.round(value)} ${Math.round(value) === 1 ? 'day' : 'days'}`;
}

function formatLastSeen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not enough history';
  return `${formatDays(value)} ago`;
}

export function ZoneTooltip({
  zone,
  period,
  mode = 'volume',
  volumeMetric = 'total',
  visualBucket,
  homeSelected = false,
  showClose = false,
  onClose,
}: ZoneTooltipProps) {
  const totalLoads = zone.outbound_load_count + zone.inbound_load_count;
  const selectedVolume = volumeValue(zone, volumeMetric);
  const effectiveDestinations = Math.pow(2, zone.outbound_entropy);
  const outboundPct = totalLoads > 0 ? Math.round((zone.outbound_load_count / totalLoads) * 100) : 0;
  const inboundPct = totalLoads > 0 ? 100 - outboundPct : 0;
  const bucketLabel = visualBucket ? BUCKET_LABEL[visualBucket] : undefined;

  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-5 min-w-[320px] max-w-[390px] text-base">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="font-semibold text-base">{zone.display_city}, {zone.display_state}</p>
          <p className="text-base mt-1 text-muted-foreground">
            {mode === 'homeNetwork'
              ? homeNetworkRead(bucketLabel, homeSelected)
              : mode === 'optionality' ? optionalityRead(zone, effectiveDestinations) : marketRead(outboundPct, inboundPct)}
          </p>
        </div>
        {showClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {mode === 'volume' ? (
        <>
          <div className="mb-4">
            <p className="text-3xl font-semibold tabular-nums">{selectedVolume.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {volumeMetric} loads{bucketLabel ? ` · ${bucketLabel}` : ''}
            </p>
          </div>

          <div
            className="mb-4 h-2 overflow-hidden rounded-full bg-muted"
            aria-label={`Outbound share ${outboundPct}%, inbound share ${inboundPct}%`}
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
              style={{ width: `${outboundPct}%` }}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
            <dt className="text-muted-foreground">Outbound share</dt>
            <dd className="font-medium">{outboundPct}%</dd>
            <dt className="text-muted-foreground">Inbound share</dt>
            <dd className="font-medium">{inboundPct}%</dd>
            <dt className="text-muted-foreground">Outbound loads</dt>
            <dd className="font-medium">{zone.outbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Inbound loads</dt>
            <dd className="font-medium">{zone.inbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Total loads</dt>
            <dd className="font-medium">{totalLoads.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Typical outbound wait</dt>
            <dd className="font-medium">{formatTypicalWait(zone.outbound_median_wait_days)}</dd>
            <dt className="text-muted-foreground">Last outbound load</dt>
            <dd className="font-medium">{formatLastSeen(zone.outbound_days_since_last_load)}</dd>
            <dt className="text-muted-foreground">Outbound active days</dt>
            <dd className="font-medium">{zone.outbound_active_days ?? 0}</dd>
          </dl>
        </>
      ) : mode === 'homeNetwork' ? (
        <>
          <div className="mb-4">
            <p className="text-3xl font-semibold tabular-nums">{bucketLabel?.split(' ')[0] ?? 'Home'}</p>
            <p className="text-sm text-muted-foreground">
              {homeSelected ? 'home network fit' : 'home base quality'}{bucketLabel ? ` · ${bucketLabel}` : ''}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
            <dt className="text-muted-foreground">Outbound loads</dt>
            <dd className="font-medium">{zone.outbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Inbound loads</dt>
            <dd className="font-medium">{zone.inbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Outbound lanes</dt>
            <dd className="font-medium">{zone.outbound_lane_count}</dd>
            <dt className="text-muted-foreground">Typical outbound wait</dt>
            <dd className="font-medium">{formatTypicalWait(zone.outbound_median_wait_days)}</dd>
            <dt className="text-muted-foreground">Last outbound load</dt>
            <dd className="font-medium">{formatLastSeen(zone.outbound_days_since_last_load)}</dd>
            <dt className="text-muted-foreground">Effective destinations</dt>
            <dd className="font-medium">~{effectiveDestinations.toFixed(1)}</dd>
          </dl>
        </>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-3xl font-semibold tabular-nums">~{effectiveDestinations.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">
              effective outbound destinations{bucketLabel ? ` · ${bucketLabel}` : ''}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
            <dt className="text-muted-foreground">Outbound lanes</dt>
            <dd className="font-medium">{zone.outbound_lane_count}</dd>
            <dt className="text-muted-foreground">Outbound loads</dt>
            <dd className="font-medium">{zone.outbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Typical outbound wait</dt>
            <dd className="font-medium">{formatTypicalWait(zone.outbound_median_wait_days)}</dd>
            <dt className="text-muted-foreground">Last outbound load</dt>
            <dd className="font-medium">{formatLastSeen(zone.outbound_days_since_last_load)}</dd>
            <dt className="text-muted-foreground">Entropy (H)</dt>
            <dd className="font-medium">{zone.outbound_entropy.toFixed(2)} bits</dd>
            <dt className="text-muted-foreground">Data quality</dt>
            <dd className="font-medium capitalize">{zone.data_support}</dd>
          </dl>
        </>
      )}

      <p className="text-base text-muted-foreground mt-4">
        {`Based on ${PERIOD_LABEL[period]} historical orders`}
      </p>
    </div>
  );
}
