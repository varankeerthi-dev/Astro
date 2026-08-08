import type { APIRoute } from 'astro';
import { crudList, type CrudConfig } from '../../../lib/cms/crud';
import { locationCfg } from '../../../lib/cms/configs';
import { articleCreate } from '../../../lib/cms/article-crud';
import { slugify } from '../../../lib/utils/slug';

export const prerender = false;

const cfg: CrudConfig = locationCfg;

export const GET: APIRoute = (ctx) => crudList(ctx, cfg);

export const POST: APIRoute = (ctx) =>
  articleCreate(ctx, cfg, {
    pageType: 'location',
    slugPrefix: '/locations/',
    slugFrom: (body) => `/locations/${slugify(`${String(body.city ?? '')}-${String(body.state ?? '')}`)}`,
  });
