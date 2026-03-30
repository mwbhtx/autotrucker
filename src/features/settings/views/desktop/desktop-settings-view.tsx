"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings, useUpdateSettings } from "@/core/hooks/use-settings";
import { PlaceAutocomplete, type PlaceResult } from "@/features/routes/components/search-form";
import { TRAILER_CATEGORIES, expandTrailerCodes, codesToLabels } from "@mwbhtx/haulvisor-core";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/platform/web/components/ui/card";
import { Input } from "@/platform/web/components/ui/input";
import { Separator } from "@/platform/web/components/ui/separator";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { CheckIcon, LogOut } from "lucide-react";
import { ThemeSelector } from "@/features/settings/components/theme-selector";
import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";
import { useAuth } from "@/core/services/auth-provider";
import { Button } from "@/platform/web/components/ui/button";


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

const NAV_SECTIONS = [
  { id: "general", label: "General" },
  { id: "costs", label: "Operating Costs" },
  { id: "truck", label: "Truck & Capacity" },
  { id: "trailers", label: "Trailer Types" },
  { id: "certifications", label: "Certifications" },
  { id: "schedule", label: "Schedule" },
  { id: "appearance", label: "Appearance" },
] as const;

export function DesktopSettingsView() {
  const { data: settings, isLoading } = useSettings();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const save = useDebouncedSave();
  const [activeSection, setActiveSection] = useState<string>("general");

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
  const [avgMpg, setAvgMpg] = useState("");
  const [avgDrivingHours, setAvgDrivingHours] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxAssigned, setMaxAssigned] = useState("");
  const [maxIdle, setMaxIdle] = useState("");
  const [trailerLabels, setTrailerLabels] = useState<string[]>([]);
  const [hazmatCertified, setHazmatCertified] = useState(false);
  const [twicCard, setTwicCard] = useState(false);
  const [teamDriver, setTeamDriver] = useState(false);
  const [workDays, setWorkDays] = useState<string[]>([]);

  // Track whether initial sync has happened to avoid triggering saves
  const initialized = useRef(false);

  // Scroll to section on nav click
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Track active section on scroll
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handleScroll = () => {
      for (const section of NAV_SECTIONS) {
        const el = document.getElementById(`settings-${section.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) setActiveSection(section.id);
        }
      }
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);


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
    setAvgMpg(settings.avg_mpg != null ? String(settings.avg_mpg) : "");
    setAvgDrivingHours(settings.avg_driving_hours_per_day != null ? String(settings.avg_driving_hours_per_day) : "");
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setMaxAssigned(settings.max_assigned_orders != null ? String(settings.max_assigned_orders) : "");
    setMaxIdle(settings.max_idle_hours != null ? String(settings.max_idle_hours) : "");
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setHazmatCertified(settings.hazmat_certified ?? false);
    setTwicCard(settings.twic_card ?? false);
    setTeamDriver(settings.team_driver ?? false);
    setWorkDays(settings.work_days ?? []);
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
    avg_mpg: { min: 3, max: 12 },
    avg_driving_hours_per_day: { min: 6, max: 11 },
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
    <div className={`flex h-full ${isMobile ? "" : "-m-6 w-[calc(100%+3rem)]"}`}>
      {/* Side navigation — desktop only */}
      {!isMobile && (
        <nav className="w-48 shrink-0 border-r border-border/50 p-4 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}

      {/* Content */}
      <div ref={contentRef} className={`flex-1 overflow-y-auto space-y-10 ${isMobile ? "px-0 py-4" : "p-6"}`}>
        {/* General */}
        <section id="settings-general" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">General</h3>
            <p className="text-xs text-muted-foreground mt-1">Home location and search defaults.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Home Location</label>
            <PlaceAutocomplete
              placeholder="Search city, state..."
              value={
                homeCity && homeState
                  ? { name: `${homeCity}, ${homeState}`, lat: homeLat ?? 0, lng: homeLng ?? 0 }
                  : null
              }
              onSelect={handleLocationSelect}
            />
            <p className="text-sm text-muted-foreground">
              {homeCity && homeState
                ? "Route searches will find the best way home."
                : "Set a home location to default your round trip origin location."}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Max Deadhead (mi.)</label>
            <Input
              type="number"
              min={10}
              max={500}
              value={radius}
              onChange={(e) => handleNumberChange("preferred_radius_miles", e.target.value, setRadius)}
              placeholder="e.g. 250"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Cost Per Mile ($)</label>
            <Input
              type="number"
              min={0.5}
              max={10}
              step={0.01}
              value={costPerMile}
              onChange={(e) => handleNumberChange("cost_per_mile", e.target.value, setCostPerMile)}
              placeholder="e.g. 1.50"
            />
            <p className="text-sm text-muted-foreground">
              Flat override — when set, replaces the detailed cost breakdown.
            </p>
          </div>
        </section>

        <Separator />

        {/* Operating Costs */}
        <section id="settings-costs" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Operating Costs</h3>
            <p className="text-xs text-muted-foreground mt-1">Fine-tune your cost model. Leave blank to use industry defaults.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Diesel ($/gal)</label>
              <Input type="number" min={1} max={15} step={0.01} value={dieselPrice} onChange={(e) => handleNumberChange("diesel_price_per_gallon", e.target.value, setDieselPrice)} placeholder="3.85" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Maintenance ($/mi)</label>
              <Input type="number" min={0.01} max={1} step={0.01} value={maintenancePerMile} onChange={(e) => handleNumberChange("maintenance_per_mile", e.target.value, setMaintenancePerMile)} placeholder="0.15" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Tires ($/mi)</label>
              <Input type="number" min={0.01} max={0.5} step={0.01} value={tiresPerMile} onChange={(e) => handleNumberChange("tires_per_mile", e.target.value, setTiresPerMile)} placeholder="0.04" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Truck payment ($/day)</label>
              <Input type="number" min={0} max={500} step={1} value={truckPaymentPerDay} onChange={(e) => handleNumberChange("truck_payment_per_day", e.target.value, setTruckPaymentPerDay)} placeholder="65" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Insurance ($/day)</label>
              <Input type="number" min={0} max={300} step={1} value={insurancePerDay} onChange={(e) => handleNumberChange("insurance_per_day", e.target.value, setInsurancePerDay)} placeholder="40" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Per diem ($/day)</label>
              <Input type="number" min={0} max={200} step={1} value={perDiemPerDay} onChange={(e) => handleNumberChange("per_diem_per_day", e.target.value, setPerDiemPerDay)} placeholder="69" />
            </div>
          </div>
        </section>

        <Separator />

        {/* Truck & Capacity */}
        <section id="settings-truck" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Truck & Capacity</h3>
            <p className="text-xs text-muted-foreground mt-1">Vehicle specs and load limits.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Truck Avg. MPG</label>
              <Input type="number" min={3} max={12} step={0.1} value={avgMpg} onChange={(e) => handleNumberChange("avg_mpg", e.target.value, setAvgMpg)} placeholder="6.0" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Avg. Driving Hours/Day</label>
              <Input type="number" min={6} max={11} step={1} value={avgDrivingHours} onChange={(e) => handleNumberChange("avg_driving_hours_per_day", e.target.value, setAvgDrivingHours)} placeholder="11" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Max Weight (lbs)</label>
            <Input type="number" min={1000} max={80000} step={1000} value={maxWeight} onChange={(e) => handleNumberChange("max_weight", e.target.value, setMaxWeight)} placeholder="e.g. 45000" />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Max Assigned Orders</label>
            <select
              value={maxAssigned}
              onChange={(e) => handleNumberChange("max_assigned_orders", e.target.value, setMaxAssigned)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Not set</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <p className="text-sm text-muted-foreground">
              How many orders you can carry at once. Loads beyond this are speculative.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium block">Max Idle Between Loads</label>
            <select
              value={maxIdle}
              onChange={(e) => handleNumberChange("max_idle_hours", e.target.value, setMaxIdle)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Not set (use filter bar)</option>
              <option value="2">2 Hours</option>
              <option value="4">4 Hours</option>
              <option value="8">8 Hours</option>
              <option value="24">24 Hours</option>
            </select>
            <p className="text-sm text-muted-foreground">
              Maximum idle time between delivering one load and picking up the next.
              This sets your default — you can still override it on the filter bar.
            </p>
          </div>
        </section>

        <Separator />

        {/* Trailer Types */}
        <section id="settings-trailers" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Trailer Types</h3>
            <p className="text-xs text-muted-foreground mt-1">Select the trailers you can haul.</p>
          </div>

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
          <p className="text-sm text-muted-foreground">
            {trailerLabels.length === 0
              ? "No filter — all trailer types shown."
              : `Filtering to ${trailerLabels.join(", ")} and compatible combos.`}
          </p>
        </section>

        <Separator />

        {/* Certifications */}
        <section id="settings-certifications" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Certifications</h3>
            <p className="text-xs text-muted-foreground mt-1">Endorsements and qualifications.</p>
          </div>

          <div className="space-y-2">
            <CertToggle label="Hazmat Certified" checked={hazmatCertified} onChange={() => handleBoolToggle("hazmat_certified", hazmatCertified, setHazmatCertified)} />
            <CertToggle label="TWIC Card" checked={twicCard} onChange={() => handleBoolToggle("twic_card", twicCard, setTwicCard)} />
            <CertToggle label="Team Driver" checked={teamDriver} onChange={() => handleBoolToggle("team_driver", teamDriver, setTeamDriver)} />
          </div>
        </section>

        <Separator />

        {/* Schedule */}
        <section id="settings-schedule" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Schedule</h3>
            <p className="text-xs text-muted-foreground mt-1">Set your available work days.</p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => {
                const allSelected = workDays.length === 0 || workDays.length === 7;
                const selected = allSelected || workDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const next = workDays.includes(day)
                        ? workDays.filter((d) => d !== day)
                        : [...workDays, day];
                      const resolved = next.length === 7 ? [] : next;
                      setWorkDays(resolved);
                      if (initialized.current) save({ work_days: resolved.length > 0 ? resolved : null });
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setWorkDays([]); if (initialized.current) save({ work_days: null }); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                All days
              </button>
              <span className="text-sm text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => { const wd = ["Mon", "Tue", "Wed", "Thu", "Fri"]; setWorkDays(wd); if (initialized.current) save({ work_days: wd }); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Weekdays only
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Routes won&apos;t include pickups or deliveries on your off days.
            </p>
          </div>
        </section>

        <Separator />

        {/* Appearance */}
        <section id="settings-appearance" className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Appearance</h3>
            <p className="text-xs text-muted-foreground mt-1">Theme and display preferences.</p>
          </div>

          <ThemeSelector />
        </section>

        {isMobile && (
          <>
            <Separator />
            <Button
              variant="destructive"
              onClick={logout}
              className="w-full max-w-2xl gap-2 h-12 text-base"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </>
        )}
      </div>
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
        {checked && <CheckIcon className="h-4 w-4" />}
      </div>
    </button>
  );
}
