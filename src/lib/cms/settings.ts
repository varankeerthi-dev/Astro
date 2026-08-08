// CMS reads used by public rendering (Layout, endpoints). Two properties matter:
//  1. graceful fallback — returns null/[] when the CMS isn't configured yet,
//     so the site builds and renders exactly as before the CMS existed;
//  2. a short in-memory cache — one settings read per minute per serverless
//     instance, not per component per request.
import { supabaseAdmin, cmsServerReady } from '../supabase/admin';

export interface SiteSettings {
  site_name?: string | null;
  tagline?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  copyright_text?: string | null;
  default_seo_title?: string | null;
  default_seo_description?: string | null;
  robots_txt?: string | null;
  sitemap_enabled?: boolean | null;
  gsc_verification?: string | null;
  clarity_project_id?: string | null;
  umami_website_id?: string | null;
  cookie_consent_text?: string | null;
  header_scripts?: string | null;
  footer_scripts?: string | null;
  [key: string]: unknown;
}

export interface FooterLink {
  id: string;
  column_name: string;
  label: string;
  url: string;
  display_order: number;
}

const TTL_MS = 60_000;

let settingsCache: { at: number; value: SiteSettings | null } | null = null;
let linksCache: { at: number; value: FooterLink[] } | null = null;

/** Drop the caches (called by /admin/settings after a successful save). */
export function bustCmsCache(): void {
  settingsCache = null;
  linksCache = null;
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!cmsServerReady) return null;
  if (settingsCache && Date.now() - settingsCache.at < TTL_MS) return settingsCache.value;
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    const value = error ? null : (data as SiteSettings | null);
    settingsCache = { at: Date.now(), value };
    return value;
  } catch {
    return null; // table not migrated yet, network hiccup → render with fallbacks
  }
}

export async function getFooterLinks(): Promise<FooterLink[]> {
  if (!cmsServerReady) return [];
  if (linksCache && Date.now() - linksCache.at < TTL_MS) return linksCache.value;
  try {
    const { data, error } = await supabaseAdmin
      .from('footer_links')
      .select('id, column_name, label, url, display_order')
      .eq('is_active', true)
      .order('column_name')
      .order('display_order');
    const value = error ? [] : ((data ?? []) as FooterLink[]);
    linksCache = { at: Date.now(), value };
    return value;
  } catch {
    return [];
  }
}
