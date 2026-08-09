import type { APIRoute } from 'astro';
import { crudGet, crudSoftDelete, crudStatus, type CrudConfig } from '../../../../lib/cms/crud';
import { locationCfg } from '../../../../lib/cms/configs';
import { articleDuplicate, articleUpdate } from '../../../../lib/cms/article-crud';
import { json } from '../../../../lib/cms/helpers';

export const prerender = false;

const cfg: CrudConfig = locationCfg;

export const GET: APIRoute = (ctx) => crudGet(ctx, cfg, ctx.params.id ?? '');
export const PATCH: APIRoute = (ctx) => articleUpdate(ctx, cfg, ctx.params.id ?? '');
export const DELETE: APIRoute = (ctx) => crudSoftDelete(ctx, cfg, ctx.params.id ?? '');

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => null);
  const id = ctx.params.id ?? '';
  if (body && ['submit','schedule','publish','unpublish','archive','restore'].includes(body.action)) return crudStatus(ctx, cfg, id, body);
  if (body && body.action === 'duplicate') return articleDuplicate(ctx, cfg, id);
  return json({ error: 'unknown_action' }, 400);
};
