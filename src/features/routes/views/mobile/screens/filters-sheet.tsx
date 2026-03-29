"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Slider } from "@/platform/web/components/ui/slider";
import { Calendar } from "@/platform/web/components/ui/calendar";
import { cn } from "@/core/utils";
import { LEG_OPTIONS, DEFAULT_LEGS_ROUND_TRIP, DEFAULT_MAX_DEADHEAD_PCT, DEFAULT_MAX_IDLE_HOURS, MIN_DEADHEAD_PCT, MAX_DEADHEAD_PCT, IDLE_OPTIONS, RISK_LEVELS, type RiskLevel } from "@mwbhtx/haulvisor-core";

export interface AdvancedFilters {
  legs: number;
  maxDeadheadPct: number;
  maxIdleHours: number;
  homeBy: string;
  trailerType: string;
  risk: RiskLevel;
}

interface FiltersSheetProps {
  onBack: () => void;
  onApply: (filters: AdvancedFilters) => void;
  initialFilters?: Partial<AdvancedFilters>;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  any: "Any",
  safe: "Safe",
  moderate: "Moderate",
  bold: "Bold",
};

function formatIdleLabel(hours: number): string {
  return IDLE_OPTIONS.find((o) => o.value === hours)?.label ?? `${hours}h`;
}

function formatHomeBy(iso: string): string {
  if (!iso) return "Any";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Collapsible filter row — shows label + current value, tap to expand */
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
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{value}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FiltersSheet({ onBack, onApply, initialFilters }: FiltersSheetProps) {
  const [legs, setLegs] = useState(initialFilters?.legs ?? DEFAULT_LEGS_ROUND_TRIP);
  const [maxDeadheadPct, setMaxDeadheadPct] = useState(initialFilters?.maxDeadheadPct ?? DEFAULT_MAX_DEADHEAD_PCT);
  const [maxIdleHours, setMaxIdleHours] = useState(initialFilters?.maxIdleHours ?? DEFAULT_MAX_IDLE_HOURS);
  const [homeBy, setHomeBy] = useState(initialFilters?.homeBy ?? "");
  const [trailerType, setTrailerType] = useState(initialFilters?.trailerType ?? "");
  const [risk, setRisk] = useState<RiskLevel>(initialFilters?.risk ?? "any");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggle = (row: string) => setExpandedRow((prev) => (prev === row ? null : row));

  const handleBack = () => {
    onApply({ legs, maxDeadheadPct, maxIdleHours, homeBy, trailerType, risk });
  };

  const selectedDate = homeBy ? new Date(homeBy + "T00:00:00") : undefined;

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

      {/* Filter rows */}
      <div className="flex-1 overflow-y-auto">
        <FilterRow
          label="Number of Legs"
          value={String(legs)}
          expanded={expandedRow === "legs"}
          onToggle={() => toggle("legs")}
        >
          <div className="flex gap-2">
            {LEG_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLegs(n)}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors",
                  legs === n
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </FilterRow>

        <FilterRow
          label="Risk Tolerance"
          value={RISK_LABELS[risk]}
          expanded={expandedRow === "risk"}
          onToggle={() => toggle("risk")}
        >
          <div className="flex gap-2">
            {RISK_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setRisk(level)}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors",
                  risk === level
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                {RISK_LABELS[level]}
              </button>
            ))}
          </div>
        </FilterRow>

        <FilterRow
          label="Max Deadhead"
          value={`${maxDeadheadPct}%`}
          expanded={expandedRow === "deadhead"}
          onToggle={() => toggle("deadhead")}
        >
          <div className="space-y-3">
            <Slider
              value={[maxDeadheadPct]}
              onValueChange={(v) => setMaxDeadheadPct(v[0])}
              min={MIN_DEADHEAD_PCT}
              max={MAX_DEADHEAD_PCT}
              step={5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{MIN_DEADHEAD_PCT}%</span>
              <span>{MAX_DEADHEAD_PCT}%</span>
            </div>
          </div>
        </FilterRow>

        <FilterRow
          label="Max Idle"
          value={formatIdleLabel(maxIdleHours)}
          expanded={expandedRow === "idle"}
          onToggle={() => toggle("idle")}
        >
          <div className="flex flex-wrap gap-2">
            {IDLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxIdleHours(opt.value)}
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors",
                  maxIdleHours === opt.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterRow>

        <FilterRow
          label="Home By"
          value={formatHomeBy(homeBy)}
          expanded={expandedRow === "homeBy"}
          onToggle={() => toggle("homeBy")}
        >
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              disabled={{ before: new Date() }}
              onSelect={(day: Date | undefined) => {
                if (day) {
                  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                  setHomeBy(iso);
                }
              }}
              defaultMonth={selectedDate}
            />
            {homeBy && (
              <div className="border-t border-white/10 px-3 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setHomeBy("")}
                >
                  Clear Date
                </Button>
              </div>
            )}
          </div>
        </FilterRow>
      </div>

    </motion.div>
  );
}
