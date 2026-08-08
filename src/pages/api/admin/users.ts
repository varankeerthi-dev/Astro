import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { json, requireCapability, writeAudit } from '../../../lib/cms/helpers';

export const prerender = false;

const ROLES = ['marketing_editor', 'publisher', 'administrator'];

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return json({ error: error.message }, 500);

  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, role, full_name');
  const roleById = new Map<string, string>();
  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) {
    roleById.set(String(p.id), String(p.role));
    nameById.set(String(p.id), String(p.full_name ?? ''));
  }

  const rows = (users?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: (u.user_metadata?.full_name as string | undefined) ?? nameById.get(u.id) ?? '',
    role: roleById.get(u.id) ?? 'marketing_editor',
    created_at: u.created_at,
  }));
  return json({ rows });
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');
  const role = String(body?.role ?? 'marketing_editor');
  if (!email || password.length < 8) return json({ error: 'email_and_password_required', message: 'A password of at least 8 characters is required.' }, 400);
  if (!ROLES.includes(role)) return json({ error: 'invalid_role' }, 400);
  const fullName = String(body?.full_name ?? '').trim();

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (error) return json({ error: error.message }, 400);
  if (!created.user) return json({ error: 'create_failed' }, 500);

  if (role !== 'marketing_editor') {
    await supabaseAdmin.from('profiles').update({ role, full_name: fullName || undefined }).eq('id', created.user.id);
  }

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'create',
    entity: 'user',
    entity_id: created.user.id,
    summary: `Invited ${email} as ${role}`,
    ip: ctx.clientAddress,
  });
  return json({ id: created.user.id, email, role }, 201);
};

export const PATCH: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const role = String(body?.role ?? '');
  if (!id || !ROLES.includes(role)) return json({ error: 'id_and_role_required' }, 400);

  const { data, error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);

  await writeAudit({
    actor_id: ctx.locals.profile?.id,
    action: 'update',
    entity: 'user',
    entity_id: id,
    summary: `Role changed to ${role}`,
    ip: ctx.clientAddress,
  });
  return json(data);
};
