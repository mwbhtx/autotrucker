"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, XIcon } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { PlaceAutocomplete, type PlaceResult } from "@/features/routes/components/search-form";

interface SearchSheetProps {
  onBack: () => void;
  onSearch: (params: {
    origin: PlaceResult;
    destination: PlaceResult | null;
  }) => void;
  initialOrigin?: PlaceResult | null;
  initialDestination?: PlaceResult | null;
}

export function SearchSheet({
  onBack,
  onSearch,
  initialOrigin = null,
  initialDestination = null,
}: SearchSheetProps) {
  const [origin, setOrigin] = useState<PlaceResult | null>(initialOrigin);
  const [destination, setDestination] = useState<PlaceResult | null>(initialDestination);

  const canSearch = origin !== null;

  const handleSearch = () => {
    if (!origin) return;
    onSearch({
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
        {/* Origin */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Origin
            </label>
            {origin && (
              <button
                type="button"
                onClick={() => setOrigin(null)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
          <PlaceAutocomplete
            placeholder="Where are you starting?"
            value={origin}
            onSelect={setOrigin}
            large
          />
        </div>

        {/* Destination (optional) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Destination (optional)
            </label>
            {destination && (
              <button
                type="button"
                onClick={() => setDestination(null)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
          <PlaceAutocomplete
            placeholder="Where are you heading?"
            value={destination}
            onSelect={setDestination}
            large
          />
        </div>

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
