"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/platform/web/components/ui/button";
import { Badge } from "@/platform/web/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/platform/web/components/ui/dialog";
import { AlertForm } from "./AlertForm";
import { useAlerts } from "../hooks/useAlerts";
import { usePhoneStatus } from "../hooks/usePhoneStatus";
import type { Alert, CreateAlertInput, UpdateAlertInput } from "../types";

export function AlertsSection() {
  const { alerts, loading, error, create, update, remove, duplicate } = useAlerts();
  const { status: phoneStatus } = usePhoneStatus();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Alert | null>(null);

  async function handleCreate(input: CreateAlertInput | UpdateAlertInput) {
    try {
      await create(input as CreateAlertInput);
      toast.success("Alert created");
      setCreating(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleUpdate(patch: CreateAlertInput | UpdateAlertInput) {
    if (!editing) return;
    try {
      await update(editing.alert_id, patch as UpdateAlertInput);
      toast.success("Alert updated");
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDelete(alert: Alert) {
    if (!confirm(`Delete alert "${alert.name}"? Associated matches will also be removed.`)) return;
    try {
      await remove(alert.alert_id);
      toast.success("Alert deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDuplicate(alert: Alert) {
    try {
      await duplicate(alert.alert_id);
      toast.success("Alert duplicated");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleToggleActive(alert: Alert) {
    try {
      await update(alert.alert_id, { active: !alert.active });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <section id="settings-alerts" className="rounded-md border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Alerts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saved route searches. We'll notify you when matching routes appear (max 1 SMS per hour).
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> New alert
        </Button>
      </header>

      <div className="p-3 space-y-3">
        {phoneStatus && !phoneStatus.phone_number_verified && alerts.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            You don't have a verified phone yet — alerts will still show in-app via the bell, but SMS
            won't fire. Add a phone in the SMS Phone section.
          </div>
        )}

        {loading && alerts.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading alerts…</div>
        )}
        {error && (
          <div className="py-4 text-sm text-destructive">Couldn't load alerts: {error}</div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No alerts yet. Click <span className="font-medium text-foreground">New alert</span> to create one.
          </div>
        )}

        {alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <div key={alert.alert_id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{alert.name}</span>
                      {!alert.active && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          Paused
                        </Badge>
                      )}
                      {alert.sms_enabled && alert.active && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          SMS
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{criteriaSummary(alert)}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleToggleActive(alert)}
                      title={alert.active ? "Pause" : "Activate"}
                      className="text-xs"
                    >
                      {alert.active ? "Pause" : "Start"}
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditing(alert)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => handleDuplicate(alert)} title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(alert)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New alert</DialogTitle>
          </DialogHeader>
          <AlertForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit alert</DialogTitle>
          </DialogHeader>
          {editing && (
            <AlertForm
              initial={editing}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function criteriaSummary(alert: Alert): string {
  const parts: string[] = [];
  const c = alert.criteria;
  if (c.destination_city) parts.push(`→ ${c.destination_city}`);
  if (c.trailer_types) parts.push(c.trailer_types);
  if (c.min_daily_profit) parts.push(`≥ $${c.min_daily_profit.toFixed(0)}/day`);
  if (c.num_orders && c.num_orders > 1) parts.push(`${c.num_orders} legs`);
  parts.push(`${alert.rolling_window_hours >= 168 ? "7d" : `${alert.rolling_window_hours}h`} window`);
  return parts.join(" · ");
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return (err as { message: string }).message || "Something went wrong";
  }
  return "Something went wrong";
}
