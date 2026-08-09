import type { APIRoute } from 'astro';
import { query, queryOne, withTx, dbReady } from '../../../lib/db';
import { json, requireCapability, writeAudit } from '../../../lib/cms/helpers';
import { hashPassword } from '../../../lib/auth/passwords';

export const prerender = false;

const ROLES = ['marketing_editor', 'publisher', 'administrator'];

export const GET: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;
  if (!dbReady) return json({ error: 'database_not_configured' }, 503);

  try {
    const rows = await query(
      `select id, email, full_name, role, created_at
         from public.users
        order by created_at desc
        limit 200`,
    );
    return json({ rows });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

export const POST: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const role = String(body?.role ?? 'marketing_editor');
  if (!email || password.length < 8) {
    return json({ error: 'email_and_password_required', message: 'A password of at least 8 characters is required.' }, 400);
  }
  if (!ROLES.includes(role)) return json({ error: 'invalid_role' }, 400);
  const fullName = String(body?.full_name ?? '').trim();

  try {
    const created = await withTx(async (q) => {
      const users = await q(
        `insert into public.users (email, password_hash, full_name, role)
         values ($1, $2, $3, $4) returning *`,
        [email, hashPassword(password), fullName, role],
      );
      const user = users[0];
      await q(
        `insert into public.profiles (id, full_name, role)
         values ($1, $2, $3) on conflict (id) do update set full_name = excluded.full_name, role = excluded.role`,
        [user.id, fullName, role],
      );
      return user;
    });

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'create',
      entity: 'user',
      entity_id: created.id as string,
      summary: `Invited ${email} as ${role}`,
      ip: ctx.clientAddress,
    });
    return json({ id: created.id, email, role }, 201);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};

export const PATCH: APIRoute = async (ctx) => {
  const denied = requireCapability(ctx.locals.profile, 'users.manage');
  if (denied) return denied;

  const body = await ctx.request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const role = String(body?.role ?? '');
  if (!id || !ROLES.includes(role)) return json({ error: 'id_and_role_required' }, 400);

  try {
    const rows = await query(
      `update public.users set role = $1 where id = $2 returning *`,
      [role, id],
    );
    if (!rows[0]) return json({ error: 'not_found' }, 404);
    await query(`update public.profiles set role = $1 where id = $2`, [role, id]);

    await writeAudit({
      actor_id: ctx.locals.profile?.id,
      action: 'update',
      entity: 'user',
      entity_id: id,
      summary: `Role changed to ${role}`,
      ip: ctx.clientAddress,
    });
    return json(rows[0]);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
};
