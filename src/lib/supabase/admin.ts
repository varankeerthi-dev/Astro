// Server-only Supabase client (service role). Bypasses RLS — use ONLY in
// Astro server endpoints / SSR frontmatter, after an explicit permission check.
// NEVER import from client-side code, and NEVER expose the key via PUBLIC_* env.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL ?? '') as string;
const serviceKey = (import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '') as string;

export const cmsServerReady = Boolean(url && serviceKey);

if (!cmsServerReady) {
  console.warn('[cms] SUPABASE_SERVICE_ROLE_KEY not set — admin endpoints will return 503.');
}

export const supabaseAdmin: SupabaseClient = createClient(
  url || 'https://placeholder.invalid',
  serviceKey || 'missing-service-role-key',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
