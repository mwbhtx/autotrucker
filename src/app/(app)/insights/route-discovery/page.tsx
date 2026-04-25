"use client";

import { Compass } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/platform/web/components/ui/card";

export default function RouteDiscoveryPage() {
  return (
    <div className="container mx-auto max-w-2xl py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <CardTitle>Route Discovery</CardTitle>
          </div>
          <CardDescription>
            Discover recurring route patterns flowing through any city in your operating area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coming soon. This tool will let you enter a city, state, and search radius to surface
            high-traffic 2-, 3-, or 4-order route loops drawn from your historical order data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
