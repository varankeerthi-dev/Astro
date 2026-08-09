import type { APIRoute } from 'astro';
import { query, dbReady } from '../../../../lib/db';
import { json, requireCapability } from '../../../../lib/cms/helpers';
import { slugify } from '../../../../lib/utils/slug';

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);
  try {
    const rows = await query(
      `select id, name, slug, kind, module, palette_key, display_order
         from public.kb_categories order by display_order`,
    );
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
      `insert into public.kb_categories (name, slug, kind, module, palette_key, display_order)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [
        name,
        slugify(name),
        body?.kind ?? 'user_guide',
        body?.module ? String(body.module) : null,
        body?.palette_key ?? 'blue',
        parseInt(body?.display_order ?? '0', 10) || 0,
      ],
    );
    return json(rows[0], 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
