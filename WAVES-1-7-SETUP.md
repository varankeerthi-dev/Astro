# BillFast CMS — Waves 1–7 patch (on top of the Phase 0 foundation)

This patch implements the remaining roadmap on top of `billfast-cms-phase0`:
banners (W1), announcements (W2), SEO manager (W3), analytics wiring (W4),
location pages (W5), blog (W6), and the knowledge base + releases (W7).

**Apply order:** Phase 0 patch first (it must already be in your repo), then this patch over it.

## 1. What's in this patch

```
supabase/
  migrations/0011_waves.sql     content_md columns (editor v1), /blog + /help/release-notes registry rows
  migrations/0012_kb_seed.sql   the four existing help articles migrated to kb_articles (markdown → safe HTML)
src/
  components/Analytics.astro                    Umami + Clarity loader (settings-driven) + event tracking
  components/public/BannerCarousel.astro        homepage carousel (fade, dots, lazy images, HTML overlay)
  components/public/AnnouncementBar.astro       sitewide top bar (dismissible, localStorage)
  layouts/Layout.astro          (replaces)      + announcement bar, homepage carousel, analytics, Blog nav link
  layouts/AdminLayout.astro     (replaces)      all module links enabled
  lib/cache.ts                                  CDN cache headers + tag purge (Vercel)
  lib/md.ts                                     markdown → safe HTML + heading TOC + reading time
  lib/utils/slug.ts                             slugify for auto slugs
  lib/cms/{crud,article-crud,configs,helpers,query,preview}.ts
                                              CRUD framework, article+page+SEO transactions, public query layer
  lib/seo/{score,jsonld}.ts                     SEO scorer (the audit checklist) + schema.org builders
  lib/cms/admin-fetch.ts                        SSR fetch helper for admin pages
  pages/api/admin/**                            CRUD + status/duplicate/reorder endpoints for every module,
                                              media upload/replace (sharp WebP variants), users, audit,
                                              preview-token endpoint, cron, search, feedback, suggested edits
  pages/api/cron/publish-due.ts                 Vercel Cron bookkeeping (5 min)
  pages/locations/[slug].astro                  location landing pages (hero, FAQ, testimonials, map, JSON-LD)
  pages/blog/**                                 list (category filter + pagination), single post (TOC, related)
  pages/help/{index,[slug],release-notes}.astro DB-driven KB: search box, palettes, sticky TOC, feedback,
                                              suggest-an-edit, print/copy-link, release-notes timeline
  pages/search.astro                            help-center search results (Postgres FTS)
  pages/admin/{banners,announcements,locations,blog,help,releases,media,seo,users,audit}.astro
                                              server-rendered admin modules (search/filter/pagination, forms)
  pages/index.astro + pricing.astro  (replaces) event attributes + section labels (from the analytics patch)
.env.example                      (replaces)    adds CRON_SECRET / VERCEL_TOKEN / Umami options
```

## 2. Apply

Copy the folders over your repo root (same structure as Phase 0). Files that
**replace** existing ones: `src/layouts/Layout.astro`, `src/layouts/AdminLayout.astro`,
`src/pages/index.astro`, `src/pages/pricing.astro`, `.env.example`.
Everything else is new.

## 3. Migrate

Run in the SQL editor (or `supabase db push`), in order:

1. `supabase/migrations/0011_waves.sql`
2. `supabase/migrations/0012_kb_seed.sql`

`0012` seeds the four help articles (quotations, inventory transfers, project
billing, site visits) into `kb_articles` with sanitized HTML + TOC + reading
time, linked to the existing `/help/*` page registry rows — the public URLs
keep working the moment the new DB-driven help route is live.

## 4. Env additions

| Var | Purpose |
|---|---|
| `CRON_SECRET` | bearer token for `/api/cron/publish-due` (Vercel Cron also auto-authenticates via the `x-vercel-cron` header) |
| `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` | optional — cache-tag purge on publish; without them the site still converges via stale-while-revalidate |
| `PUBLIC_UMAMI_SRC` / `PUBLIC_UMAMI_HOST` | only if you self-host Umami |

## 5. Verify checklist

1. `npm run dev` → home shows the announcement bar slot (empty until content), blog link in nav.
2. `/admin/banners` → create a banner (paste a media file id from `/admin/media` after uploading), publish → homepage carousel shows it; schedule with start/end → appears/disappears on time (read-time evaluation).
3. `/admin/announcements` → publish a maintenance alert → top bar shows sitewide; dismiss persists per browser.
4. `/admin/media` → upload an image → variants generated (sharp), SEO filename enforced.
5. `/admin/locations` → create `Chennai / Tamil Nadu` → publish → `/locations/erp-software-chennai` renders with FAQ JSON-LD.
6. `/admin/blog` → write a post (markdown) → publish → `/blog/<slug>` with TOC + related; sitemap.xml now includes it.
7. `/help` → articles come from the DB (seeded 4); search works (`/search?q=quotation`); feedback + suggest-an-edit work.
8. `/help/release-notes` → timeline; `/admin/releases` → add a note + compose a feature release with destinations.
9. `/admin/seo` → scores per page (the audit checklist); duplicate-title warnings; save meta → live `<head>`.
10. `/admin/users` → invite a teammate; `/admin/audit` → every action above is logged.
11. Preview: from any admin edit page visit `/api/admin/preview?path=/blog/<draft-slug>` (signed in) → draft renders with `no-store`.

## 6. Notes & scope

- **Editor v1 is Markdown** (`content_md`); the TipTap JSON path (`content_json`) stays reserved — no re-migration needed later.
- **ERP destinations** (badge / in-app notification) publish as feature_releases rows; the outbound webhook contract is defined in the design doc §6.4 — the ERP endpoint is out of this repo's scope.
- **Analytics**: the loader is settings-driven (Website Settings → Umami/Clarity IDs override env). Event catalog: `cta-click`, `announcement-view/click`, `blog-card-click`, `scroll-depth`, `page-exit`, plus the module/plan events already in the patched index/pricing pages.
- **Not verified here**: `npm install && astro build` (this patch was authored in a Python-only sandbox). Run the checklist above and report any build errors.
