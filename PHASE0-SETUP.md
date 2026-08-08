# BillFast CMS — Phase 0 (Foundation) patch

Ready-to-commit files implementing **Phase 0** of the approved technical design
(`BillFast-CMS-Technical-Design.md`, v1.1): Supabase schema + RLS, auth/roles,
audit log, version history, Website Settings, SEO component, hybrid-rendering
conversion, and the `/admin` shell.

**Decisions honored:** D1 — admin lives at `/admin` in this repo · D2 — hybrid SSR
via `@astrojs/vercel` with CDN caching · D3 — dedicated Supabase project (default;
revisit when the ERP stack is confirmed).

---

## 1. What's in this patch

```
supabase/
  migrations/0001_enums.sql           content_status, user_role, announcement_kind, kb_kind, difficulty
  migrations/0002_identity.sql        profiles (+ auto-create trigger), audit_log, content_versions
  migrations/0003_settings_media.sql  site_settings (singleton), media_folders/assets/usage
  migrations/0004_content.sql         banners, announcements
  migrations/0005_seo_pages.sql       pages registry + page_seo (duplicate-slug guard)
  migrations/0006_locations.sql       location_pages
  migrations/0007_blog.sql            blog categories/tags/posts
  migrations/0008_kb.sql              kb categories/articles (+ FTS), feedback, suggested edits,
                                      release_notes, feature_releases
  migrations/0009_navigation.sql      footer_links, redirects
  migrations/0010_rls.sql             Row Level Security for every table + storage buckets/policies
  seed.sql                            settings row, folders, footer links, KB categories,
                                      page registry + SEO for all current routes, legacy redirect map
src/
  lib/supabase/{client,server,admin}.ts
  lib/auth/{permissions,session}.ts   role→capability matrix, cookie session helpers
  lib/cms/settings.ts                 settings/footer-link reads with 60 s cache + graceful fallback
  middleware.ts                       /admin + /api/admin auth guard, preview flag, 404→redirect map
  components/seo/{Seo,JsonLd}.astro   canonical/robots/OG/Twitter/GSC/JSON-LD — fixes the audit gaps
  layouts/Layout.astro                EXTENDED (replaces current file): Seo + settings + footer links,
                                      mojibake "Â©" fixed; nav/footer markup otherwise unchanged
  layouts/AdminLayout.astro           /admin shell (sidebar marks later waves as disabled W1…W7)
  pages/robots.txt.ts                 CMS-driven robots.txt (fixes today's 404)
  pages/sitemap.xml.ts                DB-driven sitemap (replaces @astrojs/sitemap)
  pages/admin/{login,index,settings}.astro
  pages/api/admin/logout.ts
  env.d.ts                            Astro.locals typing
astro.config.mjs                      adds @astrojs/vercel adapter (drops @astrojs/sitemap — see §4)
.env.example                          every env var, documented
```

All SQL was validated against the real PostgreSQL grammar (libpg_query) before packaging.

## 2. Apply the patch

Copy the folders over your repo root, keeping the structure. Two files replace
existing ones — review the diffs first:

| Replaces | Why |
|---|---|
| `astro.config.mjs` | adds the Vercel adapter; removes `@astrojs/sitemap` (superseded by the dynamic endpoint) |
| `src/layouts/Layout.astro` | SEO component + settings/footer from CMS; identical markup otherwise |

```bash
npm install @supabase/supabase-js @astrojs/vercel
npm uninstall @astrojs/sitemap   # optional; harmless to keep installed
```

## 3. Create the Supabase project & run the schema

1. supabase.com → **New project** (e.g. `billfast-cms-prod`; add a `-staging` twin later).
2. **SQL Editor** → run each file in `supabase/migrations/` **in order** (0001 → 0010),
   then `supabase/seed.sql`. (Or `supabase link && supabase db push` if you use the CLI.)
3. **Authentication → Users → Add user** — create your account (email + password).
4. Promote it to administrator (SQL Editor):
   ```sql
   update public.profiles set role = 'administrator'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
5. Confirm **Storage** shows the `media` (public) and `media-private` buckets (created by 0010).

## 4. Environment variables

Locally: copy `.env.example` → `.env` and fill it in. In Vercel: Project → Settings →
Environment Variables (Production + Preview):

| Var | Where to find it |
|---|---|
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — **server-only, never commit** |
| `PREVIEW_SECRET` | any random 32+ char string |
| `PUBLIC_APP_URL` | already in your `.env` |

## 5. Verify (checklist)

1. `npm run dev` → the homepage renders **identically** to before (fallbacks work without env).
2. With env set: `/robots.txt` and `/sitemap.xml` respond (previously 404).
3. `/admin` redirects to `/admin/login`; signing in lands on the dashboard.
4. `/admin/settings`: change **Site name** → Save → within ~60 s the public nav shows it.
5. Supabase → `audit_log` has rows for your login and the settings save.
6. View source on `/`: canonical, robots, OG/Twitter tags now present.
7. Optional: re-run this project's SEO-audit notebook — Technical/Social scores should jump.

## 6. Included vs. stubbed (honest scope)

**Working end-to-end:** schema + RLS + seed, auth (login/logout/guard), role matrix,
audit log, settings editor, CMS-driven layout/robots/sitemap, redirect map (legacy
`.php` URLs → new targets, ready for the domain cutover).

**Stubbed for later waves** (sidebar shows them disabled): banners, announcements,
SEO manager UI, locations, blog, KB, media library UI, users admin, audit viewer UI,
preview-token endpoint, cache-tag purge on publish. The tables/RLS for all of these
already exist — each wave adds its UI + endpoints without further schema surprises.

## 7. Rollback

- Public site renders from hardcoded fallbacks whenever Supabase env is absent —
  unsetting the env vars instantly restores pre-CMS behaviour.
- `Layout.astro` and `astro.config.mjs` are the only replaced files; `git revert`
  the commit restores them.
- The adapter doesn't change prerendered pages: they stay static until a route
  opts in with `export const prerender = false`.

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/admin/login` says "CMS is not configured" | missing `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` |
| Login works, dashboard shows the amber "not migrated" banner | migrations/seed not run, or wrong project ref |
| Settings save 403 | your profile role isn't `administrator` (step 3.4) |
| `robots.txt` 404s in dev before deploy | it only exists on the on-demand (adapter) runtime — `npm run build && npm run preview`, or just deploy |
| Token expires after ~1 h | expected: re-login (refresh-token flow ships with Wave 1's endpoints) |
