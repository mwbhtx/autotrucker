"use client";

import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';
import type { MapMode, VisualBucket } from '../utils/map-mode-types';
import { TIER_COLOR, TIER_LABEL } from '../utils/map-mode-types';

interface ZoneTooltipProps {
  zone: FreightZoneSummary;
  period: '30d' | '60d' | '90d';
  mode?: MapMode;
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

function homeNetworkRead(bucketLabel: string | undefined, homeSelected: boolean): string {
  if (!bucketLabel) return 'Select a home hub to evaluate this market.';
  return homeSelected
    ? 'Part of the selected outbound network.'
    : 'Potential home base, scored by its outbound reach.';
}

function networkRead(zone: FreightZoneSummary): string {
  const tier = zone.quality?.tier;
  if (!tier || tier === 'dim') return 'Below the active tier filter — limited freight history or weaker scoring signals.';
  if (tier === 'gold')   return 'Top-tier delivery target — strong volume, options, freshness, and pay history.';
  if (tier === 'silver') return 'Strong delivery target — most signals favorable, a couple of weaker spots.';
  return 'Solid delivery target — viable, but watch the weaker subscores below before chasing.';
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

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}/mi`;
}

function rgbToCss([r, g, b]: [number, number, number], alpha = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SUBSCORE_LABEL = {
  volume:         'Outbound volume',
  optionality:    'Outbound options',
  recency:        'Recency',
  cadence:        'Cadence',
  rate:           'Outbound $/mi',
} satisfies Partial<Record<keyof NonNullable<FreightZoneSummary['quality']>['subscores'], string>>;

export function ZoneTooltip({
  zone,
  period,
  mode = 'network',
  visualBucket,
  homeSelected = false,
  showClose = false,
  onClose,
}: ZoneTooltipProps) {
  const bucketLabel = visualBucket ? BUCKET_LABEL[visualBucket] : undefined;
  const tier = zone.quality?.tier ?? 'dim';
  const tierColor = TIER_COLOR[tier];

  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-5 min-w-[320px] max-w-[420px] text-base">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="font-semibold text-base">{zone.display_city}, {zone.display_state}</p>
          <p className="text-base mt-1 text-muted-foreground">
            {mode === 'homeNetwork' ? homeNetworkRead(bucketLabel, homeSelected) : networkRead(zone)}
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

      {mode === 'network' ? (
        <>
          <div className="mb-4 flex items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums">{zone.quality?.composite ?? '—'}</p>
            <span
              className="text-sm font-medium px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: rgbToCss(tierColor, 0.18), color: rgbToCss(tierColor, 1) }}
            >
              {TIER_LABEL[tier]}
            </span>
          </div>

          {zone.quality && (
            <div className="mb-4 space-y-1.5">
              {(Object.keys(SUBSCORE_LABEL) as Array<keyof typeof SUBSCORE_LABEL>).map((key) => {
                const value = zone.quality!.subscores[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-32 shrink-0">{SUBSCORE_LABEL[key]}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${value}%`, backgroundColor: rgbToCss(tierColor, 0.85) }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums w-8 text-right">{value}</span>
                  </div>
                );
              })}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
            <dt className="text-muted-foreground">Outbound loads</dt>
            <dd className="font-medium">{zone.outbound_load_count.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Outbound lanes</dt>
            <dd className="font-medium">{zone.outbound_lane_count}</dd>
            <dt className="text-muted-foreground">Outbound $/mi</dt>
            <dd className="font-medium">{formatRate(zone.outbound_median_rate_per_mile)}</dd>
            <dt className="text-muted-foreground">Last outbound seen</dt>
            <dd className="font-medium">{formatLastSeen(zone.outbound_days_since_last_load)}</dd>
            <dt className="text-muted-foreground">Typical outbound wait</dt>
            <dd className="font-medium">{formatTypicalWait(zone.outbound_median_wait_days)}</dd>
          </dl>
        </>
      ) : (
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
            <dt className="text-muted-foreground">Outbound lanes</dt>
            <dd className="font-medium">{zone.outbound_lane_count}</dd>
            <dt className="text-muted-foreground">Typical outbound wait</dt>
            <dd className="font-medium">{formatTypicalWait(zone.outbound_median_wait_days)}</dd>
            <dt className="text-muted-foreground">Last outbound seen</dt>
            <dd className="font-medium">{formatLastSeen(zone.outbound_days_since_last_load)}</dd>
          </dl>
        </>
      )}

      <p className="text-base text-muted-foreground mt-4">
        {`Based on ${PERIOD_LABEL[period]} historical orders`}
      </p>
    </div>
  );
}
