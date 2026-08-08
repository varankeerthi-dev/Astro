// GET /api/cron/publish-due — flips due scheduled → published and closes
// expired publish windows. Read-time window evaluation keeps the public site
// correct even between cron runs; this only does bookkeeping + cache purge.
// Trigger: Vercel Cron (every 5 min) or any scheduler calling with the
// CRON_SECRET bearer token.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { json, writeAudit } from '../../../lib/cms/helpers';
import { purgeCacheTags } from '../../../lib/cache';

export const prerender = false;

const TABLES: { t: string; tags: string[]; window: boolean }[] = [
  { t: 'banners', tags: ['banners', 'home'], window: true },
  { t: 'announcements', tags: ['announcements', 'home', 'pricing', 'help'], window: true },
  { t: 'blog_posts', tags: ['blog'], window: false },
  { t: 'kb_articles', tags: ['help'], window: false },
  { t: 'location_pages', tags: ['locations'], window: false },
  { t: 'feature_releases', tags: ['home', 'announcements', 'banners', 'help'], window: false },
  { t: 'release_notes', tags: ['help'], window: false },
];

export const GET: APIRoute = async ({ request, clientAddress }) => {
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const bearer = request.headers.get('authorization') ?? '';
  const cronSecret = import.meta.env.CRON_SECRET as string | undefined;
  const authed = isVercelCron || (cronSecret ? bearer === `Bearer ${cronSecret}` : false);
  if (!authed) return json({ error: 'forbidden' }, 403);

  const now = new Date().toISOString();
  const published: Record<string, number> = {};
  const expired: Record<string, number> = {};
  const tags = new Set<string>();

  for (const { t, tags: tableTags, window } of TABLES) {
    const { data: due, error } = await supabaseAdmin
      .from(t)
      .update({ status: 'published' })
      .eq('status', 'scheduled')
      .lte('publish_at', now)
      .select('id');
    published[t] = due?.length ?? 0;
    if (error) published[t] = -1;

    if (window) {
      const { data: gone } = await supabaseAdmin
        .from(t)
        .update({ status: 'archived' })
        .eq('status', 'published')
        .lte('unpublish_at', now)
        .select('id');
      expired[t] = gone?.length ?? 0;
    }
    for (const tag of tableTags) tags.add(tag);
  }

  await writeAudit({
    action: 'publish',
    entity: 'cron',
    summary: `publish-due run — published: ${JSON.stringify(published)}, expired: ${JSON.stringify(expired)}`,
    ip: clientAddress,
  });
  await purgeCacheTags([...tags]);

  return json({ ok: true, published, expired });
};
