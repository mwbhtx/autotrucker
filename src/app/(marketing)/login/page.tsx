"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/platform/web/components/ui/input";
import { useAuth } from "@/core/services/auth-provider";
import { MarketingNav } from "@/platform/web/components/marketing-nav";
import Waves from "@/components/Waves";
import { brand } from "@mwbhtx/haulvisor-core";

export default function LoginPage() {
  const router = useRouter();
  const { user, noCompanyAccess, login, completeNewPasswordChallenge, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [showNoCompany, setShowNoCompany] = useState(false);

  useEffect(() => {
    if (user && !noCompanyAccess) router.replace("/routes");
  }, [user, noCompanyAccess, router]);

  if (user && !noCompanyAccess) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result === "NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
      } else if (result === "NO_COMPANY") {
        setShowNoCompany(true);
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
      const result = await completeNewPasswordChallenge(newPassword);
      if (result === "NO_COMPANY") {
        setShowNoCompany(true);
      } else {
        router.push("/routes");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  const handleNoCompanyDismiss = () => {
    setShowNoCompany(false);
    logout();
  };

  const isDev = process.env.NODE_ENV === "development";


  if (showNoCompany) {
    return (
      <>
        <div
          className="fixed inset-0 z-[1] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/image.png')" }}
        />
          <div className="relative z-[3]">
          <MarketingNav variant="light" hideAuth />
        </div>
        <div className="relative z-[3] flex flex-col items-center justify-center px-6 pt-20 sm:pt-28 pb-20">
          <div className="w-full max-w-sm rounded-2xl bg-black/30 border border-white/[0.08] backdrop-blur-md p-8 text-center space-y-4">
            <h2 className="font-display text-2xl font-normal tracking-wide text-white">
              No Company Assigned
            </h2>
            <p className="text-sm text-white/60">
              Your account is not associated with a company. Please contact your administrator to get access.
            </p>
            <button
              type="button"
              onClick={handleNoCompanyDismiss}
              className="w-full h-11 mt-2 rounded-lg bg-white/[0.1] border border-white/[0.12] text-white text-sm font-semibold hover:bg-white/[0.15] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Signing in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Waves background */}
      <div className="absolute inset-0 z-0">
        <Waves
          lineColor="#96ff00"
          backgroundColor="transparent"
          waveSpeedX={0.02}
          waveSpeedY={0.01}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={36}
        />
      </div>

      {/* Left column — form */}
      <div className="relative z-10 flex-1 flex flex-col bg-black/80">
        <MarketingNav variant="light" hideAuth />

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-full max-w-sm rounded-2xl bg-black/10 backdrop-blur-sm p-8">
            <h2 className="font-display text-3xl font-normal tracking-wide mb-2 text-white">
              {needsNewPassword ? "Set new password" : "Welcome back"}
            </h2>
            <p className="text-sm text-white mb-8">
              {needsNewPassword ? "Choose a secure password" : `Log in to ${brand.name}`}
            </p>

            {needsNewPassword ? (
              <form onSubmit={handleNewPassword} className="flex flex-col gap-3">
                <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/70 focus-visible:!border-primary focus-visible:!ring-primary/50" required autoFocus />
                <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/70 focus-visible:!border-primary focus-visible:!ring-primary/50" required />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">Set password</button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <Input type={isDev ? "text" : "email"} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/70 focus-visible:!border-primary focus-visible:!ring-primary/50" autoFocus {...(!isDev ? { required: true } : {})} />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/70 focus-visible:!border-primary focus-visible:!ring-primary/50" {...(!isDev ? { required: true } : {})} />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">Log in</button>
              </form>
            )}

            <p className="mt-6 text-sm text-white text-center">
              Don&apos;t have an account?{" "}
              <button type="button" className="text-white font-medium hover:underline">Sign up</button>
            </p>
            <p className="mt-4 text-xs text-white/40 text-center">
              By signing in, you agree to our{" "}
              <Link href="/legal" className="text-white/60 underline hover:text-white transition-colors">Terms &amp; Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right column — product screenshots */}
      <div className="relative z-10 hidden lg:flex flex-[1.2] overflow-hidden">
        <img
          src="/781shots_so.png"
          alt="Haulvisor route search"
          className="absolute rounded-tl-xl"
          style={{ width: "250%", height: "auto", bottom: "0%", right: "-60%", scale: "180%" }}
        />
        {/* Mobile mockup — fixed position relative to webapp */}
        <img
          src="/403shots_so.png"
          alt="Haulvisor mobile app"
          className="absolute bottom-0 left-[-300px] z-10 pointer-events-none drop-shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
          style={{ bottom: "-5%", height: "750px", width: "1000px", minWidth: "1000px", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}
