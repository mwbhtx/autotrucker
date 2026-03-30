"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import { useAuth } from "@/core/services/auth-provider";
import { MarketingNav } from "@/platform/web/components/marketing-nav";
import { BackgroundBeams } from "@/platform/web/components/ui/beams";
import { SHADER_PRESETS, DEFAULT_SHADER } from "@/core/constants/shader-presets";
const ShaderGradientCanvas = dynamic(() => import("@shadergradient/react").then(m => ({ default: m.ShaderGradientCanvas })), { ssr: false });
const ShaderGradient = dynamic(() => import("@shadergradient/react").then(m => ({ default: m.ShaderGradient })), { ssr: false });

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
    <div className="dark min-h-screen text-foreground relative" style={{ backgroundColor: '#000000' }}>
      {/* Layer 1: Shader gradient (fixed background) */}
      {(() => {
        const preset = SHADER_PRESETS.find(p => p.name === DEFAULT_SHADER) ?? SHADER_PRESETS[0];
        return (
          <ShaderGradientCanvas
            style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0, animation: "fade-in 1s ease-in 0.5s forwards" }}
            pixelDensity={2}
            fov={preset.fov}
          >
            <ShaderGradient {...preset.props} />
          </ShaderGradientCanvas>
        );
      })()}

      {/* Layer 2: Full-page glass overlay */}
      <div className="fixed inset-0 z-[1] bg-black/40 backdrop-blur-xl" />

      {/* Layer 3: Beams */}
      <div className="fixed inset-0 z-[2] opacity-0 animate-[fade-in_1s_ease-in_forwards] pointer-events-none">
        <BackgroundBeams />
      </div>

      {/* Layer 4: Content */}
      <div className="relative z-[3]">
        <MarketingNav variant="light" hideAuth />
      </div>

      <div className="relative z-[3] flex flex-col items-center justify-center px-6 pt-20 sm:pt-28 pb-20">
        <div className="w-full max-w-sm rounded-2xl bg-black/30 border border-white/[0.08] backdrop-blur-md p-8">
          <h2 className="font-display text-3xl font-normal tracking-wide mb-8 text-white">
            {needsNewPassword ? "Set new password" : "Log in to Haulvisor"}
          </h2>

          {needsNewPassword ? (
            <form onSubmit={handleNewPassword} className="flex flex-col gap-3">
              <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-primary focus-visible:!ring-primary/50" required autoFocus />
              <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-primary focus-visible:!ring-primary/50" required />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-surface-deep text-white text-sm font-semibold hover:bg-surface-deep/80 transition-colors">Set password</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Input type={isDev ? "text" : "email"} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-primary focus-visible:!ring-primary/50" autoFocus {...(!isDev ? { required: true } : {})} />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-white/[0.06] border-white/[0.1] text-sm px-4 text-white placeholder:text-white/30 focus-visible:!border-primary focus-visible:!ring-primary/50" {...(!isDev ? { required: true } : {})} />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className="w-full h-11 mt-1 rounded-lg bg-white/[0.1] border border-white/[0.12] text-white text-sm font-semibold hover:bg-white/[0.15] transition-colors">Log in</button>
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
