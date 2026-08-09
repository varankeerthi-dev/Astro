// Generic CRUD core used by /api/admin/* endpoints. Every mutation writes an
// audit entry, snapshots versions (where enabled), and purges CDN tags so
// publishes go live without redeploys. Status transitions are the only path
// that changes status — gate-kept by role capability.
//
// The SET clauses are built from the table's actual columns (cached from
// information_schema), so entities with no updated_at/updated_by (release
// notes, feature releases) work without per-config special-casing.
//
// NOTE: route handlers that pre-read the request body (e.g. to detect a
// `reorder` or `status` action) MUST pass the parsed body through as the
// last argument — a Request body can only be read once.
import type { APIContext } from 'astro';
import { query, queryOne, safeIdent } from '../db';
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

/** Read a JSON body once (or reuse a pre-parsed one). */
async function readBody(ctx: APIContext, pre?: Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  if (pre !== undefined) return pre;
  try {
    return (await ctx.request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── per-table column cache ───────────────────────────────────────────────────
const columnsCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  const hit = columnsCache.get(table);
  if (hit) return hit;
  const rows = await query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [table],
  );
  const set = new Set(rows.map((r) => r.column_name));
  columnsCache.set(table, set);
  return set;
}

/** Build `col = $n, …` and params for a patch (caller filters to real columns). */
async function buildSet(patch: Record<string, unknown>): Promise<{ set: string; params: unknown[] }> {
  const set: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const ident = safeIdent(k);
    params.push(v);
    set.push(`${ident} = $${params.length}`);
  }
  return { set: set.join(', '), params };
}

/** Single statement with only the columns that actually exist on the table. */
async function applyPatch(table: string, patch: Record<string, unknown>, id: string): Promise<Row | null> {
  const cols = await tableColumns(table);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (cols.has(k)) clean[k] = v;
  if (Object.keys(clean).length === 0) return null;
  const { set, params } = await buildSet(clean);
  params.push(id);
  const rows = await query<Row>(
    `update public.${safeIdent(table)} set ${set} where id = $${params.length} returning *`,
    params,
  );
  return rows[0] ?? null;
}

type Row = Record<string, unknown>;

