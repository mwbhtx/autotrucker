"use client";

import { useEffect, useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
import {
  getCompanyIntegration,
  setCompanyIntegration,
  clearCompanyIntegration,
} from "../api";
import type { CompanyIntegrationStatus } from "../types";
import { CompanyIntegrationForm } from "../components/CompanyIntegrationForm";

export function CompanyIntegrationView() {
  const [status, setStatus] = useState<CompanyIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getCompanyIntegration()
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(v: {
    company_username: string;
    company_password: string;
  }) {
    setSubmitting(true);
    try {
      const updated = await setCompanyIntegration(v);
      setStatus(updated);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Mercer account? Scraping will stop.")) return;
    await clearCompanyIntegration();
    setStatus({ configured: false, company_username: null });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Company Integration</h2>
        <p className="text-sm text-muted-foreground">
          Connect your Mercer account so assigned orders sync into Haulvisor
          automatically.
        </p>
      </div>

      {status?.configured && !editing ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Connected as{" "}
            <strong>{status.company_username}</strong>. Assigned orders sync
            automatically every 24 hours.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Change Credentials
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!status?.configured && (
            <p className="text-sm text-muted-foreground">
              Connect your Mercer account to enable automatic load sync.
            </p>
          )}
          <CompanyIntegrationForm
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditing(false) : undefined}
            submitting={submitting}
          />
        </>
      )}
    </div>
  );
}
