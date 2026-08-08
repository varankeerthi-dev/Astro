import type { APIRoute } from 'astro';
import { crudList, type CrudConfig } from '../../../lib/cms/crud';
import { kbCfg } from '../../../lib/cms/configs';
import { articleCreate } from '../../../lib/cms/article-crud';
import { slugify } from '../../../lib/utils/slug';

export const prerender = false;

const cfg: CrudConfig = kbCfg;

export const GET: APIRoute = (ctx) => crudList(ctx, cfg);

export const POST: APIRoute = (ctx) =>
  articleCreate(ctx, cfg, {
    pageType: 'help',
    slugPrefix: '/help/',
    slugFrom: (body) => `/help/${slugify(String(body.title ?? 'untitled'))}`,
  });
