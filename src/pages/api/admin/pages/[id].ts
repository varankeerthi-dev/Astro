import type { APIRoute } from 'astro';
import { query, queryOne, withTx, dbReady } from '../../../../lib/db';
import { json, requireCapability, writeAudit } from '../../../../lib/cms/helpers';
import { purgeCacheTags } from '../../../../lib/cache';

export const prerender = false;

const SEO_FIELDS = [
  'seo_title', 'meta_description', 'canonical_url', 'robots',
  'focus_keyword', 'secondary_keywords', 'og_title', 'og_description',
  'twitter_card', 'breadcrumb_title',
];

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const id = ctx.params.id ?? '';
  try {
    const data = await queryOne(
      `select p.*,
              (select to_jsonb(seo) from public.page_seo seo where seo.page_id = p.id) as page_seo
         from public.pages p where p.id = $1`,
      [id],
    );
    if (!data) return json({ error: 'not_found' }, 404);
    return json(data);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const PATCH: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.edit');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const id = ctx.params.id ?? '';

  const before = await queryOne<{ slug: string }>(`select slug from public.pages where id = $1`, [id]);
  if (!before) return json({ error: 'not_found' }, 404);

  try {
    const updated = await withTx(async (q) => {
      const pagePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) pagePatch.title = String(body.title).slice(0, 120);
      if (body.status !== undefined && ['draft', 'scheduled', 'published', 'archived'].includes(String(body.status))) {
        pagePatch.status = String(body.status);
      }
      const keys = Object.keys(pagePatch);
      const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const pages = await q(
        `update public.pages set ${set} where id = $${keys.length + 1} returning *`,
        [...keys.map((k) => pagePatch[k]), id],
      );

      if (body.seo && typeof body.seo === 'object') {
        const seo = body.seo as Record<string, unknown>;
        const clean: Record<string, unknown> = {};
        for (const f of SEO_FIELDS) if (seo[f] !== undefined) clean[f] = seo[f];
        if (Object.keys(clean).length > 0) {
          const skeys = Object.keys(clean);
          const sset = skeys.map((k, i) => `${k} = $${i + 2}`).join(', ');
          await q(
            `insert into public.page_seo (page_id, ${skeys.join(', ')})
             values ($1, ${skeys.map((_, i) => `$${i + 2}`).join(', ')})
             on conflict (page_id) do update set ${sset}`,
            [id, ...skeys.map((k) => clean[k])],
          );
        }
      }
      return pages[0];
    });

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'update',
      entity: 'page',
      entity_id: id,
      summary: `Updated page ${before.slug}`,
      ip: ctx.clientAddress,
    });
    await purgeCacheTags(['page', before.slug]);
    return json(updated);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.delete');
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  const before = await queryOne<{ slug: string }>(`select slug from public.pages where id = $1`, [id]);
  if (!before) return json({ error: 'not_found' }, 404);

  try {
    await query(`update public.pages set deleted_at = $1 where id = $2`, [new Date().toISOString(), id]);
    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'delete',
      entity: 'page',
      entity_id: id,
      summary: `Deleted page ${before.slug}`,
      ip: ctx.clientAddress,
    });
    await purgeCacheTags(['page', before.slug]);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
