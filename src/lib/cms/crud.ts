// Generic CRUD core used by /api/admin/* endpoints. Every mutation writes an
// audit entry, snapshots versions (where enabled), and purges CDN tags so
// publishes go live without redeploys. Status transitions are the only path
// that changes status — gate-kept by role capability.
import type { APIContext } from 'astro';
import { supabaseAdmin } from '../supabase/admin';
import { json, requireCapability, snapshotVersion, writeAudit } from './helpers';
import { purgeCacheTags } from '../cache';
import type { Capability, Role } from '../auth/permissions';

export interface CrudConfig {
  /** table name */
  entity: string;
  /** human label, e.g. 'banner' */
  label: string;
  searchFields: string[];
  defaultOrder: { column: string; ascending?: boolean };
  /** PATCH whitelist (columns that may be written by editors) */
  editable: string[];
  /** optional columns to refresh on save (e.g. toc, reading_time_min) */
  onSave?: (row: Record<string, unknown>, body: Record<string, unknown>) => Record<string, unknown>;
  select?: string;
  versionable?: boolean;
  cacheTags: string[];
  /** columns that must be copied on duplicate (defaults to editable) */
  duplicateFields?: string[];
  /** title column for the " (copy)" suffix */
  titleField?: string;
  capCreate?: Capability;
  capEdit?: Capability;
  capDelete?: Capability;
  capPublish?: Capability;
}

const DEF: Pick<CrudConfig, 'capCreate' | 'capEdit' | 'capDelete' | 'capPublish'> = {
  capCreate: 'content.create',
  capEdit: 'content.edit',
  capDelete: 'content.delete',
  capPublish: 'content.publish',
};

function pick(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
}

const PROFILE = (ctx: APIContext): { role: Role } | undefined => ctx.locals.profile;

export async function crudList(ctx: APIContext, cfg: CrudConfig): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capEdit ?? DEF.capEdit);
  if (denied) return denied;

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '25', 10) || 25));

  let query = supabaseAdmin
    .from(cfg.entity)
    .select(cfg.select ?? '*', { count: 'exact' })
    .is('deleted_at', null)
    .order(cfg.defaultOrder.column, { ascending: cfg.defaultOrder.ascending ?? true });

  if (q) {
    const orParts = cfg.searchFields.map((f) => `${f}.ilike.%${q}%`);
    query = query.or(orParts.join(','));
  }
  if (status) query = query.eq('status', status);
  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data ?? [], total: count ?? 0, page, perPage });
}

export async function crudCreate(ctx: APIContext, cfg: CrudConfig): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capCreate ?? DEF.capCreate);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await ctx.request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const row = { ...pick(body, cfg.editable), status: 'draft' };
  const extra = cfg.onSave ? cfg.onSave(row, body) : {};
  const { data, error } = await supabaseAdmin
    .from(cfg.entity)
    .insert({ ...row, ...extra })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'create',
    entity: cfg.label,
    entity_id: data.id as string,
    summary: `Created ${cfg.label}`,
    ip: ctx.clientAddress,
  });
  return json(data, 201);
}

export async function crudGet(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capEdit ?? DEF.capEdit);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from(cfg.entity)
    .select(cfg.select ?? '*')
    .eq('id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'not_found' }, 404);
  return json(data);
}

export async function crudUpdate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capEdit ?? DEF.capEdit);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await ctx.request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { data: before } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);

  const patch = pick(body, cfg.editable);
  const extra = cfg.onSave ? cfg.onSave(before as Record<string, unknown>, body) : {};
  const { data, error } = await supabaseAdmin
    .from(cfg.entity)
    .update({ ...patch, ...extra, updated_by: ctx.locals.profile?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);

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

export async function crudSoftDelete(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capDelete ?? DEF.capDelete);
  if (denied) return denied;

  const { data: before } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);

  const { error } = await supabaseAdmin
    .from(cfg.entity)
    .update({ deleted_at: new Date().toISOString(), updated_by: ctx.locals.profile?.id ?? null })
    .eq('id', id);
  if (error) return json({ error: error.message }, 500);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'delete',
    entity: cfg.label,
    entity_id: id,
    summary: `Deleted ${cfg.label}`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(cfg.cacheTags);
  return json({ ok: true });
}

export async function crudDuplicate(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), 'content.duplicate');
  if (denied) return denied;

  const { data: src } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!src) return json({ error: 'not_found' }, 404);

  const row = pick(src as Record<string, unknown>, cfg.duplicateFields ?? cfg.editable);
  row.status = 'draft';
  delete row.publish_at;
  delete row.unpublish_at;
  if (cfg.titleField && typeof row[cfg.titleField] === 'string') {
    row[cfg.titleField] = `${row[cfg.titleField]} (copy)`;
  }
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

/** status transitions — the only code path allowed to change status */
export async function crudStatus(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  let body: { action?: string; at?: string };
  try {
    body = (await ctx.request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const action = body.action ?? '';

  const PUBLISH_ACTIONS = new Set(['schedule', 'publish', 'unpublish', 'archive', 'restore']);
  const cap: Capability = PUBLISH_ACTIONS.has(action) ? (cfg.capPublish ?? DEF.capPublish) : 'content.create';
  const denied = requireCapability(PROFILE(ctx), cap);
  if (denied) return denied;

  const statuses: Record<string, string> = {
    submit: 'draft',
    schedule: 'scheduled',
    publish: 'published',
    unpublish: 'draft',
    archive: 'archived',
    restore: 'draft',
  };
  if (!(action in statuses)) return json({ error: 'unknown_action' }, 400);

  const { data: before } = await supabaseAdmin.from(cfg.entity).select('*').eq('id', id).maybeSingle();
  if (!before) return json({ error: 'not_found' }, 404);

  const patch: Record<string, unknown> = { status: statuses[action], updated_by: ctx.locals.profile?.id ?? null, updated_at: new Date().toISOString() };
  if (action === 'schedule') {
    if (!body.at) return json({ error: 'missing_at' }, 400);
    patch.publish_at = body.at;
  }
  if (action === 'publish') patch.publish_at = patch.publish_at ?? new Date().toISOString();

  const { data, error } = await supabaseAdmin.from(cfg.entity).update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);

  if (cfg.versionable) await snapshotVersion(cfg.entity, id, data, action === 'publish' ? 'publish' : 'manual', ctx.locals.profile?.id);
  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action,
    entity: cfg.label,
    entity_id: id,
    summary: `${action}: ${cfg.label}`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(cfg.cacheTags);
  return json(data);
}

/** bulk display-order persistence for drag & drop */
export async function crudReorder(ctx: APIContext, cfg: CrudConfig, ids: string[]): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), 'content.reorder');
  if (denied) return denied;

  for (let i = 0; i < ids.length; i++) {
    await supabaseAdmin
      .from(cfg.entity)
      .update({ display_order: i, updated_by: ctx.locals.profile?.id ?? null })
      .eq('id', ids[i]);
  }
  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'reorder',
    entity: cfg.label,
    summary: `Reordered ${cfg.label}s`,
    ip: ctx.clientAddress,
  });
  await purgeCacheTags(cfg.cacheTags);
  return json({ ok: true });
}
