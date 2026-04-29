"use client";

import { useState } from "react";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { FreightNetworkMap } from "../../components/FreightNetworkMap";
import { useFreightNetwork } from "../../hooks/use-freight-network";

type PeriodId = "30d" | "60d" | "90d";
type ZoneRadius = 100 | 200 | 300;

export function DesktopRouteDiscoveryView() {
  const [period, setPeriod] = useState<PeriodId>("90d");
  const [zoneRadius, setZoneRadius] = useState<ZoneRadius>(200);

  const { data: networkData, isLoading: networkLoading } = useFreightNetwork(period, zoneRadius);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {networkLoading && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      )}

      {!networkLoading && networkData && (
        <FreightNetworkMap data={networkData} period={period} />
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-background/95 border rounded-md shadow-md backdrop-blur px-3 py-2 flex items-center gap-3">
        <div className="flex gap-1">
          {(["30d", "60d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Zone</span>
          {([100, 200, 300] as const).map((r) => (
            <button
              key={r}
              onClick={() => setZoneRadius(r)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                zoneRadius === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {r}mi
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
