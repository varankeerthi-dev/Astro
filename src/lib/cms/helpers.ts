// Shared server-side helpers: JSON responses, capability checks, audit log,
// version snapshots.
import { query, queryOne, execute } from '../db';
import { can, type Capability, type Role } from '../auth/permissions';

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export function requireCapability(profile: { role: Role } | undefined, cap: Capability): Response | null {
  if (!profile || !can(profile.role, cap)) return json({ error: 'forbidden' }, 403);
  return null;
}

export async function writeAudit(entry: {
  actor_id?: string;
  action: string;
  entity: string;
  entity_id?: string;
  summary?: string;
  diff?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    await execute(
      `insert into public.audit_log (actor_id, action, entity, entity_id, summary, diff, ip)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actor_id ?? null,
        entry.action,
        entry.entity,
        entry.entity_id ?? null,
        entry.summary ?? null,
        entry.diff != null ? JSON.stringify(entry.diff) : null,
        entry.ip ?? null,
      ],
    );
  } catch {
    // auditing is best-effort — never fail the main write because of it
  }
}

export async function snapshotVersion(
  entity: string,
  entityId: string,
  snapshot: unknown,
  kind = 'manual',
  actorId?: string,
): Promise<void> {
  try {
    const row = await queryOne<{ version: number }>(
      `select version from public.content_versions
        where entity = $1 and entity_id = $2
        order by version desc limit 1`,
      [entity, entityId],
    );
    const next = (row?.version ?? 0) + 1;
    await execute(
      `insert into public.content_versions (entity, entity_id, version, kind, snapshot, created_by)
       values ($1, $2, $3, $4, $5, $6)`,
      [entity, entityId, next, kind, JSON.stringify(snapshot), actorId ?? null],
    );
  } catch {
    // best effort
  }
}
