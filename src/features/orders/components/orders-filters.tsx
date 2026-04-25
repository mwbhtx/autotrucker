"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
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

const NONE = "__none__";

interface OrdersFiltersProps {
  onSearch: (filters: Omit<OrderFilters, "offset" | "limit">) => void;
  children?: React.ReactNode;
  simulateButton?: React.ReactNode;
}

export function OrdersFilters({ onSearch, children, simulateButton }: OrdersFiltersProps) {
  const [originState, setOriginState] = useState<string>("");
  const [destinationState, setDestinationState] = useState<string>("");
  const [open, setOpen] = useState(false);

  const hasActiveFilters = !!(originState || destinationState);

  function handleSearch() {
    onSearch({
      origin_state: originState || undefined,
      destination_state: destinationState || undefined,
    });
    setOpen(false);
  }

  function handleReset() {
    setOriginState("");
    setDestinationState("");
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
            onSearch={handleSearch}
            onReset={handleReset}
            simulateButton={simulateButton}
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
          onSearch={handleSearch}
          onReset={handleReset}
          simulateButton={simulateButton}
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
  onSearch,
  onReset,
  simulateButton,
}: {
  originState: string;
  setOriginState: (v: string) => void;
  destinationState: string;
  setDestinationState: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  simulateButton?: React.ReactNode;
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

      <Button onClick={onSearch}>Search</Button>
      <Button variant="outline" onClick={onReset}>
        Reset
      </Button>
      {simulateButton}
    </>
  );
}
