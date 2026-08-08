// Shared server-side helpers: JSON responses, capability checks, audit log,
// version snapshots.
import { supabaseAdmin } from '../supabase/admin';
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
    await supabaseAdmin.from('audit_log').insert({
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      summary: entry.summary ?? null,
      diff: entry.diff ?? null,
      ip: entry.ip ?? null,
    });
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
    const { data } = await supabaseAdmin
      .from('content_versions')
      .select('version')
      .eq('entity', entity)
      .eq('entity_id', entityId)
      .order('version', { ascending: false })
      .limit(1);
    const next = ((data?.[0]?.version as number | undefined) ?? 0) + 1;
    await supabaseAdmin.from('content_versions').insert({
      entity,
      entity_id: entityId,
      version: next,
      kind,
      snapshot,
      created_by: actorId ?? null,
    });
  } catch {
    // best effort
  }
}
