/**
 * Client for the Python backend API (auth, expenses, summary).
 * Use NEXT_PUBLIC_BACKEND_URL in the browser; API routes can use BACKEND_URL.
 */

const AUTH_TOKEN_KEY = "fin_brawl_backend_token";

export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  }
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export type BackendAuth = { token: string; user_id: number };
export type BackendMe = { user_id: number; username: string };
export type BackendRegister = { user_id: number; token?: string };

export async function fetchBackend<T = unknown>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token: optToken, ...init } = options;
  const base = getBackendUrl();
  const token = optToken !== undefined ? optToken : getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg =
      (err as { detail?: string; error?: string }).detail ||
      (err as { detail?: string; error?: string }).error ||
      res.statusText;
    throw new Error(msg);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<BackendAuth> {
  const data = await fetchBackend<BackendAuth>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    token: null,
  });
  return data;
}

export async function register(username: string, password: string): Promise<BackendRegister> {
  const data = await fetchBackend<BackendRegister>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    token: null,
  });
  return data;
}

export async function getMe(): Promise<BackendMe> {
  return fetchBackend<BackendMe>("/auth/me");
}

export type BackendTransaction = {
  id: string;
  user_id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string | null;
  source: "chat" | "receipt";
  receipt_url: string | null;
  created_at: string;
};

export async function getExpenses(): Promise<BackendTransaction[]> {
  return fetchBackend<BackendTransaction[]>("/expenses?limit=200");
}

export type AddExpenseBody = {
  amount_cents: number;
  category: string;
  occurred_at: string;
  note?: string | null;
  source?: "chat" | "receipt";
};

export async function addExpense(body: AddExpenseBody): Promise<{ id: number }> {
  return fetchBackend<{ id: number }>("/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type Summary = {
  year_month: string;
  monthly_spend_cents: number;
  monthly_income_cents: number;
  savings_rate: number | null;
  category_distribution: { category: string; total_cents: number }[];
};

export async function getSummary(year_month?: string): Promise<Summary> {
  const q = year_month ? `?year_month=${encodeURIComponent(year_month)}` : "";
  return fetchBackend<Summary>(`/summary${q}`);
}

export async function getSumLast30(): Promise<{ total_cents: number }> {
  return fetchBackend<{ total_cents: number }>("/expenses/sum-last-30");
}
