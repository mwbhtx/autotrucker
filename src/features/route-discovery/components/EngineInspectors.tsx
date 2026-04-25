"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RegionInspectorCard } from "./RegionInspectorCard";
import { LaneDensityCard } from "./LaneDensityCard";
import { InterOrderDeadheadCard } from "./InterOrderDeadheadCard";

interface Props {
  regionQuery: { city: string; state: string; radius_miles: number } | null;
  laneQuery: {
    origin_lat: number;
    origin_lng: number;
    destination_lat: number;
    destination_lng: number;
    radius_miles: number;
  } | null;
  legQuery: {
    drop_lat: number;
    drop_lng: number;
    pickup_lat: number;
    pickup_lng: number;
    radius_miles: number;
  } | null;
}

export function EngineInspectors({ regionQuery, laneQuery, legQuery }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Engine Inspectors
      </button>
      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <RegionInspectorCard query={regionQuery} />
          <LaneDensityCard query={laneQuery} />
          <InterOrderDeadheadCard query={legQuery} />
        </div>
      )}
    </section>
  );
}
