"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import { Badge } from "@/platform/web/components/ui/badge";
import {
  deletePhone,
  resendPhoneCode,
  startPhoneVerification,
  verifyPhoneCode,
} from "../api";
import { usePhoneStatus } from "../hooks/usePhoneStatus";

export function PhoneVerificationSection() {
  const { status, loading, refresh } = usePhoneStatus();
  const [mode, setMode] = useState<"idle" | "entering_phone" | "entering_code">("idle");
  const [phoneInput, setPhoneInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const verified = status?.phone_number_verified;
  const hasPending = status?.has_pending_verification;

  async function handleSend() {
    if (!/^\+1\d{10}$/.test(phoneInput)) {
      toast.error("Enter a US phone as +1 followed by 10 digits");
      return;
    }
    setBusy(true);
    try {
      const res = await startPhoneVerification(phoneInput);
      setExpiresAt(res.expires_at);
      setMode("entering_code");
      setCodeInput("");
      toast.success("Code sent. Check your phone.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(codeInput)) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      await verifyPhoneCode(codeInput);
      toast.success("Phone verified");
      setMode("idle");
      setCodeInput("");
      setPhoneInput("");
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    try {
      const res = await resendPhoneCode();
      setExpiresAt(res.expires_at);
      toast.success("Code re-sent");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your phone number? SMS alerts will be disabled.")) return;
    setBusy(true);
    try {
      await deletePhone();
      toast.success("Phone removed");
      setMode("idle");
      setPhoneInput("");
      setCodeInput("");
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="settings-phone" className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          SMS Phone
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Verify a US mobile number to receive SMS when a route matches your alerts. Max 1 SMS
          per hour. Message + data rates may apply.
        </p>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && verified && status?.masked_phone && mode === "idle" && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{status.masked_phone}</span>
            <Badge variant="secondary" className="h-5">
              Verified
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode("entering_phone")}>
              Change
            </Button>
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={busy}>
              Remove
            </Button>
          </div>
        </div>
      )}

      {!loading && !verified && mode === "idle" && !hasPending && (
        <Button onClick={() => setMode("entering_phone")}>Add phone number</Button>
      )}

      {mode === "entering_phone" && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <label className="text-xs font-medium text-muted-foreground">
            US phone (+1XXXXXXXXXX)
          </label>
          <Input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.trim())}
            placeholder="+18325551234"
            inputMode="tel"
            autoComplete="tel"
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={busy || !phoneInput}>
              Send code
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setPhoneInput("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(mode === "entering_code" || (hasPending && mode === "idle")) && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <label className="text-xs font-medium text-muted-foreground">
            6-digit verification code
          </label>
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={busy}
          />
          {expiresAt && (
            <span className="text-xs text-muted-foreground">
              Code expires {new Date(expiresAt).toLocaleTimeString()}
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleVerify} disabled={busy || codeInput.length !== 6}>
              Verify
            </Button>
            <Button variant="outline" onClick={handleResend} disabled={busy}>
              Resend code
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setCodeInput("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return (err as { message: string }).message || "Something went wrong";
  }
  return "Something went wrong";
}
