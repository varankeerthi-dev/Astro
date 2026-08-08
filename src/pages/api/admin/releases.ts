import type { APIRoute } from 'astro';
import { crudCreate, crudList, type CrudConfig } from '../../../lib/cms/crud';
import { featureReleaseCfg, releaseNotesCfg } from '../../../lib/cms/configs';
import { json } from '../../../lib/cms/helpers';

export const prerender = false;

export const GET: APIRoute = (ctx) => {
  const kind = ctx.url.searchParams.get('kind') ?? 'release';
  const cfg: CrudConfig = kind === 'note' ? releaseNotesCfg : featureReleaseCfg;
  return crudList(ctx, cfg);
};

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => null);
  const kind = body?.kind === 'note' ? 'note' : 'release';
  const cfg: CrudConfig = kind === 'note' ? releaseNotesCfg : featureReleaseCfg;
  if (kind === 'note') {
    // release notes are published directly by the feature-release flow; keep drafts here
    return crudCreate(ctx, cfg);
  }
  // feature releases: destinations live in the composer (releases/[id].astro)
  return crudCreate(ctx, cfg);
};
