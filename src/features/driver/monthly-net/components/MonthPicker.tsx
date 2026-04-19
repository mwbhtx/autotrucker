"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/platform/web/components/ui/popover";
import { cn } from "@/core/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
];

function parseYm(ym: string): { year: number; month: number } {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: Number(m[1]), month: Number(m[2]) };
}

function toYm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function currentYm(): string {
  const d = new Date();
  return toYm(d.getFullYear(), d.getMonth() + 1);
}

function formatLabel(ym: string): string {
  const { year, month } = parseYm(ym);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export interface MonthPickerProps {
  value: string;
  onChange: (ym: string) => void;
  className?: string;
}

export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const { year: selectedYear, month: selectedMonth } = parseYm(value);
  const [open, setOpen] = useState(false);
  // Year shown in the popover — starts at the selected year but can be
  // browsed independently via the chevron buttons.
  const [viewYear, setViewYear] = useState(selectedYear);

  // Re-sync viewYear when the popover opens so jumping across years
  // doesn't leave stale state after a commit.
  const handleOpenChange = (next: boolean) => {
    if (next) setViewYear(selectedYear);
    setOpen(next);
  };

  const thisYm = currentYm();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-44 justify-between font-normal", className)}
        >
          <span>{formatLabel(value)}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeftIcon />
          </Button>
          <div className="text-sm font-semibold tabular-nums">{viewYear}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Next year"
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {MONTHS.map((abbr, i) => {
            const m = i + 1;
            const isSelected = viewYear === selectedYear && m === selectedMonth;
            return (
              <Button
                key={abbr}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange(toYm(viewYear, m));
                  setOpen(false);
                }}
              >
                {abbr}
              </Button>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end border-t border-border pt-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              onChange(thisYm);
              setOpen(false);
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
