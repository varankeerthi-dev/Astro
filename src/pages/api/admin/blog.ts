import type { APIRoute } from 'astro';
import { crudList, type CrudConfig } from '../../../lib/cms/crud';
import { blogCfg } from '../../../lib/cms/configs';
import { articleCreate } from '../../../lib/cms/article-crud';
import { slugify } from '../../../lib/utils/slug';

export const prerender = false;

const cfg: CrudConfig = blogCfg;

export const GET: APIRoute = (ctx) => crudList(ctx, cfg);

export const POST: APIRoute = (ctx) =>
  articleCreate(ctx, cfg, {
    pageType: 'blog',
    slugPrefix: '/blog/',
    slugFrom: (body) => `/blog/${slugify(String(body.title ?? 'untitled'))}`,
  });
