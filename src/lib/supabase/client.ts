// Browser-side Supabase client (anon key) — used by future public islands
// (KB feedback widget, search box). RLS restricts these reads to published rows.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** True when the CMS backend is configured (env vars present). */
export const cmsEnabled = Boolean(url && anonKey);

if (!cmsEnabled) {
  console.warn('[cms] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY not set — CMS features disabled.');
}

export const supabase = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder',
  { auth: { persistSession: false } },
);