export async function crudList(ctx: APIContext, cfg: CrudConfig): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capEdit ?? DEF.capEdit);
  if (denied) return denied;

  const url = new URL(ctx.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '25', 10) || 25));

  const table = safeIdent(cfg.entity);
  const where: string[] = ['deleted_at is null'];
  const params: unknown[] = [];
  if (q) {
    const ors = cfg.searchFields.map((f, i) => `${safeIdent(f)} ilike $${params.length + i + 1}`);
    params.push(...cfg.searchFields.map(() => `%${q}%`));
    where.push(`(${ors.join(' or ')})`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const whereSql = where.join(' and ');

  const countRow = await queryOne<{ n: string }>(
    `select count(*) as n from public.${table} where ${whereSql}`,
    params,
  );
  const total = Number(countRow?.n ?? 0);

  const orderCol = safeIdent(cfg.defaultOrder.column);
  const order = cfg.defaultOrder.ascending ?? true;
  params.push(perPage, (page - 1) * perPage);
  const rows = await query<Row>(
    `select ${cfg.select ?? '*'} from public.${table}
      where ${whereSql}
      order by ${orderCol} ${order ? 'asc' : 'desc'}
      limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return json({ rows, total, page, perPage });
}

export async function crudCreate(ctx: APIContext, cfg: CrudConfig, bodyArg?: Record<string, unknown> | null): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capCreate ?? DEF.capCreate);
  if (denied) return denied;

  const body = await readBody(ctx, bodyArg);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const row = { ...pick(body, cfg.editable), status: 'draft' };
  const extra = cfg.onSave ? cfg.onSave(row, body) : {};
  const merged = { ...row, ...extra };
  const cols = await tableColumns(cfg.entity);
  const insert: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) if (cols.has(k)) insert[k] = v;

  const keys = Object.keys(insert);
  const { set, params } = await buildSet(insert);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  let data: Row;
  try {
    const rows = await query<Row>(
      `insert into public.${safeIdent(cfg.entity)} (${keys.join(', ')}) values (${placeholders}) returning *`,
      params,
    );
    data = rows[0];
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

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

  const data = await queryOne<Row>(
    `select ${cfg.select ?? '*'} from public.${safeIdent(cfg.entity)} where id = $1`,
    [id],
  );
  if (!data) return json({ error: 'not_found' }, 404);
  return json(data);
}

export async function crudUpdate(ctx: APIContext, cfg: CrudConfig, id: string, bodyArg?: Record<string, unknown> | null): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capEdit ?? DEF.capEdit);
  if (denied) return denied;

  const body = await readBody(ctx, bodyArg);
  if (!body) return json({ error: 'invalid_json' }, 400);

  const before = await queryOne<Row>(`select * from public.${safeIdent(cfg.entity)} where id = $1`, [id]);
  if (!before) return json({ error: 'not_found' }, 404);

  const patch = pick(body, cfg.editable);
  const extra = cfg.onSave ? cfg.onSave(before, body) : {};
  const merged: Record<string, unknown> = { ...patch, ...extra };
  merged.updated_by = ctx.locals.profile?.id ?? null;
  merged.updated_at = new Date().toISOString();

  const data = await applyPatch(cfg.entity, merged, id);
  if (!data) return json({ error: 'not_found' }, 404);

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
}

export async function crudSoftDelete(ctx: APIContext, cfg: CrudConfig, id: string): Promise<Response> {
  const denied = requireCapability(PROFILE(ctx), cfg.capDelete ?? DEF.capDelete);
  if (denied) return denied;

  const before = await queryOne<Row>(`select * from public.${safeIdent(cfg.entity)} where id = $1`, [id]);
  if (!before) return json({ error: 'not_found' }, 404);

  const patch: Record<string, unknown> = { deleted_at: new Date().toISOString() };
  const cols = await tableColumns(cfg.entity);
  if (cols.has('updated_by')) patch.updated_by = ctx.locals.profile?.id ?? null;
  await applyPatch(cfg.entity, patch, id);

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

  const src = await queryOne<Row>(`select * from public.${safeIdent(cfg.entity)} where id = $1`, [id]);
  if (!src) return json({ error: 'not_found' }, 404);

  const row = pick(src, cfg.duplicateFields ?? cfg.editable);
  row.status = 'draft';
  delete row.publish_at;
  delete row.unpublish_at;
  if (cfg.titleField && typeof row[cfg.titleField] === 'string') {
    row[cfg.titleField] = `${row[cfg.titleField]} (copy)`;
  }
  const cols = await tableColumns(cfg.entity);
  const insert: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (cols.has(k)) insert[k] = v;

  const keys = Object.keys(insert);
  const { set, params } = await buildSet(insert);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  let data: Row;
  try {
    const rows = await query<Row>(
      `insert into public.${safeIdent(cfg.entity)} (${keys.join(', ')}) values (${placeholders}) returning *`,
      params,
    );
    data = rows[0];
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

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
export async function crudStatus(ctx: APIContext, cfg: CrudConfig, id: string, bodyArg?: Record<string, unknown> | null): Promise<Response> {
  const body = await readBody(ctx, bodyArg);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const action = String(body.action ?? '');

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

  const before = await queryOne<Row>(`select * from public.${safeIdent(cfg.entity)} where id = $1`, [id]);
  if (!before) return json({ error: 'not_found' }, 404);

  const patch: Record<string, unknown> = { status: statuses[action] };
  const cols = await tableColumns(cfg.entity);
  if (cols.has('updated_by')) patch.updated_by = ctx.locals.profile?.id ?? null;
  if (cols.has('updated_at')) patch.updated_at = new Date().toISOString();
  if (action === 'schedule') {
    if (!body.at) return json({ error: 'missing_at' }, 400);
    patch.publish_at = body.at;
  }
  if (action === 'publish' && cols.has('publish_at')) patch.publish_at = patch.publish_at ?? new Date().toISOString();

  const data = await applyPatch(cfg.entity, patch, id);
  if (!data) return json({ error: 'not_found' }, 404);

  if (cfg.versionable) {
    await snapshotVersion(cfg.entity, id, data, action === 'publish' ? 'publish' : 'manual', ctx.locals.profile?.id);
  }
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
    await applyPatch(cfg.entity, { display_order: i }, ids[i]);
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
