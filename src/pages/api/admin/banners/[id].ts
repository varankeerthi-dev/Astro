import type { APIRoute } from 'astro';
import { crudDuplicate, crudGet, crudSoftDelete, crudStatus, crudUpdate, type CrudConfig } from '../../../../lib/cms/crud';
import { bannersCfg } from '../../../../lib/cms/configs';
import { json } from '../../../../lib/cms/helpers';

export const prerender = false;

const cfg: CrudConfig = bannersCfg;

export const GET: APIRoute = (ctx) => crudGet(ctx, cfg, ctx.params.id ?? '');
export const PATCH: APIRoute = (ctx) => crudUpdate(ctx, cfg, ctx.params.id ?? '');
export const DELETE: APIRoute = (ctx) => crudSoftDelete(ctx, cfg, ctx.params.id ?? '');

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => null);
  const id = ctx.params.id ?? '';
  if (body && ['submit','schedule','publish','unpublish','archive','restore'].includes(body.action)) return crudStatus(ctx, cfg, id);
  if (body && body.action === 'duplicate') return crudDuplicate(ctx, cfg, id);
  return json({ error: 'unknown_action' }, 400);
};
