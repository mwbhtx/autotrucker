"use client";

import type { FreightZoneSummary } from '@mwbhtx/haulvisor-core';

interface ZoneTooltipProps {
  zone: FreightZoneSummary;
  period: '30d' | '60d' | '90d';
  periodNote: string;
  showClose?: boolean;
  onClose?: () => void;
}

const BUCKET_LABEL: Record<FreightZoneSummary['optionality_bucket'], string> = {
  high:     'Many outbound options',
  medium:   'Some outbound options',
  low:      'Few outbound options',
  low_data: 'Not enough historical data',
};

const BUCKET_COLOR: Record<FreightZoneSummary['optionality_bucket'], string> = {
  high:     'text-green-500',
  medium:   'text-amber-500',
  low:      'text-rose-500',
  low_data: 'text-slate-400',
};

const PERIOD_LABEL: Record<string, string> = {
  '30d': 'last 30 days',
  '60d': 'last 60 days',
  '90d': 'last 90 days',
};

export function ZoneTooltip({ zone, period, periodNote, showClose = false, onClose }: ZoneTooltipProps) {
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-5 min-w-[300px] max-w-[360px] text-base">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="font-semibold text-base">{zone.display_city}, {zone.display_state}</p>
          <p className={`text-base mt-1 ${BUCKET_COLOR[zone.optionality_bucket]}`}>
            {BUCKET_LABEL[zone.optionality_bucket]}
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

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
        <dt className="text-muted-foreground">Outbound loads</dt>
        <dd className="font-medium">{zone.outbound_load_count.toLocaleString()}</dd>
        <dt className="text-muted-foreground">Inbound loads</dt>
        <dd className="font-medium">{zone.inbound_load_count.toLocaleString()}</dd>
        <dt className="text-muted-foreground">Outbound lanes</dt>
        <dd className="font-medium">{zone.outbound_lane_count}</dd>
        {zone.optionality_bucket !== 'low_data' && (
          <>
            <dt className="text-muted-foreground">Entropy (H)</dt>
            <dd className="font-medium">{zone.outbound_entropy.toFixed(2)} bits</dd>
          </>
        )}
        <dt className="text-muted-foreground">Data quality</dt>
        <dd className="font-medium capitalize">{zone.data_support}</dd>
      </dl>

      <p className="text-base text-muted-foreground mt-4">
        {`Based on ${PERIOD_LABEL[period]} historical orders`}
      </p>
    </div>
  );
}
