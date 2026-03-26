"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { MarketingNav } from "@/components/marketing-nav";
import { BackgroundBeams } from "@/components/ui/beams";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, completeNewPasswordChallenge } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  useEffect(() => {
    if (user) router.replace("/routes");
  }, [user, router]);

  if (user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result === "NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
      } else {
        router.push("/routes");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await completeNewPasswordChallenge(newPassword);
      router.push("/routes");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  const isDev = process.env.NODE_ENV === "development";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Signing in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b090c] text-foreground relative">
      <BackgroundBeams />
      <MarketingNav variant="light" hideAuth />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 sm:pt-28 pb-20">
        <div className="w-full max-w-sm rounded-2xl bg-[#0f0d0f] p-8">
          <h2 className="text-3xl font-normal tracking-wide mb-8 text-white" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
            {needsNewPassword ? "Set new password" : "Log in to Haulvisor"}
          </h2>

          {needsNewPassword ? (
            <form onSubmit={handleNewPassword} className="flex flex-col gap-3">
              <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-[#ff5601] focus-visible:!ring-[#ff5601]/50" required autoFocus />
              <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-[#ff5601] focus-visible:!ring-[#ff5601]/50" required />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-[#0b090c] text-white text-sm font-semibold hover:bg-[#0b090c]/80 transition-colors">Set password</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Input type={isDev ? "text" : "email"} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-[#ff5601] focus-visible:!ring-[#ff5601]/50" autoFocus {...(!isDev ? { required: true } : {})} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-[#ff5601] focus-visible:!ring-[#ff5601]/50" {...(!isDev ? { required: true } : {})} />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-[#0b090c] text-white text-sm font-semibold hover:bg-[#0b090c]/80 transition-colors">Log in</button>
            </form>
          )}

          <p className="mt-6 text-sm text-white/40 text-center">
            Don&apos;t have an account?{" "}
            <button type="button" className="text-white font-medium hover:underline">Sign up</button>
          </p>
        </div>
      </div>
    </div>
  );
}
