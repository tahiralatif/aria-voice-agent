export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SessionInfo = { url: string; token: string };

export async function createSession(): Promise<SessionInfo> {
  const r = await fetch(`${API}/session`, { method: "POST" });
  if (!r.ok) throw new Error("Could not start a call. Is the backend running?");
  return r.json();
}

export type ActivityEvent = {
  id: number;
  ts: string;
  kind: "search" | "availability" | "booking" | "lead" | "web" | "register" | "email" | string;
  text: string;
  data?: {
    count?: number;
    listings?: { title: string; area: string; price: string | number; bedrooms: number }[];
  } | null;
};

export async function fetchActivity(sinceId: number | null) {
  const q = sinceId === null ? "" : `?since_id=${sinceId}`;
  const r = await fetch(`${API}/public/activity${q}`, { cache: "no-store" });
  if (!r.ok) throw new Error("activity unavailable");
  return (await r.json()) as { events: ActivityEvent[]; last_id: number };
}

export async function adminGet<T>(path: string, token: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { "X-Admin-Token": token }, cache: "no-store" });
  if (r.status === 401 || r.status === 403) throw new Error("auth");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
