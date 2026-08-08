import type { APIRoute } from 'astro';
import { crudCreate, crudList, type CrudConfig } from '../../../lib/cms/crud';
import { announcementsCfg } from '../../../lib/cms/configs';

export const prerender = false;

const cfg: CrudConfig = announcementsCfg;

export const GET: APIRoute = (ctx) => crudList(ctx, cfg);
export const POST: APIRoute = (ctx) => crudCreate(ctx, cfg);
