// Shared helpers for server-rendered admin pages: call the /api/admin/*
// endpoints from SSR with the caller's cookies, and build payloads from forms.
import type { AstroGlobal } from 'astro';

export async function apiFetch(Astro: AstroGlobal, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', Astro.request.headers.get('cookie') ?? '');
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(`${Astro.url.origin}${path}`, { ...init, headers });
}

export async function apiGet<T>(Astro: AstroGlobal, path: string): Promise<T> {
  const res = await apiFetch(Astro, path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function apiSend(
  Astro: AstroGlobal,
  path: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; error: string }> {
  const res = await apiFetch(Astro, path, { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, data, error: (data?.error as string) ?? (res.ok ? '' : `HTTP ${res.status}`) };
}

/** Convert formData → JSON payload. Empty strings become null; repeated keys become arrays. */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    const val = String(v);
    if (out[k] !== undefined) {
      out[k] = Array.isArray(out[k]) ? [...(out[k] as string[]), val] : [out[k] as string, val];
    } else {
      out[k] = val === '' ? null : val;
    }
  }
  return out;
}

/** Pretty-print a status enum for admin tables. */
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-slate-100 text-slate-400',
};
