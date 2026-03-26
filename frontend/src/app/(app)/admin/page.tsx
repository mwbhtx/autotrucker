"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronDownIcon, CheckIcon, ClockIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FetchSchedule } from "@mwbhtx/haulvisor-types";

interface Company {
  company_id: string;
  display_name: string;
  order_task_required: boolean;
  data_sync_on_schedule_enabled?: boolean;
  data_sync_on_login_interval_minutes?: number;
  data_sync_on_schedule_interval_minutes?: number;
  data_sync_on_login_enabled?: boolean;
  fetch_schedule?: FetchSchedule;
  last_data_sync_time?: string;
  registered_at?: string;
  updated_at?: string;
  order_url_template?: string;
}

const DEFAULT_FETCH_SCHEDULE: FetchSchedule = {
  timezone: "America/Chicago",
  weekday: {
    active_window_start: "08:00",
    active_window_end: "18:00",
    active_interval_minutes: 60,
    off_hours_interval_minutes: 180,
  },
  weekend: {
    interval_minutes: 360,
  },
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function FetchSchedulePopover({
  company,
  onSave,
}: {
  company: Company;
  onSave: (companyId: string, schedule: FetchSchedule) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<FetchSchedule>(
    company.fetch_schedule ?? DEFAULT_FETCH_SCHEDULE,
  );
  const [saving, setSaving] = useState(false);

  function resetAndOpen() {
    setSchedule(company.fetch_schedule ?? DEFAULT_FETCH_SCHEDULE);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(company.company_id, schedule);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasSchedule = !!company.fetch_schedule;

  return (
    <Popover open={open} onOpenChange={(v) => (v ? resetAndOpen() : setOpen(false))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-accent ${hasSchedule ? "text-primary" : "text-muted-foreground"}`}
          title="Edit fetch schedule"
        >
          <ClockIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Fetch Schedule</h4>

          {/* Timezone */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Timezone</label>
            <Select
              value={schedule.timezone}
              onValueChange={(v) => setSchedule({ ...schedule, timezone: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mon-Fri */}
          <div className="space-y-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="text-xs font-medium text-blue-400">Mon – Fri</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Window</span>
              <input
                type="time"
                className="h-7 rounded border bg-background px-2 text-xs"
                value={schedule.weekday.active_window_start}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    weekday: { ...schedule.weekday, active_window_start: e.target.value },
                  })
                }
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="time"
                className="h-7 rounded border bg-background px-2 text-xs"
                value={schedule.weekday.active_window_end}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    weekday: { ...schedule.weekday, active_window_end: e.target.value },
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">During</span>
              <span className="text-xs text-muted-foreground">every</span>
              <input
                type="number"
                min={1}
                className="h-7 w-16 rounded border bg-background px-2 text-xs text-center"
                value={schedule.weekday.active_interval_minutes}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    weekday: {
                      ...schedule.weekday,
                      active_interval_minutes: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Outside</span>
              <span className="text-xs text-muted-foreground">every</span>
              <input
                type="number"
                min={1}
                className="h-7 w-16 rounded border bg-background px-2 text-xs text-center"
                value={schedule.weekday.off_hours_interval_minutes}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    weekday: {
                      ...schedule.weekday,
                      off_hours_interval_minutes: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          {/* Sat-Sun */}
          <div className="space-y-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="text-xs font-medium text-yellow-400">Sat – Sun</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Interval</span>
              <span className="text-xs text-muted-foreground">every</span>
              <input
                type="number"
                min={1}
                className="h-7 w-16 rounded border bg-background px-2 text-xs text-center"
                value={schedule.weekend.interval_minutes}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    weekend: {
                      interval_minutes: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrderUrlPopover({
  company,
  onSave,
}: {
  company: Company;
  onSave: (companyId: string, url: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(company.order_url_template ?? "");

  function resetAndOpen() {
    setUrl(company.order_url_template ?? "");
    setOpen(true);
  }

  const hasUrl = !!company.order_url_template;

  return (
    <Popover open={open} onOpenChange={(v) => (v ? resetAndOpen() : setOpen(false))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs transition-colors hover:bg-accent ${hasUrl ? "text-primary" : "text-muted-foreground"}`}
          title="Edit order URL template"
        >
          {hasUrl ? "Set" : "None"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Order URL Template</h4>
          <p className="text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1 py-0.5 font-mono">{"{{ORDER_ID}}"}</code> as placeholder for the order ID
          </p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/order?id={{ORDER_ID}}"
            className="font-mono text-xs"
            onBlur={async () => {
              await onSave(company.company_id, url);
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface User {
  user_id: string;
  username: string;
  email?: string;
  role: string;
  company_ids?: string[];
  last_login?: string;
}

function CompanySelect({
  companies,
  value,
  onChange,
}: {
  companies: Company[];
  value: string | null;
  onChange: (companyId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selected = companies.find((c) => c.company_id === value);

  const filtered = companies.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.company_id.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function select(companyId: string | null) {
    onChange(companyId);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-56 items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.display_name : "No company"}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="p-2">
              <Input
                ref={inputRef}
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-48 overflow-y-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => select(null)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="size-4 flex items-center justify-center">
                  {!value && <CheckIcon className="size-3.5" />}
                </span>
                <span className="text-muted-foreground">No company</span>
              </button>
              {filtered.map((c) => (
                <button
                  key={c.company_id}
                  type="button"
                  onClick={() => select(c.company_id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="size-4 flex items-center justify-center">
                    {value === c.company_id && (
                      <CheckIcon className="size-3.5" />
                    )}
                  </span>
                  <span className="truncate">{c.display_name}</span>
                </button>
              ))}
              {filtered.length === 0 && search && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No companies found.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [metricsSummary, setMetricsSummary] = useState<Record<string, number>>({});
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [togglingDataSync, setTogglingDataSync] = useState<Record<string, boolean>>({});
  const [togglingFetchOnLogin, setTogglingFetchOnLogin] = useState<Record<string, boolean>>({});
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const [showDemoCompanies, setShowDemoCompanies] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: React.ReactNode;
    onConfirm: () => void;
  } | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/routes");
    }
  }, [user, router]);

  // Fetch companies and metrics summary
  useEffect(() => {
    fetchApi<Company[]>("companies")
      .then(setCompanies)
      .catch(() => toast.error("Failed to load companies"))
      .finally(() => setLoadingCompanies(false));
  }, []);

  // Fetch users
  useEffect(() => {
    fetchApi<User[]>("users")
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function reassignCompany(userId: string, companyId: string | null) {
    const updatedIds = companyId ? [companyId] : [];
    try {
      await fetchApi(`users/${userId}/companies`, {
        method: "PUT",
        body: JSON.stringify({ company_ids: updatedIds }),
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, company_ids: updatedIds } : u,
        ),
      );
      toast.success(companyId ? "Company assigned" : "Company unassigned");
    } catch {
      toast.error("Failed to update company assignment");
    }
  }

  function deleteUser(u: User) {
    setConfirmAction({
      title: "Delete user",
      description: (
        <>
          Are you sure? This cannot be undone.
          <div className="mt-2 rounded-md bg-muted p-2 text-sm">
            <p className="font-medium">{u.email || u.username || u.user_id}</p>
            <p className="font-mono text-xs text-muted-foreground">{u.user_id}</p>
          </div>
        </>
      ),
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await fetchApi(`users/${u.user_id}`, { method: "DELETE" });
          setUsers((prev) => prev.filter((x) => x.user_id !== u.user_id));
          toast.success("User deleted");
        } catch {
          toast.error("Failed to delete user");
        }
      },
    });
  }

  function deleteCompany(company: Company) {
    setConfirmAction({
      title: "Delete company",
      description: (
        <>
          Are you sure? This cannot be undone.
          <div className="mt-2 rounded-md bg-muted p-2 text-sm">
            <p className="font-medium">{company.display_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{company.company_id}</p>
          </div>
        </>
      ),
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await fetchApi(`companies/${company.company_id}`, { method: "DELETE" });
          setCompanies((prev) => prev.filter((c) => c.company_id !== company.company_id));
          toast.success("Company deleted");
        } catch {
          toast.error("Failed to delete company");
        }
      },
    });
  }

  async function toggleDataSync(companyId: string, currentValue: boolean) {
    setTogglingDataSync((prev) => ({ ...prev, [companyId]: true }));
    try {
      await fetchApi(`companies/${companyId}/data-sync-settings`, {
        method: "PUT",
        body: JSON.stringify({ data_sync_on_schedule_enabled: !currentValue }),
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === companyId
            ? { ...c, data_sync_on_schedule_enabled: !currentValue }
            : c,
        ),
      );
      toast.success(`Data sync ${!currentValue ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update data sync setting");
    } finally {
      setTogglingDataSync((prev) => ({ ...prev, [companyId]: false }));
    }
  }

  async function toggleFetchOnLogin(companyId: string, currentValue: boolean) {
    setTogglingFetchOnLogin((prev) => ({ ...prev, [companyId]: true }));
    try {
      await fetchApi(`companies/${companyId}/data-sync-settings`, {
        method: "PUT",
        body: JSON.stringify({ data_sync_on_login_enabled: !currentValue }),
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.company_id === companyId
            ? { ...c, data_sync_on_login_enabled: !currentValue }
            : c,
        ),
      );
      toast.success(`Login sync ${!currentValue ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update login sync setting");
    } finally {
      setTogglingFetchOnLogin((prev) => ({ ...prev, [companyId]: false }));
    }
  }

  async function refetch() {
    try {
      const updated = await fetchApi<Company[]>("companies");
      setCompanies(updated);
    } catch {
      toast.error("Failed to refresh companies");
    }
  }

  const handleSaveOrderUrl = async (companyId: string, url: string) => {
    await fetchApi(`companies/${companyId}/data-sync-settings`, {
      method: "PUT",
      body: JSON.stringify({ order_url_template: url || null }),
    });
    refetch();
  };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const companyIdValid = newCompanyId.trim() === "" || uuidRegex.test(newCompanyId.trim());

  async function addCompany() {
    if (!newCompanyName.trim() || !companyIdValid) return;
    setAddingCompany(true);
    try {
      await fetchApi("companies", {
        method: "POST",
        body: JSON.stringify({
          display_name: newCompanyName.trim(),
          order_task_required: false,
          ...(newCompanyId.trim() && { company_id: newCompanyId.trim() }),
        }),
      });
      const updated = await fetchApi<Company[]>("companies");
      setCompanies(updated);
      setNewCompanyName("");
      setNewCompanyId("");
      setShowAddCompany(false);
      toast.success("Company created");
    } catch {
      toast.error("Failed to create company");
    } finally {
      setAddingCompany(false);
    }
  }

  const isDev = process.env.NODE_ENV === "development";

  const filteredCompanies = showDemoCompanies
    ? companies
    : companies.filter((c) => !c.company_id.startsWith("demo-"));
  const filteredUsers = showDemoUsers
    ? users
    : users.filter((u) => !u.user_id.startsWith("demo-"));

  if (user && user.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      {/* Companies */}
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardAction>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showDemoCompanies}
                  onClick={() => setShowDemoCompanies(!showDemoCompanies)}
                  className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors ${showDemoCompanies ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`pointer-events-none block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${showDemoCompanies ? "translate-x-3" : "translate-x-0"}`} />
                </button>
                Show demo
              </label>
              <Button size="sm" onClick={() => setShowAddCompany(true)}>
                Add Company
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loadingCompanies ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No companies registered.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company ID</TableHead>
                  <TableHead>Total Orders</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Data Sync</TableHead>
                  <TableHead>Login Sync</TableHead>
                  <TableHead>Login Sync Interval</TableHead>
                  <TableHead>Fetch Schedule</TableHead>
                  <TableHead>Order URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.company_id}>
                    <TableCell>{company.display_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {company.company_id}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {metricsSummary[company.company_id] != null
                        ? metricsSummary[company.company_id].toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {company.last_data_sync_time
                        ? new Date(company.last_data_sync_time).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={company.data_sync_on_schedule_enabled ? "default" : "outline"}
                        size="sm"
                        disabled={togglingDataSync[company.company_id]}
                        onClick={() =>
                          toggleDataSync(
                            company.company_id,
                            !!company.data_sync_on_schedule_enabled,
                          )
                        }
                      >
                        {company.data_sync_on_schedule_enabled ? "On" : "Off"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={company.data_sync_on_login_enabled ? "default" : "outline"}
                        size="sm"
                        disabled={togglingFetchOnLogin[company.company_id]}
                        onClick={() =>
                          toggleFetchOnLogin(
                            company.company_id,
                            !!company.data_sync_on_login_enabled,
                          )
                        }
                      >
                        {company.data_sync_on_login_enabled ? "On" : "Off"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min={1}
                        className="w-16 rounded border bg-background px-2 py-1 text-sm"
                        defaultValue={company.data_sync_on_login_interval_minutes ?? 10}
                        onBlur={async (e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val) || val < 1) return;
                          if (val === (company.data_sync_on_login_interval_minutes ?? 10)) return;
                          try {
                            await fetchApi(`companies/${company.company_id}/data-sync-settings`, {
                              method: "PUT",
                              body: JSON.stringify({ data_sync_on_login_interval_minutes: val }),
                            });
                            setCompanies((prev) =>
                              prev.map((c) =>
                                c.company_id === company.company_id
                                  ? { ...c, data_sync_on_login_interval_minutes: val }
                                  : c,
                              ),
                            );
                            toast.success(`Login sync interval set to ${val} min`);
                          } catch {
                            toast.error("Failed to update interval");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <FetchSchedulePopover
                        company={company}
                        onSave={async (companyId, schedule) => {
                          try {
                            await fetchApi(`companies/${companyId}/data-sync-settings`, {
                              method: "PUT",
                              body: JSON.stringify({ fetch_schedule: schedule }),
                            });
                            setCompanies((prev) =>
                              prev.map((c) =>
                                c.company_id === companyId
                                  ? { ...c, fetch_schedule: schedule }
                                  : c,
                              ),
                            );
                            toast.success("Fetch schedule updated");
                          } catch {
                            toast.error("Failed to update fetch schedule");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <OrderUrlPopover
                        company={company}
                        onSave={handleSaveOrderUrl}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteCompany(company)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardAction>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={showDemoUsers}
                onClick={() => setShowDemoUsers(!showDemoUsers)}
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors ${showDemoUsers ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none block h-3 w-3 rounded-full bg-background shadow-sm transition-transform ${showDemoUsers ? "translate-x-3" : "translate-x-0"}`} />
              </button>
              Show demo
            </label>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Assigned Company</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.email || u.username || u.user_id}</TableCell>
                    <TableCell className="font-mono text-sm">{u.user_id}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <CompanySelect
                        companies={companies.filter((c) => !c.company_id.startsWith("demo-"))}
                        value={u.company_ids?.[0] ?? null}
                        onChange={(companyId) => reassignCompany(u.user_id, companyId)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={u.user_id === user?.userId}
                        onClick={() => deleteUser(u)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription asChild><div>{confirmAction?.description}</div></DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmAction?.onConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Company dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
            <DialogDescription>Create a new company registration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <Input
                placeholder="e.g. Acme Trucking"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Company ID <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="Auto-generated if left blank"
                value={newCompanyId}
                onChange={(e) => setNewCompanyId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCompany()}
                className={`font-mono ${newCompanyId && !companyIdValid ? "border-destructive" : ""}`}
              />
              {newCompanyId && !companyIdValid && (
                <p className="text-xs text-destructive mt-1">Must be a valid UUID</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>
              Cancel
            </Button>
            <Button disabled={!newCompanyName.trim() || !companyIdValid || addingCompany} onClick={addCompany}>
              {addingCompany ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
