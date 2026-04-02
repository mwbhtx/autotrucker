"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/platform/web/components/ui/input";
import { Calendar } from "@/platform/web/components/ui/calendar";
import { Slider } from "@/platform/web/components/ui/slider";
import { cn } from "@/core/utils";
import {
  TRAILER_CATEGORIES,
  expandTrailerCodes,
  codesToLabels,
  ALL_WORK_DAYS,
  DEFAULT_MAX_TRIP_DAYS,
  DEFAULT_NUM_ORDERS,
  ORDER_COUNT_OPTIONS,
} from "@mwbhtx/haulvisor-core";
import { useSettings, useUpdateSettings } from "@/core/hooks/use-settings";

export interface AdvancedFilters {
  numOrders: number;
  departureDate: string;
  daysOut: number;
}

interface FiltersSheetProps {
  onBack: () => void;
  onApply: (filters: AdvancedFilters) => void;
  initialFilters?: Partial<AdvancedFilters>;
}

function formatDate(iso: string): string {
  if (!iso) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function FilterRow({
  label,
  value,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-4"
      >
        <span className="text-base text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-base font-medium">{value}</span>
          <svg
            className={cn("h-5 w-5 text-muted-foreground transition-transform", expanded && "rotate-180")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-4 border-b border-white/5"
    >
      <span className="text-base text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-white/20",
        )}
      >
        {checked && <span className="text-sm font-bold">✓</span>}
      </div>
    </button>
  );
}

