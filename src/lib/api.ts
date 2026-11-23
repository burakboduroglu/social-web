import { ApiError, parseRetryAfter } from "./errors";
import { redirect } from "@tanstack/react-router";
import { supabase } from "./supabase";
import { RequestCache } from "./request-cache";
import { allocateResponseVersion, tagResponseVersion } from "./response-version";

const cache = new RequestCache(100);
export function invalidateApiCache(includeProfile = false) {
  cache.invalidate(key => includeProfile || !key.endsWith(":/me"));
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { invalidateApiCache(true); throw redirect({ to: "/sign-in" }); }
  const userKey = session.user?.id || session.access_token;
  const request = async () => {
    const version = allocateResponseVersion();
    let token = session.access_token;
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(`/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401) {
        // A rotated token can be rejected once. Refresh and retry before treating
        // the person as signed out, so a stale token never bounces them to /sign-in.
        if (attempt === 0) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session) { token = refreshed.session.access_token; continue; }
        }
        invalidateApiCache(true);
        throw redirect({ to: "/sign-in" });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new ApiError(response.status, data.error || "İşlem tamamlanamadı.", parseRetryAfter(response.headers.get("Retry-After")));
      return tagResponseVersion(data, version) as T;
    }
  };
  if (method === "GET") return cache.get(`${userKey}:${path}`, path === "/me" ? 60_000 : 15_000, request);
  const data = await request();
  // A post/like should not refetch the shell's profile and community list.
  // Profile and membership edits do refresh that context immediately.
  invalidateApiCache(path === "/me" || path.startsWith("/communities"));
  return data;
}
