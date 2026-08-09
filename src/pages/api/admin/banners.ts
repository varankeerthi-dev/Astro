import type { APIRoute } from 'astro';
import { crudCreate, crudList, crudReorder, type CrudConfig } from '../../../lib/cms/crud';
import { bannersCfg } from '../../../lib/cms/configs';

export const prerender = false;

const cfg: CrudConfig = bannersCfg;

export const GET: APIRoute = (ctx) => crudList(ctx, cfg);

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => null);
  if (body && body.action === 'reorder') {
    return crudReorder(ctx, cfg, Array.isArray(body.ids) ? (body.ids as string[]) : []);
  }
  return crudCreate(ctx, cfg, body);
};
