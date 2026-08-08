// Public read helpers. Use the service-role client with EXPLICIT live filters
// (mirrors what the RLS anon policy allows). `includeDrafts` is only ever true
// when a signed-in staff member has an active preview cookie (locals.preview).
import { supabaseAdmin } from '../supabase/admin';

export interface LiveOpts {
  includeDrafts?: boolean;
}

const LIVE_WHERE = (opts: LiveOpts, withWindow: boolean) => {
  const and: Record<string, unknown> = { deleted_at: null };
  if (opts.includeDrafts) {
    and.status = 'archived'; // != archived
    return { and, notArchived: true };
  }
  and.status = 'published';
  return { and, withWindow };
};

type Filter = Record<string, unknown>;

export function liveFilter(opts: LiveOpts, withWindow = true): Filter {
  const f: Filter = { status: opts.includeDrafts ? 'archived' : 'published', deleted_at: null };
  if (opts.includeDrafts) return f; // caller must handle != archived semantics
  if (withWindow) {
    f.or = `and(publish_at.is.null,publish_at.lte.now),and(unpublish_at.is.null,unpublish_at.gt.now)`;
  }
  return f;
}

/** banners for the homepage carousel */
export async function getLiveBanners(opts: LiveOpts = {}) {
  let q = supabaseAdmin
    .from('banners')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true });
  if (opts.includeDrafts) {
    q = q.neq('status', 'archived');
  } else {
    q = q.eq('status', 'published').or('publish_at.is.null,publish_at.lte.now').or('unpublish_at.is.null,unpublish_at.gt.now');
  }
  const { data } = await q;
  return data ?? [];
}

/** announcements for the sitewide top bar */
export async function getLiveAnnouncements(opts: LiveOpts = {}) {
  let q = supabaseAdmin
    .from('announcements')
    .select('*')
    .is('deleted_at', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.includeDrafts) {
    q = q.neq('status', 'archived');
  } else {
    q = q.eq('status', 'published').or('publish_at.is.null,publish_at.lte.now').or('unpublish_at.is.null,unpublish_at.gt.now');
  }
  const { data } = await q;
  return data ?? [];
}

/** page + its SEO record (slug = pathname, e.g. '/pricing') */
export async function getPageBySlug(slug: string, opts: LiveOpts = {}) {
  const { data } = await supabaseAdmin
    .from('pages')
    .select('*, page_seo(*)')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  if (!opts.includeDrafts && data.status !== 'published') return null;
  return data;
}

export async function getLocationBySlug(slug: string, opts: LiveOpts = {}) {
  const { data: page } = await supabaseAdmin
    .from('pages')
    .select('id')
    .eq('slug', `/locations/${slug}`)
    .is('deleted_at', null)
    .maybeSingle();
  if (!page) return null;
  const { data } = await supabaseAdmin.from('location_pages').select('*, page:pages(*, page_seo(*))').eq('page_id', page.id).maybeSingle();
  if (!data) return null;
  if (!opts.includeDrafts && data.status !== 'published') return null;
  return data;
}

export async function getBlogPostBySlug(slug: string, opts: LiveOpts = {}) {
  const { data } = await supabaseAdmin
    .from('blog_posts')
    .select('*, category:blog_categories(name, slug), author:profiles(full_name), page:pages(*, page_seo(*))')
    .eq('page:pages.slug', `/blog/${slug}`)
    .maybeSingle();
  if (!data) return null;
  if (!opts.includeDrafts && data.status !== 'published') return null;
  return data;
}

export async function listBlogPosts(opts: { page?: number; perPage?: number; category?: string } = {}) {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 9;
  let q = supabaseAdmin
    .from('blog_posts')
    .select('id, title, excerpt, featured_image_id, reading_time_min, publish_at, created_at, category:blog_categories(name, slug), page:pages(slug)', { count: 'exact' })
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('publish_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (opts.category) q = q.eq('category.slug', opts.category);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0, page, perPage };
}

export async function getKbArticleBySlug(slug: string, opts: LiveOpts = {}) {
  const { data } = await supabaseAdmin
    .from('kb_articles')
    .select('*, category:kb_categories(name, slug, palette_key), author:profiles(full_name), page:pages(slug)')
    .eq('page:pages.slug', `/help/${slug}`)
    .maybeSingle();
  if (!data) return null;
  if (!opts.includeDrafts && data.status !== 'published') return null;
  return data;
}

export async function listKbArticles(opts: { category?: string; kind?: string; limit?: number } = {}) {
  let q = supabaseAdmin
    .from('kb_articles')
    .select('id, title, summary, reading_time_min, updated_at, category:kb_categories(name, slug, palette_key), page:pages(slug)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.category) q = q.eq('category.slug', opts.category);
  if (opts.kind) q = q.eq('kind', opts.kind);
  const { data } = await q;
  return data ?? [];
}

export async function listKbCategories() {
  const { data } = await supabaseAdmin
    .from('kb_categories')
    .select('id, name, slug, kind, palette_key')
    .order('display_order', { ascending: true });
  return data ?? [];
}

export async function listReleaseNotes() {
  const { data } = await supabaseAdmin
    .from('release_notes')
    .select('*')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('released_on', { ascending: false });
  return data ?? [];
}

export async function searchKb(q: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from('kb_articles')
    .select('id, title, summary, page:pages(slug)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .textSearch('search_tsv', q, { type: 'websearch' })
    .limit(limit);
  return data ?? [];
}

/** public media URL helper */
export function mediaUrl(path: string): string {
  const base = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/media/${path}`;
}

/** article body from stored markdown (canonical source for editor v1) */
export function articleBody(md: string | null): string {
  return md ?? '';
}
