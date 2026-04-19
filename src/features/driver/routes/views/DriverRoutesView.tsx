// src/features/driver/routes/views/DriverRoutesView.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { RouteCard } from "../components/RouteCard";
import { AddRouteDialog } from "../components/AddRouteDialog";
import { RouteDetailDrawer } from "../components/RouteDetailDrawer";
import { useDriverRoutes } from "../hooks/useDriverRoutes";

export function DriverRoutesView() {
  const { routes, loading, error, create, remove } = useDriverRoutes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openRouteId, setOpenRouteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved route?")) return;
    await remove(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Saved routes from your completed orders.</div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Route
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">Couldn't load routes: {error}</div>}

      {!loading && !error && routes.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No routes yet. Click <span className="font-medium">Add Route</span> to save your first one.
        </div>
      )}

      {!loading && !error && routes.length > 0 && (
        <div className="flex flex-col gap-2">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} onOpen={setOpenRouteId} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AddRouteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={async (ids) => { await create(ids); }}
      />

      <RouteDetailDrawer routeId={openRouteId} onClose={() => setOpenRouteId(null)} />
    </div>
  );
}
