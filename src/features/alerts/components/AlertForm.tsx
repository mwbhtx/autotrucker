"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import type { Alert, AlertCriteria, CreateAlertInput, UpdateAlertInput } from "../types";

const WINDOW_OPTIONS = [24, 48, 72, 168];

interface AlertFormProps {
  initial?: Alert;
  onSubmit: (data: CreateAlertInput | UpdateAlertInput) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function AlertForm({ initial, onSubmit, onCancel, submitLabel }: AlertFormProps) {
  const [name, setName] = useState(initial?.name || "");
  const [windowHours, setWindowHours] = useState<number>(initial?.rolling_window_hours || 72);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(initial?.sms_enabled ?? true);
  const [originLat, setOriginLat] = useState<string>(initial?.criteria?.origin_lat?.toString() || "");
  const [originLng, setOriginLng] = useState<string>(initial?.criteria?.origin_lng?.toString() || "");
  const [destLat, setDestLat] = useState<string>(initial?.criteria?.destination_lat?.toString() || "");
  const [destLng, setDestLng] = useState<string>(initial?.criteria?.destination_lng?.toString() || "");
  const [destCity, setDestCity] = useState<string>(initial?.criteria?.destination_city || "");
  const [trailerTypes, setTrailerTypes] = useState<string>(initial?.criteria?.trailer_types || "");
  const [minDailyProfit, setMinDailyProfit] = useState<string>(
    initial?.criteria?.min_daily_profit?.toString() || "",
  );
  const [maxWeight, setMaxWeight] = useState<string>(initial?.criteria?.max_weight?.toString() || "");
  const [maxDeadheadPct, setMaxDeadheadPct] = useState<string>(
    initial?.criteria?.max_deadhead_pct?.toString() || "",
  );
  const [numOrders, setNumOrders] = useState<number>(initial?.criteria?.num_orders || 2);
  const [hazmat, setHazmat] = useState<boolean>(initial?.criteria?.hazmat_certified ?? false);
  const [twic, setTwic] = useState<boolean>(initial?.criteria?.twic_card ?? false);
  const [team, setTeam] = useState<boolean>(initial?.criteria?.team_driver ?? false);
  const [noTarps, setNoTarps] = useState<boolean>(initial?.criteria?.no_tarps ?? false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your alert a name");
      return;
    }
    const lat = parseFloat(originLat);
    const lng = parseFloat(originLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Origin lat/lng required");
      return;
    }

    const criteria: AlertCriteria = {
      origin_lat: lat,
      origin_lng: lng,
      num_orders: numOrders,
      hazmat_certified: hazmat,
      twic_card: twic,
      team_driver: team,
      no_tarps: noTarps,
    };
    if (destLat) criteria.destination_lat = parseFloat(destLat);
    if (destLng) criteria.destination_lng = parseFloat(destLng);
    if (destCity) criteria.destination_city = destCity;
    if (trailerTypes) criteria.trailer_types = trailerTypes;
    if (minDailyProfit) criteria.min_daily_profit = parseFloat(minDailyProfit);
    if (maxWeight) criteria.max_weight = parseFloat(maxWeight);
    if (maxDeadheadPct) criteria.max_deadhead_pct = parseFloat(maxDeadheadPct);

    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), criteria, rolling_window_hours: windowHours, sms_enabled: smsEnabled });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Alert name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wharton round-trip $2.25+"
          maxLength={80}
          disabled={busy}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Origin lat">
          <Input value={originLat} onChange={(e) => setOriginLat(e.target.value)} placeholder="29.31" disabled={busy} />
        </Field>
        <Field label="Origin lng">
          <Input value={originLng} onChange={(e) => setOriginLng(e.target.value)} placeholder="-96.10" disabled={busy} />
        </Field>
      </div>

      <Field label="Destination city (optional)">
        <Input value={destCity} onChange={(e) => setDestCity(e.target.value)} placeholder="Dallas" disabled={busy} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination lat (optional)">
          <Input value={destLat} onChange={(e) => setDestLat(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Destination lng (optional)">
          <Input value={destLng} onChange={(e) => setDestLng(e.target.value)} disabled={busy} />
        </Field>
      </div>

      <Field label="Trailer types (comma-separated codes)">
        <Input
          value={trailerTypes}
          onChange={(e) => setTrailerTypes(e.target.value)}
          placeholder="V,RGN,F"
          disabled={busy}
        />
      </Field>

      <Field label="Min daily net ($/day)">
        <Input
          value={minDailyProfit}
          onChange={(e) => setMinDailyProfit(e.target.value)}
          placeholder="400"
          disabled={busy}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Max weight (lbs)">
          <Input value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder="45000" disabled={busy} />
        </Field>
        <Field label="Max deadhead %">
          <Input
            value={maxDeadheadPct}
            onChange={(e) => setMaxDeadheadPct(e.target.value)}
            placeholder="25"
            disabled={busy}
          />
        </Field>
      </div>

      <Field label="Legs per match (1 or 2)">
        <div className="flex gap-2">
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumOrders(n)}
              className={
                "rounded-md border px-3 py-1 text-sm transition-colors " +
                (numOrders === n ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")
              }
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Look-ahead window">
        <div className="flex gap-2">
          {WINDOW_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setWindowHours(h)}
              className={
                "rounded-md border px-3 py-1 text-sm transition-colors " +
                (windowHours === h ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")
              }
            >
              {h >= 168 ? "7 days" : `${h}h`}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <CheckRow label="Hazmat certified" value={hazmat} onChange={setHazmat} />
        <CheckRow label="TWIC card" value={twic} onChange={setTwic} />
        <CheckRow label="Team driver" value={team} onChange={setTeam} />
        <CheckRow label="No tarps" value={noTarps} onChange={setNoTarps} />
        <CheckRow label="SMS enabled" value={smsEnabled} onChange={setSmsEnabled} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {submitLabel || (initial ? "Save changes" : "Create alert")}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
    >
      <span>{label}</span>
      <div
        className={
          "flex h-5 w-5 items-center justify-center rounded border transition-colors " +
          (value ? "border-primary bg-primary text-primary-foreground" : "border-border")
        }
      >
        {value && <span className="text-xs">✓</span>}
      </div>
    </button>
  );
}
