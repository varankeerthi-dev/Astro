import type { APIRoute } from 'astro';
import { crudGet, crudSoftDelete, crudStatus, crudUpdate, type CrudConfig } from '../../../../lib/cms/crud';
import { featureReleaseCfg, releaseNotesCfg } from '../../../../lib/cms/configs';
import { json, writeAudit } from '../../../../lib/cms/helpers';
import { queryOne, query, dbReady } from '../../../../lib/db';
import { purgeCacheTags } from '../../../../lib/cache';

export const prerender = false;

const cfgFor = (kind: string): CrudConfig => (kind === 'note' ? releaseNotesCfg : featureReleaseCfg);

export const GET: APIRoute = (ctx) => {
  const kind = ctx.url.searchParams.get('kind') ?? 'release';
  return crudGet(ctx, cfgFor(kind), ctx.params.id ?? '');
};

export const PATCH: APIRoute = (ctx) => {
  const kind = ctx.url.searchParams.get('kind') ?? 'release';
  return crudUpdate(ctx, cfgFor(kind), ctx.params.id ?? '');
};

export const DELETE: APIRoute = (ctx) => {
  const kind = ctx.url.searchParams.get('kind') ?? 'release';
  return crudSoftDelete(ctx, cfgFor(kind), ctx.params.id ?? '');
};

export const POST: APIRoute = async (ctx) => {
  const kind = ctx.url.searchParams.get('kind') ?? 'release';
  const cfg = cfgFor(kind);
  const body = await ctx.request.json().catch(() => null);
  const id = ctx.params.id ?? '';

  if (body && ['submit', 'schedule', 'publish', 'unpublish', 'archive', 'restore'].includes(body.action)) {
    const res = await crudStatus(ctx, cfg, id, body);
    if (res.status !== 200) return res;
    if (kind === 'release') {
      await fanOut(ctx, id);
    }
    return res;
  }
  return json({ error: 'unknown_action' }, 400);
};

/** After a feature release goes live: publish linked destinations + ERP webhook. */
async function fanOut(ctx: { locals: { profile?: { id?: string } }; clientAddress: string }, releaseId: string): Promise<void> {
  if (!dbReady) return;
  const release = await queryOne<Record<string, unknown>>(
    `select * from public.feature_releases where id = $1`,
    [releaseId],
  );
  if (!release) return;

  const now = new Date().toISOString();
  const actorId = ctx.locals.profile?.id;

  if (release.dest_release_notes && release.release_note_id) {
    await query(
      `update public.release_notes set status = 'published', released_on = $1 where id = $2`,
      [release.released_on ?? now.slice(0, 10), release.release_note_id],
    );
  }
  if (release.dest_announcement && release.announcement_id) {
    await query(
      `update public.announcements set status = 'published', publish_at = $1 where id = $2`,
      [now, release.announcement_id],
    );
  }
  if (release.dest_banner && release.banner_id) {
    await query(
      `update public.banners set status = 'published', publish_at = $1 where id = $2`,
      [now, release.banner_id],
    );
  }

  // ERP integration (badge / in-app notification) — HMAC-signed webhook.
  const erpBase = import.meta.env.ERP_BASE_URL as string | undefined;
  const erpSecret = import.meta.env.ERP_WEBHOOK_SECRET as string | undefined;
  if ((release.dest_erp_badge || release.dest_inapp_notification) && erpBase && erpSecret) {
    const payload = JSON.stringify({
      type: release.dest_erp_badge ? 'badge' : 'notification',
      title: release.title,
      summary: release.summary ?? '',
      url: `/help/release-notes`,
      publishAt: now,
    });
    try {
      const { createHmac } = await import('node:crypto');
      const sig = createHmac('sha256', erpSecret).update(payload).digest('hex');
      await fetch(`${erpBase.replace(/\/$/, '')}/api/integrations/marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BillFast-Signature': sig },
        body: payload,
      });
    } catch {
      // ERP unreachable — audit row records the attempt
    }
  }

  await writeAudit({
    actor_id: actorId,
    action: 'publish',
    entity: 'feature release',
    entity_id: releaseId,
    summary: `Fan-out for "${release.title}" (destinations: ${[
      release.dest_help_article && 'KB',
      release.dest_release_notes && 'release notes',
      release.dest_erp_badge && 'ERP badge',
      release.dest_announcement && 'announcement',
      release.dest_banner && 'banner',
      release.dest_inapp_notification && 'in-app notification',
    ].filter(Boolean).join(', ') || 'none'})`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(['home', 'announcements', 'banners', 'help']);
}
