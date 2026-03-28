import { getSessionToken, isDemoUser, logout } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch helper that prepends /api/ to paths and injects the auth token.
 * Handles 401 responses: demo tokens can't be refreshed so redirect to login.
 */
export async function fetchApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `/api/${path.replace(/^\//, "")}`;

  const headers = new Headers(options.headers);

  // Inject auth token if available
  const token = await getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Demo tokens can't be refreshed — redirect to login
    if (isDemoUser()) {
      logout();
      window.location.href = "/";
      throw new ApiError(401, "Demo session expired");
    }

    // For other tokens, clear and redirect
    logout();
    window.location.href = "/";
    throw new ApiError(401, "Session expired");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new ApiError(response.status, text);
  }

  // Return empty for 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
