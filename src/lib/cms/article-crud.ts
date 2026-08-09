// Article-aware CRUD for entities that own a `pages` row + `page_seo` record
// (blog posts, KB articles, location pages). Content is stored as Markdown;
// on save we derive the sanitized HTML, TOC and reading time.
// The page + SEO + entity writes run in ONE transaction (Neon withTx).
import type { APIContext } from 'astro';
import { query, queryOne, withTx, safeIdent } from '../db';
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

/** Upsert a page_seo row inside a transaction (q = tx-scoped query). */
async function upsertPageSeo(
  q: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>,
  pageId: string,
  seo: Record<string, unknown>,
): Promise<void> {
  const clean = pick(seo, SEO_FIELDS);
  if (Object.keys(clean).length === 0) return;
  const keys = Object.keys(clean);
  const set = keys.map((k, i) => `${safeIdent(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => clean[k]);
  await q(
    `insert into public.page_seo (page_id, ${keys.join(', ')})
     values ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     on conflict (page_id) do update set ${set}`,
    [pageId, ...vals],
  );
}

/**
 * Derive content_html/toc/reading_time from content_md (shared by create/update).
 * toc is a jsonb column — node-postgres serializes JS objects to JSON, but a
 * plain array of objects would be sent as a Postgres array literal, so we
 * stringify explicitly (same for testimonials/faqs).
 */
function deriveContent(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof body.content_md === 'string') {
    const { html, toc } = renderMarkdown(body.content_md);
    out.content_html = html;
    out.toc = JSON.stringify(toc);
    out.reading_time_min = readingTime(body.content_md);
  }
  return out;
}

/** Stringify jsonb fields so they bind correctly (testimonials/faqs/contact). */
function normalizeJsonb(patch: Record<string, unknown>): Record<string, unknown> {
  for (const k of ['testimonials', 'faqs', 'contact']) {
    if (patch[k] !== undefined && patch[k] !== null) {
      try {
        patch[k] = typeof patch[k] === 'string' ? patch[k] : JSON.stringify(patch[k]);
      } catch {
        /* keep raw */
      }
    }
  }
  return patch;
}

export async function articleCreate(ctx: APIContext, cfg: CrudConfig, opts: ArticleCreateOpts): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, cfg.capCreate ?? 'content.create');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const slug = opts.slugFrom(body);

  try {
    const data = await withTx(async (q) => {
      const pages = await q<Record<string, unknown>>(
        `insert into public.pages (slug, title, page_type, status)
         values ($1, $2, $3, 'draft') returning *`,
        [slug, String(body.title ?? 'Untitled').slice(0, 120), opts.pageType],
      );
      const page = pages[0];

      const row: Record<string, unknown> = { page_id: page.id, status: 'draft' };
      for (const f of cfg.editable) if (body[f] !== undefined) row[f] = body[f];
      Object.assign(row, normalizeJsonb(deriveContent(row)));

      const keys = Object.keys(row);
      const rows = await q<Record<string, unknown>>(
        `insert into public.${safeIdent(cfg.entity)} (${keys.join(', ')})
         values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
        keys.map((k) => row[k]),
      );
      const entity = rows[0];

      if (body.seo && typeof body.seo === 'object') {
        await upsertPageSeo(q, page.id as string, body.seo as Record<string, unknown>);
      }
      return entity;
    });
    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'create',
      entity: cfg.label,
      entity_id: data.id as string,
      summary: `Created ${cfg.label}: ${String(data.title ?? data.hero_heading ?? data.id)}`,
      ip: ctx.clientAddress,
    });
    return json(data, 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (/duplicate key|already exists/i.test(msg)) {
      return json({ error: 'slug_in_use', message: `A page with this slug already exists (${slug}).` }, 409);
    }
    return json({ error: msg }, 400);
  }
}

export async function articleUpdate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, cfg.capEdit ?? 'content.edit');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const before = await queryOne<Record<string, unknown>>(
    `select * from public.${safeIdent(cfg.entity)} where id = $1`,
    [id],
  );
  if (!before) return json({ error: 'not_found' }, 404);

  const patch = pick(body, cfg.editable);
  Object.assign(patch, deriveContent(patch));
  normalizeJsonb(patch);
  for (const k of ['related_post_ids', 'related_article_ids'] as const) {
    if (typeof patch[k] === 'string') {
      try {
        patch[k] = JSON.parse(patch[k] as string);
      } catch {
        /* keep raw */
      }
    }
  }

  try {
    const data = await withTx(async (q) => {
      const merged: Record<string, unknown> = {
        ...patch,
        updated_by: ctx.locals.profile?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      const keys = Object.keys(merged);
      const set = keys.map((k, i) => `${safeIdent(k)} = $${i + 1}`).join(', ');
      const rows = await q<Record<string, unknown>>(
        `update public.${safeIdent(cfg.entity)} set ${set} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => merged[k]), id],
      );
      const entity = rows[0];

      const pageId = before.page_id as string | null;
      if (pageId) {
        if (body.seo && typeof body.seo === 'object') {
          await upsertPageSeo(q, pageId, body.seo as Record<string, unknown>);
        }
        const title = patch.title ?? patch.hero_heading;
        if (typeof title === 'string') {
          await q(`update public.pages set title = $1 where id = $2`, [String(title).slice(0, 120), pageId]);
        }
        // location pages: keep the URL slug in sync with city/state
        if (cfg.entity === 'location_pages' && (patch.city || patch.state)) {
          const city = String(patch.city ?? before.city ?? '');
          const state = String(patch.state ?? before.state ?? '');
          await q(`update public.pages set slug = $1 where id = $2`, [`/locations/${slugify(`${city}-${state}`)}`, pageId]);
        }
      }
      return entity;
    });

    if (cfg.versionable) await snapshotVersion(cfg.entity, id, data, 'manual', ctx.locals.profile?.id);

    const diff: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(patch)) {
      const old = before[k];
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
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}

export async function articleDuplicate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(ctx.locals.profile, 'content.duplicate');
  if (denied) return denied;

  const src = await queryOne<Record<string, unknown>>(
    `select * from public.${safeIdent(cfg.entity)} where id = $1`,
    [id],
  );
  if (!src) return json({ error: 'not_found' }, 404);

  const title = `${String(src.title ?? src.hero_heading ?? 'Untitled')} (copy)`;
  const base = slugify(String(src.title ?? src.hero_heading ?? 'copy'));
  let slug = base;
  for (let n = 2; ; n++) {
    const clash = await queryOne<{ id: string }>(`select id from public.pages where slug = $1`, [slug]);
    if (!clash) break;
    slug = `${base}-${n}`;
  }

  try {
    const data = await withTx(async (q) => {
      const pages = await q<Record<string, unknown>>(
        `insert into public.pages (slug, title, page_type, status)
         values ($1, $2, $3, 'draft') returning *`,
        [slug, title, src.page_type ?? 'static'],
      );
      const page = pages[0];

      const row = pick(src, cfg.editable);
      row.page_id = page.id;
      row.status = 'draft';
      delete row.publish_at;
      delete row.unpublish_at;
      normalizeJsonb(row);

      const keys = Object.keys(row);
      const rows = await q<Record<string, unknown>>(
        `insert into public.${safeIdent(cfg.entity)} (${keys.join(', ')})
         values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
        keys.map((k) => row[k]),
      );
      return rows[0];
    });

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'create',
      entity: cfg.label,
      entity_id: data.id as string,
      summary: `Duplicated ${cfg.label} from ${id}`,
      ip: ctx.clientAddress,
    });
    return json(data, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
