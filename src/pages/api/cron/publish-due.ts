// GET /api/cron/publish-due — flips due scheduled → published and closes
// expired publish windows. Read-time window evaluation keeps the public site
// correct even between cron runs; this only does bookkeeping + cache purge.
// Trigger: Vercel Cron (every 5 min) or any scheduler calling with the
// CRON_SECRET bearer token. Also purges expired sessions.
import type { APIRoute } from 'astro';
import { query, execute, dbReady } from '../../../lib/db';
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
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  const now = new Date().toISOString();
  const published: Record<string, number> = {};
  const expired: Record<string, number> = {};
  const tags = new Set<string>();

  for (const { t, tags: tableTags, window } of TABLES) {
    try {
      const due = await query(
        `update public.${t} set status = 'published'
          where status = 'scheduled' and publish_at <= $1
          returning id`,
        [now],
      );
      published[t] = due.length;

      if (window) {
        const gone = await query(
          `update public.${t} set status = 'archived'
            where status = 'published' and unpublish_at <= $1
            returning id`,
          [now],
        );
        expired[t] = gone.length;
      }
    } catch {
      published[t] = -1;
    }
    for (const tag of tableTags) tags.add(tag);
  }

  try {
    await execute(`delete from public.sessions where expires_at <= now()`);
  } catch {
    /* best effort */
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
