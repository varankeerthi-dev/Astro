import type { APIRoute } from 'astro';
import { query, dbReady } from '../../../../lib/db';
import { json, requireCapability } from '../../../../lib/cms/helpers';
import { slugify } from '../../../../lib/utils/slug';

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);
  try {
    const rows = await query(`select id, name, slug from public.blog_tags order by name`);
    return json(rows);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'content.create');
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return json({ error: 'name_required' }, 400);
  try {
    const rows = await query(
      `insert into public.blog_tags (name, slug) values ($1, $2) returning *`,
      [name, slugify(name)],
    );
    return json(rows[0], 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
