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
} from "@/lib/auth";
import { fetchApi } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  activeCompanyId: string | null;
  company_ids: string[];
  login: (email: string, password: string) => Promise<"ok" | "NEW_PASSWORD_REQUIRED">;
  completeNewPasswordChallenge: (newPassword: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(
  currentUser: AuthUser,
  setUser: (u: AuthUser | null) => void,
  setCompanyIds: (ids: string[]) => void,
  setActiveCompanyId: (id: string | null) => void,
  isLogin = false,
) {
  try {
    const profile = await fetchApi<{ company_ids: string[]; role?: string }>(
      "auth/me",
      isLogin ? { headers: { "x-login-sync": "1" } } : {},
    );
    const ids = profile.company_ids ?? [];
    setCompanyIds(ids);
    setActiveCompanyId(ids[0] ?? null);
    setUser({
      ...currentUser,
      company_ids: ids,
      role: profile.role ?? currentUser.role,
    });
  } catch {
    // Fall back to token data
    setCompanyIds(currentUser.company_ids);
    setActiveCompanyId(currentUser.company_ids[0] ?? null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing token on mount
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const [pendingChallenge, setPendingChallenge] = useState<NewPasswordChallenge | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<"ok" | "NEW_PASSWORD_REQUIRED"> => {
    // In dev, try local-login endpoint first
    if (process.env.NODE_ENV === "development") {
      try {
        await loginLocal(email, password);
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
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
      await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
    }
    return "ok";
  }, []);

  const completeNewPasswordChallenge = useCallback(async (newPassword: string) => {
    if (!pendingChallenge) throw new Error("No pending password challenge");
    await completeNewPassword(pendingChallenge.cognitoUser, newPassword);
    setPendingChallenge(null);
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      await fetchProfile(currentUser, setUser, setCompanyIds, setActiveCompanyId, true);
    }
  }, [pendingChallenge]);

  const loginDemo = useCallback(async () => {
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
    } else {
      authLogout();
    }
    setUser(null);
    setCompanyIds([]);
    setActiveCompanyId(null);
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
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
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

  return <>{children}</>;
}
