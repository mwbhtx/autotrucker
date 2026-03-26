"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings, useUpdateSettings } from "@/lib/hooks/use-settings";
import { PlaceAutocomplete, type PlaceResult } from "@/components/map/search-form";
import { TRAILER_CATEGORIES, expandTrailerCodes, codesToLabels } from "@/lib/trailer-types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon } from "lucide-react";

/** Debounce hook — returns a function that delays calling `fn` */
function useDebouncedSave(delayMs = 800) {
  const updateSettings = useUpdateSettings();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (data: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        updateSettings.mutate(data as any);
      }, delayMs);
    },
    [updateSettings, delayMs],
  );

  // Cancel pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return save;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const save = useDebouncedSave();

  // Local state for form fields
  const [homeCity, setHomeCity] = useState("");
  const [homeState, setHomeState] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [radius, setRadius] = useState("");
  const [costPerMile, setCostPerMile] = useState("");
  const [dieselPrice, setDieselPrice] = useState("");
  const [maintenancePerMile, setMaintenancePerMile] = useState("");
  const [tiresPerMile, setTiresPerMile] = useState("");
  const [truckPaymentPerDay, setTruckPaymentPerDay] = useState("");
  const [insurancePerDay, setInsurancePerDay] = useState("");
  const [perDiemPerDay, setPerDiemPerDay] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxAssigned, setMaxAssigned] = useState("");
  const [trailerLabels, setTrailerLabels] = useState<string[]>([]);
  const [hazmatCertified, setHazmatCertified] = useState(false);
  const [twicCard, setTwicCard] = useState(false);
  const [teamDriver, setTeamDriver] = useState(false);

  // Track whether initial sync has happened to avoid triggering saves
  const initialized = useRef(false);


  // Sync from API on load
  useEffect(() => {
    if (!settings) return;
    setHomeCity(settings.home_base_city ?? "");
    setHomeState(settings.home_base_state ?? "");
    setHomeLat(settings.home_base_lat ?? null);
    setHomeLng(settings.home_base_lng ?? null);
    setRadius(settings.preferred_radius_miles != null ? String(settings.preferred_radius_miles) : "");
    setCostPerMile(settings.cost_per_mile != null ? String(settings.cost_per_mile) : "");
    setDieselPrice(settings.diesel_price_per_gallon != null ? String(settings.diesel_price_per_gallon) : "");
    setMaintenancePerMile(settings.maintenance_per_mile != null ? String(settings.maintenance_per_mile) : "");
    setTiresPerMile(settings.tires_per_mile != null ? String(settings.tires_per_mile) : "");
    setTruckPaymentPerDay(settings.truck_payment_per_day != null ? String(settings.truck_payment_per_day) : "");
    setInsurancePerDay(settings.insurance_per_day != null ? String(settings.insurance_per_day) : "");
    setPerDiemPerDay(settings.per_diem_per_day != null ? String(settings.per_diem_per_day) : "");
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setMaxAssigned(settings.max_assigned_orders != null ? String(settings.max_assigned_orders) : "");
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setHazmatCertified(settings.hazmat_certified ?? false);
    setTwicCard(settings.twic_card ?? false);
    setTeamDriver(settings.team_driver ?? false);
    // Mark initialized after a tick so the first render doesn't trigger saves
    setTimeout(() => { initialized.current = true; }, 100);
  }, [settings]);

  // --- Auto-save helpers ---

  function saveLocation(city: string, state: string, lat: number | null, lng: number | null) {
    if (city && state) {
      save({
        home_base_city: city,
        home_base_state: state,
        ...(lat != null && lng != null ? { home_base_lat: lat, home_base_lng: lng } : {}),
      });
    } else {
      save({ home_base_city: null, home_base_state: null, home_base_lat: null, home_base_lng: null });
    }
  }

  const NUMBER_CONSTRAINTS: Record<string, { min: number; max: number }> = {
    preferred_radius_miles: { min: 10, max: 500 },
    cost_per_mile: { min: 0.5, max: 10 },
    diesel_price_per_gallon: { min: 1, max: 15 },
    maintenance_per_mile: { min: 0.01, max: 1 },
    tires_per_mile: { min: 0.01, max: 0.5 },
    truck_payment_per_day: { min: 0, max: 500 },
    insurance_per_day: { min: 0, max: 300 },
    per_diem_per_day: { min: 0, max: 200 },
    max_weight: { min: 1000, max: 80000 },
    max_assigned_orders: { min: 1, max: 5 },
  };

  function saveNumber(key: string, value: string) {
    if (value === "" || value === null) {
      save({ [key]: null });
    } else {
      const num = Number(value);
      if (isNaN(num)) return;
      const constraints = NUMBER_CONSTRAINTS[key];
      if (constraints && (num < constraints.min || num > constraints.max)) return;
      save({ [key]: num });
    }
  }

  function saveTrailers(labels: string[]) {
    if (labels.length === 0) {
      save({ trailer_types: null });
    } else {
      save({ trailer_types: expandTrailerCodes(labels) });
    }
  }

  function saveBool(key: string, value: boolean) {
    save({ [key]: value || null });
  }

  // --- Handlers ---

  function handleLocationSelect(place: PlaceResult | null) {
    if (place) {
      const parts = place.name.split(",").map((s) => s.trim());
      const c = parts[0] || "";
      const s = parts[1] || "";
      setHomeCity(c);
      setHomeState(s);
      setHomeLat(place.lat);
      setHomeLng(place.lng);
      if (initialized.current) saveLocation(c, s, place.lat, place.lng);
    } else {
      setHomeCity("");
      setHomeState("");
      setHomeLat(null);
      setHomeLng(null);
      if (initialized.current) saveLocation("", "", null, null);
    }
  }

  function handleLocationClear() {
    setHomeCity("");
    setHomeState("");
    setHomeLat(null);
    setHomeLng(null);
    if (initialized.current) saveLocation("", "", null, null);
  }

  function handleNumberChange(
    key: string,
    value: string,
    setter: (v: string) => void,
  ) {
    setter(value);
    if (initialized.current) saveNumber(key, value);
  }

  function handleTrailerToggle(label: string) {
    setTrailerLabels((prev) => {
      const next = prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label];
      if (initialized.current) saveTrailers(next);
      return next;
    });
  }

  function handleBoolToggle(
    key: string,
    current: boolean,
    setter: (v: boolean) => void,
  ) {
    const next = !current;
    setter(next);
    if (initialized.current) saveBool(key, next);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Configure your haulvisor preferences.
          </p>
        </div>
        <Card className="max-w-2xl">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your driver profile. Changes save automatically.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Driver Profile</CardTitle>
          <CardDescription>
            These settings filter which orders appear in route searches. Clear a field to disable it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Home Location */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Home Location</label>
            <PlaceAutocomplete
              placeholder="Search city, state..."
              value={
                homeCity && homeState
                  ? { name: `${homeCity}, ${homeState}`, lat: homeLat ?? 0, lng: homeLng ?? 0 }
                  : null
              }
              onSelect={handleLocationSelect}
            />
            <p className="text-xs text-muted-foreground">
              {homeCity && homeState
                ? "Route searches will find the best way home."
                : "Set a home location to enable Routes Home."}
            </p>
          </div>

          {/* Max Deadhead */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Max Deadhead (mi.)</label>
            <Input
              type="number"
              min={10}
              max={500}
              value={radius}
              onChange={(e) => handleNumberChange("preferred_radius_miles", e.target.value, setRadius)}
              placeholder="e.g. 250"
            />
          </div>

          {/* Cost Per Mile */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Cost Per Mile ($)</label>
            <Input
              type="number"
              min={0.5}
              max={10}
              step={0.01}
              value={costPerMile}
              onChange={(e) => handleNumberChange("cost_per_mile", e.target.value, setCostPerMile)}
              placeholder="e.g. 1.50"
            />
            <p className="text-xs text-muted-foreground">
              Flat override — when set, replaces the detailed cost breakdown below.
            </p>
          </div>

          <Separator />

          {/* Operating Costs */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Operating Costs</h3>
            <p className="text-xs text-muted-foreground">
              Fine-tune your cost model. Leave blank to use industry defaults.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium block">Diesel ($/gal)</label>
              <Input
                type="number"
                min={1}
                max={15}
                step={0.01}
                value={dieselPrice}
                onChange={(e) => handleNumberChange("diesel_price_per_gallon", e.target.value, setDieselPrice)}
                placeholder="3.85"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block">Maintenance ($/mi)</label>
              <Input
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={maintenancePerMile}
                onChange={(e) => handleNumberChange("maintenance_per_mile", e.target.value, setMaintenancePerMile)}
                placeholder="0.15"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block">Tires ($/mi)</label>
              <Input
                type="number"
                min={0.01}
                max={0.5}
                step={0.01}
                value={tiresPerMile}
                onChange={(e) => handleNumberChange("tires_per_mile", e.target.value, setTiresPerMile)}
                placeholder="0.04"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block">Truck payment ($/day)</label>
              <Input
                type="number"
                min={0}
                max={500}
                step={1}
                value={truckPaymentPerDay}
                onChange={(e) => handleNumberChange("truck_payment_per_day", e.target.value, setTruckPaymentPerDay)}
                placeholder="65"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block">Insurance ($/day)</label>
              <Input
                type="number"
                min={0}
                max={300}
                step={1}
                value={insurancePerDay}
                onChange={(e) => handleNumberChange("insurance_per_day", e.target.value, setInsurancePerDay)}
                placeholder="40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium block">Per diem ($/day)</label>
              <Input
                type="number"
                min={0}
                max={200}
                step={1}
                value={perDiemPerDay}
                onChange={(e) => handleNumberChange("per_diem_per_day", e.target.value, setPerDiemPerDay)}
                placeholder="69"
              />
            </div>
          </div>

          <Separator />

          {/* Max Weight */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Max Weight (lbs)</label>
            <Input
              type="number"
              min={1000}
              max={80000}
              step={1000}
              value={maxWeight}
              onChange={(e) => handleNumberChange("max_weight", e.target.value, setMaxWeight)}
              placeholder="e.g. 45000"
            />
          </div>

          {/* Max Assigned Orders */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Max Assigned Orders</label>
            <select
              value={maxAssigned}
              onChange={(e) => handleNumberChange("max_assigned_orders", e.target.value, setMaxAssigned)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Not set</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <p className="text-xs text-muted-foreground">
              How many orders you can carry at once. Legs beyond this are speculative.
            </p>
          </div>

          <Separator />

          {/* Trailer Types */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Trailer Types</label>
            <div className="flex flex-wrap gap-2">
              {TRAILER_CATEGORIES.map((cat) => {
                const selected = trailerLabels.includes(cat.label);
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => handleTrailerToggle(cat.label)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {trailerLabels.length === 0
                ? "No filter — all trailer types shown."
                : `Filtering to ${trailerLabels.join(", ")} and compatible combos.`}
            </p>
          </div>

          <Separator />

          {/* Certifications */}
          <div className="space-y-3">
            <label className="text-sm font-medium mb-2 block">Certifications</label>
            <CertToggle
              label="Hazmat Certified"
              checked={hazmatCertified}
              onChange={() => handleBoolToggle("hazmat_certified", hazmatCertified, setHazmatCertified)}
            />
            <CertToggle
              label="TWIC Card"
              checked={twicCard}
              onChange={() => handleBoolToggle("twic_card", twicCard, setTwicCard)}
            />
            <CertToggle
              label="Team Driver"
              checked={teamDriver}
              onChange={() => handleBoolToggle("team_driver", teamDriver, setTeamDriver)}
            />
          </div>

          <Separator />

        </CardContent>
      </Card>
    </div>
  );
}

function CertToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
    >
      <span>{label}</span>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input"
        }`}
      >
        {checked && <CheckIcon className="h-3 w-3" />}
      </div>
    </button>
  );
}
