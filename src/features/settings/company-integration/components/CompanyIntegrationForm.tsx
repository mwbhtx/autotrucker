"use client";

import { useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";

export function CompanyIntegrationForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (v: {
    company_username: string;
    company_password: string;
  }) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit =
    username.length > 0 && password.length > 0 && !submitting;

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        await onSubmit({
          company_username: username,
          company_password: password,
        });
        setUsername("");
        setPassword("");
      }}
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="company_username"
          className="text-sm font-medium"
        >
          Company Username
        </label>
        <Input
          id="company_username"
          autoComplete="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="company_password"
          className="text-sm font-medium"
        >
          Company Password
        </label>
        <Input
          id="company_password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit}>
          Save
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
