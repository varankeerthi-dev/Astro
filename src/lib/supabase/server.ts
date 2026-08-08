// Per-request Supabase client that queries with the signed-in user's JWT,
// so Row Level Security applies their role. Use for /admin list views.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { ACCESS_COOKIE } from '../auth/session';

export function supabaseForUser(cookies: AstroCookies): SupabaseClient {
  const token = cookies.get(ACCESS_COOKIE)?.value;
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL as string,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    },
  );
}
