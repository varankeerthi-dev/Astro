// Article-aware CRUD for entities that own a `pages` row + `page_seo` record
// (blog posts, KB articles, location pages). Content is stored as Markdown;
// on save we derive the sanitized HTML, TOC and reading time.
import type { APIContext } from 'astro';
import { supabaseAdmin } from '../supabase/admin';
import { json, requireCapability, snapshotVersion, writeAudit } from './helpers';
import { purgeCacheTags } from '../cache';
import { renderMarkdown, readingTime } from '../md';
import { slugify } from '../utils/slug';
import type { CrudConfig } from './crud';
import type { Capability } from '../auth/permissions';

export interface ArticleCreateOpts {
  pageType: string;
  slugPrefix: string; // '/blog/' | '/help/' | '/locations/'
  slugFrom: (body: Record<string, unknown>) => string;
}

function pick(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
}

const SEO_FIELDS = [
  'seo_title', 'meta_description', 'canonical_url', 'robots',
  'focus_keyword', 'secondary_keywords', 'og_title', 'og_description',
  'twitter_card', 'breadcrumb_title',
];

export async function upsertPageSeo(pageId: string, seo: Record<string, unknown>): Promise<void> {
  const clean = pick(seo, SEO_FIELDS);
  if (Object.keys(clean).length === 0) return;
  const { data: existing } = await supabaseAdmin.from('page_seo').select('page_id').eq('page_id', pageId).maybeSingle();
  if (existing) await supabaseAdmin.from('page_seo').update(clean).eq('page_id', pageId);
  else await supabaseAdmin.from('page_seo').insert({ page_id: pageId, ...clean });
}

export async function articleCreate(ctx: APIContext, cfg: CrudConfig, opts: ArticleCreateOpts): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, cfg.capCreate ?? 'content.create');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const slug = opts.slugFrom(body);
  const { data: page, error: pageErr } = await supabaseAdmin
    .from('pages')
    .insert({ slug, title: String(body.title ?? 'Untitled').slice(0, 120), page_type: opts.pageType, status: 'draft' })
    .select()
    .single();
  if (pageErr) return json({ error: 'slug_in_use', message: `A page with this slug already exists (${slug}).` }, 409);

  const row: Record<string, unknown> = { page_id: page.id, status: 'draft' };
  for (const f of cfg.editable) if (body[f] !== undefined) row[f] = body[f];
  if (typeof row.content_md === 'string') {
    const { html, toc } = renderMarkdown(row.content_md as string);
    row.content_html = html;
    row.toc = toc;
    row.reading_time_min = readingTime(row.content_md as string);
  }
  const { data, error } = await supabaseAdmin.from(cfg.entity).insert(row).select().single();
  if (error) return json({ error: error.message }, 400);

  if (body.seo) await upsertPageSeo(page.id, body.seo as Record<string, unknown>);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'create',
    entity: cfg.label,
    entity_id: data.id as string,
    summary: `Created ${cfg.label}: ${String(data.title ?? data.hero_heading ?? data.id)}`,
    ip: ctx.clientAddress,
  });
  return json(data, 201);
}

export async function articleUpdate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, cfg.capEdit ?? 'content.edit');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const { data: before } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);

  const patch = pick(body, cfg.editable);
  if (typeof patch.content_md === 'string') {
    const { html, toc } = renderMarkdown(patch.content_md as string);
    patch.content_html = html;
    patch.toc = toc;
    patch.reading_time_min = readingTime(patch.content_md as string);
  }
  if (typeof patch.testimonials === 'string') {
    try { patch.testimonials = JSON.parse(patch.testimonials as string); } catch { /* keep raw */ }
  }
  if (typeof patch.faqs === 'string') {
    try { patch.faqs = JSON.parse(patch.faqs as string); } catch { /* keep raw */ }
  }
  if (typeof patch.related_post_ids === 'string') {
    try { patch.related_post_ids = JSON.parse(patch.related_post_ids as string); } catch { /* keep raw */ }
  }
  if (typeof patch.related_article_ids === 'string') {
    try { patch.related_article_ids = JSON.parse(patch.related_article_ids as string); } catch { /* keep raw */ }
  }

  const { data, error } = await supabaseAdmin
    .from(cfg.entity)
    .update({ ...patch, updated_by: ctx.locals.profile?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  const pageId = before.page_id as string | null;
  if (pageId) {
    if (body.seo) await upsertPageSeo(pageId, body.seo as Record<string, unknown>);
    const title = patch.title ?? patch.hero_heading;
    if (typeof title === 'string') {
      await supabaseAdmin.from('pages').update({ title: title.slice(0, 120) }).eq('id', pageId);
    }
    // location pages: keep the URL slug in sync with city/state
    if (cfg.entity === 'location_pages' && (patch.city || patch.state)) {
      const city = String(patch.city ?? before.city ?? '');
      const state = String(patch.state ?? before.state ?? '');
      await supabaseAdmin.from('pages').update({ slug: `/locations/${slugify(`${city}-${state}`)}` }).eq('id', pageId);
    }
  }

  if (cfg.versionable) await snapshotVersion(cfg.entity, id, data, 'manual', ctx.locals.profile?.id);

  const diff: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(patch)) {
    const old = (before as Record<string, unknown>)[k];
    if (JSON.stringify(old) !== JSON.stringify(v)) diff[k] = [old ?? null, v];
  }
  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'update',
    entity: cfg.label,
    entity_id: id,
    summary: `Updated ${cfg.label}`,
    diff,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(cfg.cacheTags);
  return json(data);
}

export async function articleDuplicate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, 'content.duplicate');
  if (denied) return denied;

  const { data: src } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!src) return json({ error: 'not_found' }, 404);

  const title = `${String(src.title ?? src.hero_heading ?? 'Untitled')} (copy)`;
  const base = slugify(String(src.title ?? src.hero_heading ?? 'copy'));
  let slug = base;
  for (let n = 2; ; n++) {
    const { data: clash } = await supabaseAdmin.from('pages').select('id').eq('slug', slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${n}`;
  }
  const { data: page, error: pageErr } = await supabaseAdmin
    .from('pages')
    .insert({ slug, title, page_type: src.page_type ?? 'static', status: 'draft' })
    .select()
    .single();
  if (pageErr) return json({ error: pageErr.message }, 400);

  const row = pick(src as Record<string, unknown>, cfg.editable);
  row.page_id = page.id;
  row.status = 'draft';
  delete row.publish_at;

  const { data, error } = await supabaseAdmin.from(cfg.entity).insert(row).select().single();
  if (error) return json({ error: error.message }, 400);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'create',
    entity: cfg.label,
    entity_id: data.id as string,
    summary: `Duplicated ${cfg.label} from ${id}`,
    ip: ctx.clientAddress,
  });
  return json(data, 201);
}
