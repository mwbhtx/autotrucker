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
  high:     'High outbound optionality',
  medium:   'Moderate outbound optionality',
  low:      'Low outbound optionality',
  low_data: 'Insufficient historical data for optionality signal',
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
    <div className="bg-background/95 border rounded-lg shadow-lg p-4 min-w-[220px] max-w-[280px]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-sm">{zone.display_city}, {zone.display_state}</p>
          <p className={`text-xs mt-0.5 ${BUCKET_COLOR[zone.optionality_bucket]}`}>
            {BUCKET_LABEL[zone.optionality_bucket]}
          </p>
        </div>
        {showClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
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

      <p className="text-[10px] text-muted-foreground mt-3">
        {`Based on ${PERIOD_LABEL[period]} historical orders`}
      </p>
    </div>
  );
}