export function FiltersSheet({ onBack, onApply, initialFilters }: FiltersSheetProps) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  // Per-search filters
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [numOrders, setNumOrders] = useState(initialFilters?.numOrders ?? DEFAULT_NUM_ORDERS);
  const [departureDate, setDepartureDate] = useState(initialFilters?.departureDate ?? tomorrow);
  const [daysOut, setDaysOut] = useState(initialFilters?.daysOut ?? DEFAULT_MAX_TRIP_DAYS);

  // Settings-based filters
  const [trailerLabels, setTrailerLabels] = useState<string[]>([]);
  const [maxWeight, setMaxWeight] = useState("");
  const [searchRadius, setSearchRadius] = useState(250);
  const [noTarps, setNoTarps] = useState(false);
  const [hazmat, setHazmat] = useState(false);
  const [twic, setTwic] = useState(false);
  const [team, setTeam] = useState(false);
  const [workDays, setWorkDays] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings) return;
    setTrailerLabels(codesToLabels(settings.trailer_types ?? []));
    setMaxWeight(settings.max_weight != null ? String(settings.max_weight) : "");
    setSearchRadius(settings.preferred_radius_miles ?? 250);
    setNoTarps(settings.no_tarps ?? false);
    setHazmat(settings.hazmat_certified ?? false);
    setTwic(settings.twic_card ?? false);
    setTeam(settings.team_driver ?? false);
    setWorkDays(settings.work_days ?? []);
    setTimeout(() => { initialized.current = true; }, 100);
  }, [settings]);

  function save(data: Record<string, unknown>) {
    updateSettings.mutate(data as any);
  }

  function handleTrailerToggle(label: string) {
    setTrailerLabels((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      if (initialized.current) save({ trailer_types: next.length > 0 ? expandTrailerCodes(next) : null });
      return next;
    });
  }

  function handleBool(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    if (initialized.current) save({ [key]: next || null });
  }

  function handleWorkDayToggle(day: string) {
    setWorkDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      const normalized = next.length === 7 ? [] : next;
      if (initialized.current) save({ work_days: normalized.length > 0 ? normalized : null });
      return normalized;
    });
  }

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const toggle = (row: string) => setExpandedRow((prev) => (prev === row ? null : row));

  const handleBack = () => {
    onApply({ numOrders, departureDate, daysOut });
  };

  const returnLabel = (() => {
    const d = new Date(departureDate + "T00:00:00");
    d.setDate(d.getDate() + daysOut);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  })();

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button type="button" onClick={handleBack} className="flex items-center justify-center h-9 w-9 rounded-full bg-white shrink-0">
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h1 className="text-base font-semibold">Filters</h1>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Number of Orders */}
        <FilterRow
          label="Number of Orders"
          value={numOrders === 0 ? "Any" : String(numOrders)}
          expanded={expandedRow === "numOrders"}
          onToggle={() => toggle("numOrders")}
        >
          <div className="flex gap-2 mt-1">
            {ORDER_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumOrders(n)}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors",
                  numOrders === n
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                {n === 0 ? "Any" : String(n)}
              </button>
            ))}
          </div>
        </FilterRow>

        {/* Departure Date */}
        <FilterRow
          label="Departure Date"
          value={formatDate(departureDate)}
          expanded={expandedRow === "departure"}
          onToggle={() => toggle("departure")}
        >
          <div className="rounded-lg border border-white/10 overflow-hidden mt-3">
            <Calendar
              mode="single"
              selected={new Date(departureDate + "T00:00:00")}
              disabled={{ before: new Date() }}
              onSelect={(day: Date | undefined) => {
                if (day) {
                  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  setDepartureDate(iso);
                }
              }}
              defaultMonth={new Date(departureDate + "T00:00:00")}
            />
          </div>
        </FilterRow>

        {/* Days Out */}
        <FilterRow
          label="Days Out"
          value={`${daysOut} days`}
          expanded={expandedRow === "daysOut"}
          onToggle={() => toggle("daysOut")}
        >
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max trip length</span>
              <span className="font-semibold">{daysOut} {daysOut === 1 ? "day" : "days"}</span>
            </div>
            <Slider
              value={[daysOut]}
              min={1}
              max={10}
              step={1}
              onValueChange={([v]) => setDaysOut(v)}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1 day</span>
              <span>10 days</span>
            </div>
            <p className="text-sm text-muted-foreground">Home by {returnLabel}</p>
          </div>
        </FilterRow>

        {/* Trailer Types */}
        <FilterRow
          label="Trailer Types"
          value={trailerLabels.length === 0 ? "All" : `${trailerLabels.length} selected`}
          expanded={expandedRow === "trailerTypes"}
          onToggle={() => toggle("trailerTypes")}
        >
          <div className="mt-2 rounded-lg border border-white/10 overflow-hidden">
            {TRAILER_CATEGORIES.map((cat) => {
              const selected = trailerLabels.includes(cat.label);
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleTrailerToggle(cat.label)}
                  className="flex w-full items-center justify-between px-3 py-3 text-base hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <span>{cat.label}</span>
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-white/20",
                  )}>
                    {selected && <span className="text-xs font-bold">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {trailerLabels.length === 0 ? "No filter — all types shown" : `${trailerLabels.length} selected`}
          </p>
        </FilterRow>

        {/* Max Weight */}
        <FilterRow
          label="Max Weight (lbs)"
          value={maxWeight || "No limit"}
          expanded={expandedRow === "maxWeight"}
          onToggle={() => toggle("maxWeight")}
        >
          <div className="mt-2">
            <Input
              type="number"
              min={1000}
              max={80000}
              step={1000}
              value={maxWeight}
              onChange={(e) => {
                setMaxWeight(e.target.value);
                if (!initialized.current) return;
                const val = e.target.value;
                if (val === "") { save({ max_weight: null }); return; }
                const num = Number(val);
                if (!isNaN(num) && num >= 1000 && num <= 80000) save({ max_weight: num });
              }}
              placeholder="e.g. 45000"
            />
          </div>
        </FilterRow>

        {/* Search Radius */}
        <FilterRow
          label="Search Radius"
          value={`${searchRadius} mi`}
          expanded={expandedRow === "searchRadius"}
          onToggle={() => toggle("searchRadius")}
        >
          <div className="space-y-3 pt-2">
            <Slider
              value={[searchRadius]}
              min={50}
              max={350}
              step={25}
              onValueChange={([v]) => setSearchRadius(v)}
              onValueCommit={([v]) => { if (initialized.current) save({ preferred_radius_miles: v }); }}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>50 mi</span>
              <span>350 mi</span>
            </div>
          </div>
        </FilterRow>

        {/* Load Preferences */}
        <CheckRow label="No Tarps" checked={noTarps} onToggle={() => handleBool("no_tarps", noTarps, setNoTarps)} />

        {/* Certifications */}
        <CheckRow label="Hazmat Certified" checked={hazmat} onToggle={() => handleBool("hazmat_certified", hazmat, setHazmat)} />
        <CheckRow label="TWIC Card" checked={twic} onToggle={() => handleBool("twic_card", twic, setTwic)} />
        <CheckRow label="Team Driver" checked={team} onToggle={() => handleBool("team_driver", team, setTeam)} />

        {/* Work Days */}
        <FilterRow
          label="Work Days"
          value={workDays.length === 0 || workDays.length === 7 ? "All days" : workDays.join(", ")}
          expanded={expandedRow === "workDays"}
          onToggle={() => toggle("workDays")}
        >
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap gap-2">
              {ALL_WORK_DAYS.map((day) => {
                const allSelected = workDays.length === 0 || workDays.length === 7;
                const selected = allSelected || workDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleWorkDayToggle(day)}
                    className={cn(
                      "flex h-10 w-12 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                      selected ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
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
                onClick={() => {
                  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri"];
                  setWorkDays(wd);
                  if (initialized.current) save({ work_days: wd });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Weekdays only
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Routes won&apos;t include pickups or deliveries on your off days
            </p>
          </div>
        </FilterRow>

      </div>
    </motion.div>
  );
}
