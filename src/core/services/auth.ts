import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

// Cognito config — these will come from env vars in production
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

const TOKEN_KEY = "id_token";

let userPool: CognitoUserPool | null = null;

function getUserPool(): CognitoUserPool | null {
  if (!POOL_ID || !CLIENT_ID) return null;
  if (!userPool) {
    userPool = new CognitoUserPool({
      UserPoolId: POOL_ID,
      ClientId: CLIENT_ID,
    });
  }
  return userPool;
}

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  role?: string;
  company_ids: string[];
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function getIdToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setIdToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function getRoleFromToken(): string | null {
  const token = getIdToken();
  if (!token) return null;
  const payload = decodePayload(token);
  return (payload?.role as string) ?? null;
}

export function isDemoUser(): boolean {
  return getRoleFromToken() === "demo";
}

// ---------------------------------------------------------------------------
// Session token for API requests
// ---------------------------------------------------------------------------

export async function getSessionToken(): Promise<string | null> {
  // If we have a self-signed token (local/demo), use it
  const stored = getIdToken();
  if (stored) return stored;

  // Otherwise try Cognito session
  const pool = getUserPool();
  if (!pool) return null;

  const currentUser = pool.getCurrentUser();
  if (!currentUser) return null;

  return new Promise((resolve) => {
    currentUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session?.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Login flows
// ---------------------------------------------------------------------------

/**
 * Local dev login — calls POST /api/auth/local-login.
 * Empty credentials get a self-signed JWT from the backend.
 */
export async function loginLocal(
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch("/api/auth/local-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Login failed");
    throw new Error(text);
  }
  const { token } = await res.json();
  setIdToken(token);
}

/**
 * Demo login — calls POST /api/demo.
 * Creates a demo user with 24h TTL pointing to the shared demo dataset.
 */
export async function loginAsDemo(): Promise<void> {
  const res = await fetch("/api/demo", { method: "POST" });
  if (!res.ok) throw new Error("Demo unavailable");
  const { token } = await res.json();
  setIdToken(token);
}

/**
 * Cognito login for production.
 * Returns 'NEW_PASSWORD_REQUIRED' with the cognitoUser if a password change is needed.
 */
export interface NewPasswordChallenge {
  type: "NEW_PASSWORD_REQUIRED";
  cognitoUser: CognitoUser;
}

export type LoginResult = CognitoUserSession | NewPasswordChallenge;

export function loginCognito(
  username: string,
  password: string,
): Promise<LoginResult> {
  const pool = getUserPool();
  if (!pool) {
    return Promise.reject(new Error("Cognito not configured"));
  }

  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: pool,
  });

  const authDetails = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        setIdToken(session.getIdToken().getJwtToken());
        resolve(session);
      },
      onFailure: reject,
      newPasswordRequired: () => {
        resolve({ type: "NEW_PASSWORD_REQUIRED", cognitoUser });
      },
    });
  });
}

export function completeNewPassword(
  cognitoUser: CognitoUser,
  newPassword: string,
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        setIdToken(session.getIdToken().getJwtToken());
        resolve(session);
      },
      onFailure: reject,
    });
  });
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export function logout(): void {
  clearToken();

  // Also sign out of Cognito if active
  const pool = getUserPool();
  const currentUser = pool?.getCurrentUser();
  currentUser?.signOut();
}

/**
 * Logout demo user — just clears the local token.
 * The backend user record expires naturally via DynamoDB TTL.
 */
export function logoutDemo(): void {
  logout();
}

// ---------------------------------------------------------------------------
// Current user from token
// ---------------------------------------------------------------------------

export function getCurrentUser(): AuthUser | null {
  const token = getIdToken();
  if (!token) return null;

  const payload = decodePayload(token);
  if (!payload) return null;

  const role = payload.role as string | undefined;
  const email = payload.email as string | undefined;
  const displayName = email
    ?? (role === "demo" ? "Demo User" : undefined)
    ?? (payload.sub as string)
    ?? "unknown";

  return {
    userId: (payload.sub as string) ?? "",
    username: displayName,
    email,
    role,
    company_ids: (payload.company_ids as string[]) ?? [],
  };
}
