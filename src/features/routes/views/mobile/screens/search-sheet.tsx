"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { PlaceAutocomplete, type PlaceResult } from "@/features/routes/components/search-form";

interface SearchSheetProps {
  onBack: () => void;
  onSearch: (params: {
    tripMode: "one-way" | "round-trip";
    origin: PlaceResult;
    destination: PlaceResult | null;
  }) => void;
  initialTripMode?: "one-way" | "round-trip";
  initialOrigin?: PlaceResult | null;
  initialDestination?: PlaceResult | null;
}

export function SearchSheet({
  onBack,
  onSearch,
  initialTripMode = "round-trip",
  initialOrigin = null,
  initialDestination = null,
}: SearchSheetProps) {
  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">(initialTripMode);
  const [origin, setOrigin] = useState<PlaceResult | null>(initialOrigin);
  const [destination, setDestination] = useState<PlaceResult | null>(initialDestination);

  const canSearch = origin !== null;

  const handleSearch = () => {
    if (!origin) return;
    onSearch({
      tripMode,
      origin,
      destination,
    });
  };

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
        <button type="button" onClick={onBack} className="flex items-center justify-center h-9 w-9 rounded-full bg-white shrink-0">
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h1 className="text-lg font-semibold">Plan Your Route</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Trip type toggle */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setTripMode("one-way")}
            className={`flex-1 py-3.5 text-lg font-medium transition-colors ${
              tripMode === "one-way"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            One-way
          </button>
          <button
            type="button"
            onClick={() => setTripMode("round-trip")}
            className={`flex-1 py-3.5 text-lg font-medium transition-colors ${
              tripMode === "round-trip"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Round-trip
          </button>
        </div>

        {/* Origin */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Origin
          </label>
          <PlaceAutocomplete
            placeholder="Where are you starting?"
            value={origin}
            onSelect={setOrigin}
            large
          />
        </div>

        {/* Destination — one-way only */}
        {tripMode === "one-way" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Destination
            </label>
            <PlaceAutocomplete
              placeholder="Where are you heading?"
              value={destination}
              onSelect={setDestination}
              large
            />
          </div>
        )}

        {/* Search button — only visible once origin is selected */}
        {canSearch && (
          <Button
            onClick={handleSearch}
            className="w-full h-14 rounded-xl text-lg font-semibold"
          >
            Search Routes
          </Button>
        )}
      </div>
    </motion.div>
  );
}
