"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/platform/web/components/ui/card";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import { useRegionInspector } from "../hooks/use-region-inspector";

interface Props {
  query: { city: string; state: string; radius_miles: number } | null;
}

export function RegionInspectorCard({ query }: Props) {
  const { data, isLoading, error } = useRegionInspector(query);

  return (
    <Card id="route-discovery-region-inspector">
      <CardHeader>
        <CardTitle className="text-base">Region Inspector</CardTitle>
      </CardHeader>
      <CardContent>
        {!query && !isLoading && (
          <p className="text-xs text-muted-foreground">Enter a city and state to inspect the region.</p>
        )}
        {isLoading && <Skeleton className="h-40 w-full" />}
        {error && (
          <p className="text-sm text-destructive">Failed to load region info.</p>
        )}
        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Origin matches</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {data.origin_match_count.toLocaleString()}
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Destination matches</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {data.destination_match_count.toLocaleString()}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                Top destinations
              </h4>
              <table className="w-full text-xs">
                <tbody>
                  {data.top_destination_buckets.slice(0, 5).map((b, i) => (
                    <tr key={`d-${i}`}>
                      <td className="py-0.5">
                        {b.city ?? "?"}, {b.state ?? "?"}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
                Top origins
              </h4>
              <table className="w-full text-xs">
                <tbody>
                  {data.top_origin_buckets.slice(0, 5).map((b, i) => (
                    <tr key={`o-${i}`}>
                      <td className="py-0.5">
                        {b.city ?? "?"}, {b.state ?? "?"}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-muted-foreground">
              {Math.round(data.pct_within_25mi_of_input * 100)}% within 25mi ·{" "}
              {Math.round(data.pct_at_radius_edge * 100)}% at radius edge
            </div>

            {data.warning && (
              <div className="text-xs p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100">
                {data.warning}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
