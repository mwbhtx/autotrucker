"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/web/components/ui/select";
import type { OrderFilters } from "@/core/types";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const TRAILER_TYPES = [
  { value: "V", label: "Van" },
  { value: "R", label: "Reefer" },
  { value: "F", label: "Flatbed" },
  { value: "SD", label: "Step Deck" },
  { value: "DD", label: "Double Drop" },
  { value: "RGN", label: "RGN" },
  { value: "HB", label: "Hotshot" },
  { value: "C", label: "Container" },
  { value: "T", label: "Tanker" },
];

// Sentinel used to represent "no selection" in radix Select which does not
// support empty-string values.
const NONE = "__none__";

interface OrdersFiltersProps {
  onSearch: (filters: Omit<OrderFilters, "offset" | "limit">) => void;
  children?: React.ReactNode;
}

export function OrdersFilters({ onSearch, children }: OrdersFiltersProps) {
  const [originState, setOriginState] = useState<string>("");
  const [destinationState, setDestinationState] = useState<string>("");
  const [trailerType, setTrailerType] = useState<string>("");
  const [minPay, setMinPay] = useState<string>("");
  const [open, setOpen] = useState(false);

  const hasActiveFilters = !!(originState || destinationState || trailerType || minPay);

  function handleSearch() {
    onSearch({
      origin_state: originState || undefined,
      destination_state: destinationState || undefined,
      trailer_type: trailerType || undefined,
      min_pay: minPay ? Number(minPay) : undefined,
    });
    setOpen(false);
  }

  function handleReset() {
    setOriginState("");
    setDestinationState("");
    setTrailerType("");
    setMinPay("");
    onSearch({});
  }

  return (
    <div className="space-y-3">
      {/* Top row: filter toggle (mobile) + search input + filters inline (desktop) */}
      <div className="flex gap-2 items-center sm:items-end">
        <Button
          variant="outline"
          className="sm:hidden shrink-0"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              !
            </span>
          )}
        </Button>
        {children}
        {/* Desktop inline filters */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <FilterControls
            originState={originState}
            setOriginState={setOriginState}
            destinationState={destinationState}
            setDestinationState={setDestinationState}
            trailerType={trailerType}
            setTrailerType={setTrailerType}
            minPay={minPay}
            setMinPay={setMinPay}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* Mobile expanded filters */}
      <div className={`flex-wrap items-end gap-3 sm:hidden ${open ? "flex" : "hidden"}`}>
          <FilterControls
            originState={originState}
            setOriginState={setOriginState}
            destinationState={destinationState}
            setDestinationState={setDestinationState}
            trailerType={trailerType}
            setTrailerType={setTrailerType}
            minPay={minPay}
            setMinPay={setMinPay}
            onSearch={handleSearch}
            onReset={handleReset}
          />
        </div>
    </div>
  );
}

function FilterControls({
  originState,
  setOriginState,
  destinationState,
  setDestinationState,
  trailerType,
  setTrailerType,
  minPay,
  setMinPay,
  onSearch,
  onReset,
}: {
  originState: string;
  setOriginState: (v: string) => void;
  destinationState: string;
  setDestinationState: (v: string) => void;
  trailerType: string;
  setTrailerType: (v: string) => void;
  minPay: string;
  setMinPay: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Origin State
        </label>
        <Select
          value={originState || NONE}
          onValueChange={(v) => setOriginState(v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value={NONE}>Any</SelectItem>
            {US_STATES.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Destination State
        </label>
        <Select
          value={destinationState || NONE}
          onValueChange={(v) => setDestinationState(v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value={NONE}>Any</SelectItem>
            {US_STATES.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Trailer Type
        </label>
        <Select
          value={trailerType || NONE}
          onValueChange={(v) => setTrailerType(v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value={NONE}>Any</SelectItem>
            {TRAILER_TYPES.map((tt) => (
              <SelectItem key={tt.value} value={tt.value}>
                {tt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Min Pay ($)
        </label>
        <Input
          type="number"
          placeholder="0"
          value={minPay}
          onChange={(e) => setMinPay(e.target.value)}
          className="w-[120px]"
        />
      </div>

      <Button onClick={onSearch}>Search</Button>
      <Button variant="outline" onClick={onReset}>
        Reset
      </Button>
    </>
  );
}
