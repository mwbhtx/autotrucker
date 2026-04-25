"use client";

import type { DiscoveredRoute } from "@/core/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/platform/web/components/ui/card";
import { Button } from "@/platform/web/components/ui/button";
import { useRouteDiscoveryStore } from "../store";
import { DiscoveredRouteMap } from "./DiscoveredRouteMap";
import { ReliabilityTable } from "./ReliabilityTable";
import { EconomicsHistograms } from "./EconomicsHistograms";

interface Props {
  route: DiscoveredRoute | null;
  radiusMiles: number;
}

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function DrilldownPanel({ route, radiusMiles }: Props) {
  const setActiveOrder = useRouteDiscoveryStore((s) => s.setActiveOrder);

  if (!route) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Select a route to view its drilldown.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Route detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DiscoveredRouteMap
          orders={route.orders}
          onClickOrder={(i) => {
            setActiveOrder(i);
            scrollToId("route-discovery-leg-deadhead");
          }}
          onClickAnchor={() => scrollToId("route-discovery-region-inspector")}
        />

        <div>
          <h3 className="text-sm font-semibold mb-2">Per-order reliability</h3>
          <ReliabilityTable route={route} />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Economics</h3>
          <EconomicsHistograms route={route} radiusMiles={radiusMiles} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToId("route-discovery-region-inspector")}
          >
            → Inspect region
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToId("route-discovery-lane-density")}
          >
            → View order density
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToId("route-discovery-leg-deadhead")}
          >
            → View deadhead distribution
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
