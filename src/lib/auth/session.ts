// Session helpers: validate the access-token cookie against Supabase Auth
// and load the caller's role from public.profiles.
import type { AstroCookies } from 'astro';
import { supabaseAdmin } from '../supabase/admin';
import type { Role } from './permissions';

export const ACCESS_COOKIE = 'bf-access';
export const PREVIEW_COOKIE = 'bf-preview';

export interface SessionProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

/**
 * Returns the signed-in user's profile, or null when signed out,
 * the token expired, or the CMS isn't configured yet.
 */
export async function getSessionProfile(cookies: AstroCookies): Promise<SessionProfile | null> {
  const token = cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', data.user.id)
      .single();
    if (!profile) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      full_name: profile.full_name as string,
      role: profile.role as Role,
    };
  } catch {
    return null;
  }
}
