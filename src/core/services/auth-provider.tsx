"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  type AuthUser,
  type NewPasswordChallenge,
  getCurrentUser,
  getSessionToken,
  loginLocal,
  loginAsDemo,
  loginCognito,
  completeNewPassword,
  logout as authLogout,
  logoutDemo,
  isDemoUser,
} from "@/core/services/auth";
import { fetchApi } from "@/core/services/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  activeCompanyId: string | null;
  company_ids: string[];
  noCompanyAccess: boolean;
  login: (email: string, password: string) => Promise<"ok" | "NEW_PASSWORD_REQUIRED" | "NO_COMPANY">;
  completeNewPasswordChallenge: (newPassword: string) => Promise<"ok" | "NO_COMPANY">;
  loginDemo: () => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Returns true if user has company access (or is admin), false otherwise. */
async function fetchProfile(
  currentUser: AuthUser,
  setUser: (u: AuthUser | null) => void,
  setCompanyIds: (ids: string[]) => void,
  setActiveCompanyId: (id: string | null) => void,
  isLogin = false,
): Promise<boolean> {
  try {
    const profile = await fetchApi<{ company_ids: string[]; role?: string }>(
      "auth/me",
      isLogin ? { headers: { "x-login-sync": "1" } } : {},
    );
    const ids = profile.company_ids ?? [];
    const role = profile.role ?? currentUser.role;
    setCompanyIds(ids);
    setActiveCompanyId(ids[0] ?? null);
    setUser({ ...currentUser, company_ids: ids, role });
    // Admins can browse without a company
    return ids.length > 0 || role === "admin";
  } catch {
    // Fall back to token data
    setCompanyIds(currentUser.company_ids);
    setActiveCompanyId(currentUser.company_ids[0] ?? null);
    return currentUser.company_ids.length > 0 || currentUser.role === "admin";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [noCompanyAccess, setNoCompanyAccess] = useState(false);

  useEffect(() => {
    // Check for existing token on mount
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId)
        .then((hasAccess) => { if (!hasAccess) setNoCompanyAccess(true); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const [pendingChallenge, setPendingChallenge] = useState<NewPasswordChallenge | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<"ok" | "NEW_PASSWORD_REQUIRED" | "NO_COMPANY"> => {
    setNoCompanyAccess(false);
    // In dev, try local-login endpoint first
    if (process.env.NODE_ENV === "development") {
      try {
        await loginLocal(email, password);
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          const hasAccess = await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
          if (!hasAccess) { setNoCompanyAccess(true); return "NO_COMPANY"; }
        }
        return "ok";
      } catch (err) {
        // Empty credentials are local-only — surface error
        if (!email && !password) throw err;
        // Otherwise fall through to Cognito
      }
    }

    // Cognito login
    const result = await loginCognito(email, password);
    if ("type" in result && result.type === "NEW_PASSWORD_REQUIRED") {
      setPendingChallenge(result);
      return "NEW_PASSWORD_REQUIRED";
    }

    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const hasAccess = await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
      if (!hasAccess) { setNoCompanyAccess(true); return "NO_COMPANY"; }
    }
    return "ok";
  }, []);

  const completeNewPasswordChallenge = useCallback(async (newPassword: string): Promise<"ok" | "NO_COMPANY"> => {
    if (!pendingChallenge) throw new Error("No pending password challenge");
    await completeNewPassword(pendingChallenge.cognitoUser, newPassword);
    setPendingChallenge(null);
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const hasAccess = await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
      if (!hasAccess) { setNoCompanyAccess(true); return "NO_COMPANY"; }
    }
    return "ok";
  }, [pendingChallenge]);

  const loginDemo = useCallback(async () => {
    // Stash real user's session state, then clear for a fresh demo experience
    try {
      const keys = ["hv-route-filters", "hv-tour-dismissed"];
      const stash: Record<string, string> = {};
      for (const k of keys) {
        const v = sessionStorage.getItem(k);
        if (v != null) stash[k] = v;
      }
      if (Object.keys(stash).length > 0) {
        sessionStorage.setItem("hv-pre-demo-stash", JSON.stringify(stash));
      }
      for (const k of keys) sessionStorage.removeItem(k);
    } catch {}
    queryClient.clear();
    await loginAsDemo();
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
    }
  }, []);

  const logout = useCallback(() => {
    if (isDemoUser()) {
      logoutDemo();
      try {
        // Clear demo's session state first
        sessionStorage.removeItem("hv-route-filters");
        sessionStorage.removeItem("hv-tour-dismissed");
        // Then restore real user's stashed state (overwrites cleared keys)
        const raw = sessionStorage.getItem("hv-pre-demo-stash");
        if (raw) {
          const stash = JSON.parse(raw) as Record<string, string>;
          for (const [k, v] of Object.entries(stash)) sessionStorage.setItem(k, v);
          sessionStorage.removeItem("hv-pre-demo-stash");
        }
      } catch {}
    } else {
      authLogout();
    }
    queryClient.clear();
    setUser(null);
    setCompanyIds([]);
    setActiveCompanyId(null);
    setNoCompanyAccess(false);
  }, []);

  const getToken = useCallback(async () => {
    return getSessionToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeCompanyId,
        company_ids: companyIds,
        noCompanyAccess,
        login,
        completeNewPasswordChallenge,
        loginDemo,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/**
 * Wrapper that redirects to login if not authenticated.
 * Blocks non-admin users with no company from accessing the app.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, noCompanyAccess, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (noCompanyAccess) {
    return <NoCompanyGate onSignOut={logout} />;
  }

  return <>{children}</>;
}

function NoCompanyGate({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg text-center space-y-4">
        <h2 className="text-lg font-semibold">No Company Assigned</h2>
        <p className="text-sm text-muted-foreground">
          Your account is not associated with a company. Please contact your administrator to get access.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
