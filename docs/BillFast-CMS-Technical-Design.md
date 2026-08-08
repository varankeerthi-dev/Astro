# BillFast Website CMS & Marketing Platform — Technical Design

| | |
|---|---|
| **Status** | **v1.1 — architecture decisions logged; implementation ON HOLD (owner is reviewing the design)** |
| **Date** | v1.0 → v1.1, 2026-08-06 (approval-gate outcomes + D3 public probe) |
| **Inputs** | PRD "BillFast Website CMS & Marketing Platform"; repo analysis of `github.com/varankeerthi-dev/astro` (cloned 2026-08-06); live SEO audit of `https://astro-wheat-eight.vercel.app` (score 69/100, this project's notebook); delivered analytics patch (`origin-erp-analytics-patch.zip`); public probe of `perfecterp.com` / `app.perfecterp.com` (2026-08-06) |
| **Scope** | Public marketing site + zero-code CMS for non-technical marketing/admin employees. Astro frontend, Supabase database & storage. |

## Decision log (approval gate, 2026-08-06)

| # | Decision | Outcome |
|---|---|---|
| **D1** | Where the CMS admin lives | ✅ **DECIDED — `/admin` section of the existing Astro site** (Option A, §3.1) |
| **D2** | Rendering strategy | ✅ **DECIDED — Hybrid SSR + CDN cache-tag purge** (§3.2) |
| **D3** | Shared vs dedicated Supabase project | ⏸ **Investigate first** — public probe inconclusive (below). Working default: dedicated CMS project; revisit once the ERP repo/hosting dashboard is confirmed |
| **D4** | Canonical brand & domain | Open — not blocking Phase 0 scaffolding; needed before content seeding and any domain cutover |
| **D5** | Admin library picks (TipTap, TanStack Table, dnd-kit, react-hook-form, zod) | No objection — proceed with the proposed set at implementation time, versions pinned then |
| **D6** | Implementation go-ahead | ⏸ **HOLD — design review only.** No code until explicit approval |

### D3 probe findings (2026-08-06, read-only public checks)

- `app.perfecterp.com` **does not resolve in public DNS** — the ERP app is not publicly reachable at the URL configured as `PUBLIC_APP_URL` fallback in the site's `.env`. Its stack cannot be fingerprinted from outside.
- `perfecterp.com` / `www.perfecterp.com` currently serve a **legacy PHP template site** (jQuery/Bootstrap frontend, `ASP.NET` powered-by header): `index.php`, `about.php`, `contact.php`, `privacy.php`, plus vertical pages `AnimalFeed.php`, `EthanolDistilleries.php`, `StorageTerminal.php`, `edibleoil.php`, `flour_rice_dal_mill.php` — all live (HTTP 200). This is a **different, older marketing presence** targeting process industries — not the new Astro site (which lives at `astro-wheat-eight.vercel.app`).
- No browser-visible Supabase usage on any public property. **Conclusion:** whether the ERP runs on Supabase can only be answered with ERP repo access, a hosting-dashboard check, or the ERP developer. Until then the design assumes a **dedicated CMS Supabase project** with the webhook contract (§6.4) as the ERP integration seam — which is correct under either D3 outcome.

---

## 1. Executive summary

The current marketing site is a **fully static Astro 7 site** with all copy hardcoded in `.astro` files and four help articles in Markdown content collections. The PRD asks for a CMS that lets non-technical staff change any of that content — banners, announcements, SEO, location pages, blog, knowledge base, media, settings — **without editing code or redeploying**.

The design in one paragraph: keep the existing Astro codebase and turn it into a **hybrid-rendered app** (static shell + on-demand rendered, CDN-cached public pages backed by Supabase Postgres) with a **protected `/admin` section** built as React islands inside the same repo. All content lives in Supabase with a **draft → scheduled → published → archived** workflow, **version history**, **audit logging**, and **role-based access** enforced by Postgres Row Level Security. Media goes to Supabase Storage with on-the-fly resize/WebP. The existing Help section and the already-delivered Umami + Clarity analytics patch are **extended, not rebuilt**.

D1 and D2 are now decided (see the decision log): the admin lives at `/admin` in this repo, and the site converts to hybrid SSR with cache-tag purging. What remains open is the ERP/Supabase confirmation (D3), the brand/domain call (D4), and the owner's approval to start Phase 0.

---

## 2. Current-state analysis (evidence-based)

Repo cloned and inspected on 2026-08-06 (`varankeerthi-dev/astro`, default branch, package name `mep-marketing`).

### 2.1 Repository inventory

| Area | What exists today | Notes |
|---|---|---|
| Framework | Astro **7.0.2**, React **19.2.7** (`@astrojs/react` 6.0.0), Tailwind **4.3.1** via `@tailwindcss/vite`, `@astrojs/sitemap` 3.7.3, sharp 0.34.5 (astro:assets), Node ≥ 22 | Exact versions from `package-lock.json` |
| Rendering | **Static only** — no adapter in `astro.config.mjs`; `site: 'https://perfecterp.com'` | Deployed to Vercel at `astro-wheat-eight.vercel.app` |
| `src/layouts/Layout.astro` (124 ln) | `<head>` with `title`/`description` props only, Google Fonts (Inter/Outfit), top nav, footer | **No** canonical, OG/Twitter, JSON-LD, robots meta. Footer Privacy/Terms links are `#` placeholders |
| `src/pages/index.astro` (418 ln) | Hero (badge, H1, dual CTA), pure-HTML dashboard mockup, **interactive module wheel** (8 modules: CRM, Projects, Inventory, Purchases, Accounting, HR & Payroll, Reports, Sales/Billing — desktop circular wheel + mobile grid + detail card, vanilla JS), final CTA | No banner/carousel, testimonials, or FAQ sections yet |
| `src/pages/pricing.astro` (69 ln) | 3 plan cards (Starter/Growth/Enterprise), CTAs → `PUBLIC_APP_URL/login` | Price values corrupted/missing (mojibake, see §2.3) |
| `src/pages/industries/*.astro` | 5 near-identical 32-line pages (construction, fabrication, manufacturing, project-management, sme) | Prime candidates to become CMS-driven template pages |
| `src/pages/help/` | `index.astro` (3 hardcoded category cards + article list) and `[slug].astro` (239 ln) backed by **Astro content collections** (`src/content/help/*.md`, 4 articles) | `[slug].astro` already has **per-category color palettes, a sticky TOC with IntersectionObserver scroll-spy, rendered Markdown** — this is the "existing Help section" the PRD says to extend |
| `src/content.config.ts` | Collections: `help` (live) and **`blog` (schema defined, loader wired, but `src/content/blog/` is empty)** | Blog was anticipated — the CMS blog replaces this collection |
| Components | **None** — no `src/components/` directory at all | The analytics patch introduces the first one (`Analytics.astro`) |
| Islands | React installed but **zero `client:*` directives** — no islands in use yet | Admin UI will be the first real React consumer |
| Env / config | `.env` contains only `PUBLIC_APP_URL`; **no Supabase usage anywhere** | Greenfield for the data layer |
| SEO infra | Sitemap integration on (dist has `sitemap-*.xml`); **no `robots.txt`**; `public/` = favicons only | Matches audit findings |
| Analytics | **Patch delivered but NOT yet applied to the repo** (0 `data-umami-event` attributes in the repo) | Patch adds `Analytics.astro`, env-gated Umami/Clarity loaders, event tracking; see §10 |
| Legacy domain | `perfecterp.com` serves an old PHP site (see Decision log → D3 probe) | Domain cutover needs a legacy redirect audit (§13) |

### 2.2 PRD ↔ existing code: reuse / extend / build map

| PRD phase | Exists today? | Strategy |
|---|---|---|
| 1. Banners | ✗ (hero is hardcoded) | **Build** `banners` module; render above hero via a `BannerCarousel.astro` island |
| 2. Announcements | ✗ | **Build** `announcements` module + top-bar component |
| 3. SEO management | Partial (`title`/`description` props) | **Extend** `Layout.astro` with a `<Seo>` component backed by `page_seo` table; port the audit notebook's scoring rules into the admin SEO score |
| 4. Location pages | ✗ (industry pages are the pattern) | **Build** `location_pages` table + one template route, modeled on the industry-page pattern |
| 5. Blog | Schema pre-wired, no content | **Build** DB-backed blog (content collections can't be edited by non-devs) |
| 6. Media library | ✗ (`public/` favicons only) | **Build** on Supabase Storage + metadata table |
| 7. Help Center / KB | ✅ content collections + TOC template | **Extend**: migrate 4 articles to `kb_articles`, keep `[slug].astro` visual system (palettes, TOC, scroll-spy), add search/feedback/versions/release notes |
| 8. Analytics | ✅ patch ready (Umami + Clarity) | **Reuse** patch; move IDs into Website Settings; extend event catalog |
| 9. Website settings | ✗ | **Build** `site_settings` singleton + footer links; consumed by `Layout.astro` |

### 2.3 Issues found that the CMS must fix (not just "add features")

1. **Mojibake in source files** — double-encoded UTF-8 across `index.astro` (9 occurrences), `pricing.astro` (14), `Layout.astro`, `help/index.astro`, industry pages. `₹` prices, `✓`, `→`, `©`, em dashes all render corrupted **in production today**. Files also carry a UTF-8 BOM (`EF BB BF`). The content-migration step (§13) repairs these strings as it moves copy into the database; no corrupted string may be carried into the CMS.
2. **`dist/` committed to git** (17 files tracked despite `.gitignore`) — remove from the index to stop stale-build confusion.
3. **Hardcoded everything** — nav links, footer columns, industry links, help categories, copyright. All become settings/DB-driven per PRD ("No hardcoded content").
4. **Branding flux** — the codebase says *Origin-ERP*, `astro.config` and default author say *Perfect ERP*, the PRD says *BillFast*, and `perfecterp.com` currently serves a legacy process-industry site. The CMS makes site name/logo/domains settings (Phase 9); the canonical brand call (D4) is still open.
5. **Broken footer anchors** (`#` placeholders for Privacy/Terms/Contact) — become editable footer links with real pages or modal content.

---

## 3. Target architecture

### 3.1 Decision D1 — where does the CMS admin live? → ✅ DECIDED: Option A

**Decided 2026-08-06: the CMS admin is a protected `/admin` section of the existing Astro app** (same repo, same deploy; editors log in at the site domain). React islands + Astro server endpoints in the existing repo.

Why it won: one codebase & deploy; reuses Layout/design system; React 19 already installed; Astro server endpoints are first-class; fastest to ship; preview uses the same rendering pipeline as the public site. Because the PRD says "inside the BillFast ERP", the ERP link is honored by (a) a menu entry in the ERP pointing at `/admin`, and (b) the shared webhook contract (§6.4) for in-ERP badges/notifications. If the ERP is later confirmed to be Supabase-based (D3), deeper embedding stays possible without data migration.

Alternatives kept on record — B (admin inside the ERP app): best in-ERP UX but requires the ERP stack to accept a large Astro-based module and couples marketing deploys to ERP releases. C (separate `admin.` app): clean separation but a second app to build/secure and a duplicated design system.

### 3.2 Decision D2 — how do content changes go live without redeploy? → ✅ DECIDED: Hybrid SSR

**Decided 2026-08-06: hybrid SSR.** Add `@astrojs/vercel`. Public content routes set `export const prerender = false` and read from Supabase **on demand**, behind CDN cache headers (`s-maxage`, `stale-while-revalidate`) with tag-based purge on publish. Admin routes are SSR `no-store`.

Why it won: publishes go live in seconds; scheduled start/end windows evaluate at read time so campaigns start exactly on time; real draft preview; future-proof for blog/KB/location growth. supabase-js talks PostgREST over HTTPS, so serverless concurrency does not create Postgres connection storms. The rejected alternative (fully static + deploy-hook rebuild on publish) stays documented as a cost fallback: every publish would wait ~30–90 s for a rebuild and scheduled items would be only as precise as the cron.

Astro's on-demand rendering (per-route `prerender = false` behind an adapter) and server endpoints are documented, stable capabilities [^1].

### 3.3 System diagram

```
                        ┌──────────────────────────────────────────────┐
                        │                 Vercel                        │
                        │  Astro app (repo: varankeerthi-dev/astro)     │
                        │                                               │
  Public visitors ─────▶│  Public routes (SSR + CDN cache tags)         │──▶ supabase-js (ANON key, RLS: published-only)
                        │    /  /pricing  /industries/*  /blog/*        │
                        │    /locations/*  /help/*  /sitemap.xml …      │
                        │                                               │
  Marketing/admin ─────▶│  /admin/* (SSR, no-store, auth middleware)    │──▶ supabase-js (user JWT, RLS by role)
  (Supabase Auth)       │  /api/admin/* (server endpoints)              │──▶ service-role key (server only)
                        │  /api/cron/*  /api/webhooks/*                 │
                        └───────┬───────────────────────┬───────────────┘
                                │ PostgREST/Auth/Storage │ signed webhooks (HMAC)
                        ┌───────▼──────────┐   ┌────────▼─────────┐
                        │     Supabase      │   │   BillFast ERP    │
                        │  Postgres + RLS   │   │  (badge & notif.  │
                        │  Auth (roles)     │   │  API — stack TBC) │
                        │  Storage (media)  │   └───────────────────┘
                        └───────────────────┘
  Umami + Clarity scripts injected by Layout (IDs from Website Settings) — analytics dashboards stay on umami.is / clarity.microsoft.com
```

### 3.4 Environments

| Env | Supabase | Vercel | Purpose |
|---|---|---|---|
| Local dev | Supabase CLI local stack (or dev project) | `astro dev` | Migrations are plain SQL in `supabase/migrations/`, applied via CLI |
| Staging | `billfast-cms-staging` project | Vercel preview deployment | Content stew; editors rehearse |
| Production | `billfast-cms-prod` project | Production deployment | Live site |

Config via env vars (Appendix C); service-role key exists only in server runtime, never in `PUBLIC_*`.

---

## 4. Database schema (Supabase / Postgres)

Conventions: `uuid` PKs default `gen_random_uuid()`; `timestamptz` everywhere; every content table carries the **workflow columns** below; soft delete via `deleted_at`; every mutating admin action writes `audit_log`; human edits snapshot into `content_versions`.

```sql
-- 0001_enums.sql
create type content_status  as enum ('draft','scheduled','published','archived');
create type user_role       as enum ('marketing_editor','publisher','administrator');
create type announcement_kind as enum
  ('information','new_feature','product_launch','celebration',
   'holiday_wishes','offer','maintenance','alert');
create type kb_kind as enum
  ('user_guide','faq','release_note','troubleshooting',
   'feature_documentation','video_tutorial','tips_and_tricks','api_documentation');
create type difficulty as enum ('beginner','intermediate','advanced');
```

```sql
-- 0002_identity.sql
create table profiles (                       -- 1:1 with auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'marketing_editor',
  created_at timestamptz not null default now()
);

create table audit_log (                      -- append-only; written by server endpoints
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,                       -- create|update|publish|unpublish|schedule|archive|delete|restore|login…
  entity text not null,                       -- banner|announcement|page|blog_post|kb_article|media|setting…
  entity_id uuid,
  summary text,
  diff jsonb,                                 -- {field: [old, new]}
  ip inet,
  created_at timestamptz not null default now()
);

create table content_versions (               -- version history for pages & articles
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  version int not null,
  kind text not null default 'manual',        -- autosave|manual|publish|restore
  snapshot jsonb not null,                    -- full row snapshot at save time
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (entity, entity_id, version)
);
```

```sql
-- 0003_settings_media.sql
create table site_settings (                  -- singleton row (id=1), edited in Website Settings
  id int primary key default 1 check (id = 1),
  site_name text, tagline text,
  logo_media_id uuid, favicon_media_id uuid,
  contact_email text, contact_phone text,
  address jsonb,                              -- {line1,line2,city,state,pin,country}
  business_hours jsonb,                       -- [{days, open, close}]
  social_links jsonb,                         -- {linkedin, twitter/x, youtube, …}
  copyright_text text,
  default_seo_title text, default_seo_description text,
  default_og_image_id uuid,
  robots_txt text,                            -- editable robots body
  sitemap_enabled boolean default true,
  gsc_verification text,                      -- Search Console meta token
  ga_measurement_id text, gtm_id text,        -- future
  clarity_project_id text, umami_website_id text,   -- Phase 8: settings-driven, env fallback
  cookie_consent_text text,
  header_scripts text, footer_scripts text,   -- admin-only, sanitized/escaped policy
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

create table media_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null, parent_id uuid references media_folders(id),
  path text not null unique                   -- materialized path: /banners/homepage
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'media',
  storage_path text not null unique,          -- /banners/2026/08/erp-software-chennai-1920.webp
  folder_id uuid references media_folders(id),
  filename text not null,                     -- SEO-friendly, slugified at upload
  mime text not null, bytes int, width int, height int,
  alt_text text, caption text,
  variants jsonb,                             -- {"480": "…-480.webp", "768": …, "original": …}
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table media_usage (                    -- "where is this asset used?"
  media_id uuid references media_assets(id) on delete cascade,
  entity text not null, entity_id uuid not null, field text not null,
  primary key (media_id, entity, entity_id, field)
);
```

```sql
-- 0004_phase1_2.sql  — Banners & Announcements
create table banners (
  id uuid primary key default gen_random_uuid(),
  title_html text,                            -- HTML overlay (never baked into image)
  subtitle text,
  desktop_media_id uuid references media_assets(id),
  mobile_media_id  uuid references media_assets(id),
  cta_label text, cta_url text,
  cta_style text default 'primary',           -- primary|outline|ghost (design-system tokens)
  display_order int not null default 0,       -- drag & drop in admin
  status content_status not null default 'draft',
  publish_at timestamptz, unpublish_at timestamptz,   -- scheduled publishing window
  created_by uuid references profiles(id), updated_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz                      -- soft delete; archive = status
);
-- Public read policy (effective visibility):
--   status='published' and deleted_at is null
--   and (publish_at is null or publish_at <= now())
--   and (unpublish_at is null or unpublish_at > now())

create table announcements (
  id uuid primary key default gen_random_uuid(),
  kind announcement_kind not null default 'information',
  title text not null, description text,
  icon text,                                  -- design-system icon key
  theme text default 'info',                  -- info|success|warning|danger|brand
  button_label text, button_url text,
  priority int not null default 0,            -- higher wins when stacked
  publish_at timestamptz, unpublish_at timestamptz,
  dismissible boolean default true,           -- dismissal remembered in localStorage
  locations text[] default '{home_topbar}',   -- display locations: home_topbar|pricing_banner|help_sidebar|all_pages
  status content_status not null default 'draft',
  created_by uuid references profiles(id), updated_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
```

```sql
-- 0005_seo_pages.sql  — SEO management + CMS pages
create table pages (                          -- every public page gets SEO + ownership
  id uuid primary key default gen_random_uuid(),
  slug text not null,                         -- '/', '/pricing', '/industries/construction-erp', …
  page_type text not null default 'static',   -- static|blog|location|help|system
  title text not null,                        -- internal name + breadcrumb source
  status content_status not null default 'published',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create unique index pages_slug_alive on pages(slug) where deleted_at is null;  -- duplicate-slug guard

create table page_seo (                       -- 1:1 SEO record per page
  page_id uuid primary key references pages(id) on delete cascade,
  seo_title text, meta_description text,
  canonical_url text,
  robots text default 'index,follow',         -- noindex/nofollow toggles in UI
  focus_keyword text, secondary_keywords text[],
  og_title text, og_description text, og_image_id uuid references media_assets(id),
  twitter_card text default 'summary_large_image',
  breadcrumb_title text,
  jsonld_extra jsonb                          -- page-type-specific schema overrides
);
-- Duplicate title detection: admin query on lower(trim(seo_title)) groups;
-- enforced as a soft warning (not a hard constraint) because CMS pages may
-- legitimately share titles across locales later.
```

```sql
-- 0006_locations.sql
create table location_pages (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id),          -- carries slug + SEO (page_seo)
  city text not null, state text not null,
  hero_heading text, hero_subheading text,
  banner_media_id uuid references media_assets(id),
  description_rich jsonb,                     -- editor JSON
  testimonials jsonb default '[]',            -- [{name, company, quote, rating}]
  faqs jsonb default '[]',                    -- [{q, a}] → FAQPage JSON-LD
  contact jsonb,                              -- {phone, email, address}
  map_embed_url text,
  cta_label text, cta_url text,
  status content_status not null default 'draft',
  created_by uuid references profiles(id), updated_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
```

```sql
-- 0007_blog.sql
create table blog_categories (id uuid primary key default gen_random_uuid(),
  name text not null unique, slug text not null unique, description text);
create table blog_tags (id uuid primary key default gen_random_uuid(),
  name text not null unique, slug text not null unique);
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id),          -- slug + SEO via page_seo
  title text not null,
  excerpt text,
  content_json jsonb,                         -- rich editor document (TipTap-compatible)
  content_html text,                          -- server-rendered, sanitized cache of the above
  category_id uuid references blog_categories(id),
  author_id uuid references profiles(id),
  featured_image_id uuid references media_assets(id),
  reading_time_min int,                       -- computed on save
  toc jsonb,                                  -- computed heading tree for sticky TOC
  related_post_ids uuid[] default '{}',       -- manual override; fallback = same-category recent
  status content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references profiles(id), updated_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create table blog_post_tags (post_id uuid references blog_posts(id) on delete cascade,
  tag_id uuid references blog_tags(id) on delete cascade, primary key (post_id, tag_id));
```

```sql
-- 0008_kb.sql  — Knowledge Base (extends the existing help system)
create table kb_categories (                  -- user guides, FAQs, troubleshooting, …
  id uuid primary key default gen_random_uuid(),
  kind kb_kind not null,
  name text not null, slug text not null unique,
  module text,                                -- ERP module: CRM, Inventory, Site Visits…
  palette_key text default 'blue',            -- reuses [slug].astro's existing palettes
  display_order int default 0
);
create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages(id),
  kind kb_kind not null default 'user_guide',
  title text not null, summary text,
  content_json jsonb, content_html text,      -- callouts/warnings/tips/steps/collapse blocks
  category_id uuid references kb_categories(id),
  module text, tags text[] default '{}',
  keywords text[] default '{}',               -- search keywords (admin field)
  difficulty difficulty default 'beginner',
  author_id uuid references profiles(id),
  product_version text,                       -- "applies to v2.4+"
  featured_image_id uuid references media_assets(id),
  attachments jsonb default '[]',             -- [{media_id, label}] PDFs/videos/GIFs
  related_article_ids uuid[] default '{}',
  reading_time_min int, toc jsonb,
  helpful_yes int default 0, helpful_no int default 0,   -- denormalized counters
  status content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references profiles(id), updated_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  last_reviewed_at timestamptz,
  deleted_at timestamptz
);
create index kb_articles_fts on kb_articles using gin(
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' '
    || coalesce(content_html,'') || ' ' || array_to_string(keywords,' '))
);
create table kb_feedback (                    -- "Was this article helpful?"
  id uuid primary key default gen_random_uuid(),
  article_id uuid references kb_articles(id) on delete cascade,
  helpful boolean not null, comment text,
  created_at timestamptz default now()
);
create table kb_suggested_edits (             -- reader → editor workflow
  id uuid primary key default gen_random_uuid(),
  article_id uuid references kb_articles(id) on delete cascade,
  suggestion text not null, contact_email text,
  state text default 'open',                  -- open|accepted|rejected
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now(), reviewed_at timestamptz
);
create table release_notes (                  -- timeline view, filter by version/module
  id uuid primary key default gen_random_uuid(),
  version text not null,                      -- 2.4.0
  module text,
  badge text not null default 'improved',     -- new|improved|fixed
  title text not null, description text,
  article_id uuid references kb_articles(id), -- optional deep link
  released_on date,
  status content_status not null default 'draft',
  created_at timestamptz default now(), deleted_at timestamptz
);
create table feature_releases (               -- Phase 7 "Feature Discovery" multi-destination publish
  id uuid primary key default gen_random_uuid(),
  title text not null, summary text,
  dest_help_article boolean default false, kb_article_id uuid references kb_articles(id),
  dest_release_notes boolean default false, release_note_id uuid references release_notes(id),
  dest_erp_badge boolean default false,       -- "New" badge inside the ERP (webhook)
  dest_announcement boolean default false, announcement_id uuid references announcements(id),
  dest_banner boolean default false, banner_id uuid references banners(id),
  dest_inapp_notification boolean default false,  -- ERP webhook
  status content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(), deleted_at timestamptz
);
```

```sql
-- 0009_navigation.sql
create table footer_links (
  id uuid primary key default gen_random_uuid(),
  column_name text not null,                  -- Product|Industries|Support|Legal
  label text not null, url text not null,
  display_order int default 0, is_active boolean default true
);
create table redirects (                      -- migration safety net + marketing short links
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique, to_path text not null,
  status_code int default 301, is_active boolean default true
);
```

**RLS summary (policies in `0010_rls.sql`):**
- **Anon/public role:** `SELECT` only, and only rows where `status='published'`, inside the publish window, `deleted_at is null` — per table. Drafts are *invisible* to the public at the database layer, not by application convention.
- **Authenticated:** role read from `profiles` (`jwt → app_metadata.role` mirror). Editors: `INSERT/UPDATE` content tables but **cannot** set `status` past `draft`. Publishers: all transitions + archive/soft-delete. Administrators: everything + `site_settings`, `footer_links`, user management. Transition rules are enforced in server endpoints (service role) with RLS as the backstop.
- `audit_log`, `content_versions`: insert via service role only; select for authenticated.
- `kb_feedback`, `kb_suggested_edits`: `INSERT` open to anon (public forms), `SELECT` restricted.

**Storage buckets:** `media` (public read, authed write), `media-private` (KB attachments requiring signed URLs, if needed). Upload path convention: `<folder>/<yyyy>/<mm>/<seo-slug>-<width>w.<ext>`.

---

## 5. Routing plan

### 5.1 Public routes (SSR + CDN cache tags, `prerender = false` unless noted)

| Route | Source | Notes |
|---|---|---|
| `/` | `pages/index.astro` | Sections driven by CMS: `banners` carousel, announcements bar, module wheel (kept as-is), settings-driven copy |
| `/pricing` | existing, CMS-ified copy + plans later | Keep URL |
| `/industries/[slug]` | 5 existing pages → template + `pages`/SEO records | URLs unchanged |
| `/locations/[slug]` | `location_pages` | e.g. `/locations/erp-software-chennai`; FAQPage + LocalBusiness JSON-LD |
| `/blog`, `/blog/[slug]`, `/blog/category/[slug]` | `blog_posts` | sticky TOC, related articles, reading time |
| `/help`, `/help/[slug]` | `kb_articles` | **extends existing `[slug].astro`** (palettes, TOC, scroll-spy); adds search box, breadcrumbs, feedback widget, print view |
| `/help/release-notes` | `release_notes` | timeline UI, version/module filters, New/Improved/Fixed badges |
| `/search` (or help-integrated) | Postgres FTS endpoint | Phase 7 |
| `/sitemap.xml` | server endpoint (DB-driven) | replaces build-time-only `@astrojs/sitemap` for dynamic routes |
| `/robots.txt` | server endpoint from `site_settings.robots_txt` | fixes today's 404 |
| `/[slug]` (catch-all CMS pages) | `pages` table | enables future marketing pages without deploys |

### 5.2 Admin routes (`/admin/*`, SSR, `Cache-Control: no-store`, auth middleware)

```
/admin                       dashboard (drafts awaiting review, scheduled queue, recent audit events)
/admin/banners               list (search/filter/paginate) + editor + drag-&-drop ordering + preview
/admin/announcements         list + editor
/admin/seo                   page list with SEO score, missing-field & duplicate warnings
/admin/locations             list + generator form
/admin/blog                  posts/categories/tags
/admin/media                 library (grid/folders/search/replace/usage)
/admin/help                  articles/categories + suggested-edits inbox + feedback stats
/admin/releases              feature-release composer (multi-destination) + release notes
/admin/settings              website settings (§9 fields), integrations, robots/sitemap, scripts
/admin/users                 invite, role assignment (administrator only)
/admin/audit                 audit log viewer (filter by actor/entity/action/date)
```

### 5.3 Preview

`/api/admin/preview?token=<jwt>&path=/blog/my-draft` sets a short-lived signed `__preview` cookie → middleware switches data access to the **service role with drafts included** and bypasses CDN cache. "Preview" buttons everywhere in admin deep-link here. Public cache is never poisoned because preview responses carry `no-store` + no cache tags.

---

## 6. API design

### 6.1 Admin endpoints (`/api/admin/*`, Astro server endpoints, service-role client after permission check)

| Endpoint | Methods | Role | Purpose |
|---|---|---|---|
| `/api/admin/<entity>` | GET(list,search,filter,paginate) / POST(create) | editor+ | Generic CRUD over `banners`, `announcements`, `locations`, `blog`, `kb`, `media`, `releases` — one handler per entity, shared validation (zod) |
| `/api/admin/<entity>/:id` | GET / PATCH / DELETE(soft) | editor+ | Update writes `content_versions` snapshot; DELETE sets `deleted_at` |
| `/api/admin/<entity>/:id/status` | POST `{action: submit|schedule|publish|unpublish|archive|restore, at?}` | publisher+ (schedule/publish) | **Only path that mutates status** → writes audit, versions, purges CDN tags, fires webhooks |
| `/api/admin/<entity>/:id/duplicate` | POST | editor+ | Clone as new draft (`title + " (copy)"`, fresh slug) |
| `/api/admin/<entity>/reorder` | POST `{orderedIds}` | editor+ | Drag & drop persistence (banners, categories, footer links) |
| `/api/admin/media/upload` | POST (signed-URL issue) / POST complete | editor+ | Slugifies filename → storage upload → sharp extracts dimensions → WebP + responsive variants → `media_assets` row |
| `/api/admin/media/:id/replace` | POST | editor+ | New file, same asset id; refs stay valid; old file GC'd when usage empties |
| `/api/admin/seo/analyze` | POST `{pageId}` | editor+ | Runs the SEO scorer (§9.3) + duplicate title/slug checks + missing-image scan |
| `/api/admin/preview` | GET | editor+ | Mints the preview cookie (§5.3) |
| `/api/admin/settings` | GET / PATCH | administrator | Website settings; every write audited |
| `/api/admin/users` | GET / POST / PATCH | administrator | Invite + role management (Supabase Admin API) |
| `/api/admin/audit` | GET | publisher+ | Audit log search |
| `/api/cron/publish-due` | GET (Vercel Cron, 5 min) | system | Flips due `scheduled→published`, bookkeeping + cache purge + webhooks. (Read-time windows mean the public site is correct even between cron runs.) |
| `/api/webhooks/erp` | POST (HMAC-signed) | system | Outbound: feature-release → ERP "New" badge / in-app notification payloads |

**Read path for the public site:** Astro pages query Supabase directly with the **anon key** (RLS does the filtering) — no custom read APIs to maintain. Admin islands also use supabase-js with the **user's JWT** for list views; mutations go through the endpoints above so versioning/audit/purge can't be skipped.

### 6.2 Publish pipeline (single code path, every entity)

```
validate (zod) → snapshot to content_versions → update row (status, publish_at)
→ audit_log entry (actor, diff) → compute affected cache tags (entity, slug, listing pages)
→ Vercel cache purge by tag → fire outbound webhooks if any (feature release destinations)
→ return {ok, version, liveUrl, previewUrl}
```

### 6.3 Media pipeline

Upload: client requests signed URL → PUT to Supabase Storage → `complete` call runs sharp (already in the dependency tree at 0.34.5) to record `width/height`, generate `480/768/1280/1920` WebP variants, and enforce the SEO filename (`erp-software-chennai-hero.webp`). Serving: `<img srcset>` from `variants`, `loading="lazy"`, explicit `width/height` (CLS-safe); where the Supabase plan allows, its Storage image-transformation endpoint (`width/height/quality/resize` params) can serve on-the-fly derivatives instead of pre-generated variants [^2]. Overlay text is **always HTML positioned over the image**, never rendered into pixels — this is a hard PRD requirement and an accessibility/SEO win.

### 6.4 ERP integration contract (Phase 7 destinations)

Outbound POST to `{ERP_BASE_URL}/api/integrations/marketing` with HMAC-SHA256 signature (`X-BillFast-Signature`), payload `{type: 'badge'|'notification', title, summary, url, publishAt}`. The ERP side is **out of this repo's scope** — flagged as a dependency (§12, R1). Until the ERP endpoint exists, those two checkboxes are disabled with a tooltip.

---

## 7. Permissions model

| Capability | Marketing Editor | Publisher | Administrator |
|---|---|---|---|
| Create/edit drafts (all content modules) | ✅ | ✅ | ✅ |
| Autosave, preview, duplicate, reorder | ✅ | ✅ | ✅ |
| Submit for review | ✅ | ✅ | ✅ |
| **Publish / schedule / unpublish / archive** | ✗ | ✅ | ✅ |
| Soft delete / restore | ✗ | ✅ | ✅ |
| Hard delete (media GC, versions purge) | ✗ | ✗ | ✅ |
| Website settings, integrations, scripts | ✗ | ✗ | ✅ |
| User invite & role management | ✗ | ✗ | ✅ |
| View audit log | ✗ | ✅ | ✅ |
| KB suggested-edits inbox, feedback stats | ✅ | ✅ | ✅ |

- Auth: **Supabase Auth**, email/password (+ optional Google OAuth), **invite-only** (public signup disabled), MFA encouraged for administrators. Role stored in `profiles.role`, mirrored into the JWT via an auth hook for cheap RLS checks.
- Every `/admin/*` and `/api/admin/*` hit passes an **Astro middleware** that validates the session and attaches `profile`; endpoints re-check the capability table above (defense in depth with RLS).
- **Audit log** records publish/unpublish/delete (PRD minimum) plus create/update/schedule/restore/login for completeness; retained indefinitely, exportable to CSV.

---

## 8. Admin UX design

Design language: extend the site's Tailwind 4 + Inter/Outfit system into an `AdminLayout` (left nav, top bar, content card) — minimalist, slate/blue, matching the public site and BillFast branding.

**Cross-cutting admin primitives (React, shared by every module):**

| Component / hook / service | Used for |
|---|---|
| `<DataTable>` (TanStack Table) | search, filters, sort, pagination, row actions on every list screen |
| `<StatusBadge>` + `<StatusActions>` | draft/scheduled/published/archived + allowed transitions per role |
| `<RichEditor>` (TipTap) | blog/KB/locations rich content; custom nodes: callout, warning, tip, steps, collapse, table, image (media picker), video embed |
| `<MediaPicker>` | modal over the media library; enforces alt text before insert |
| `<SeoFields>` | all Phase-3 fields with **live character counters**, focus/secondary keywords |
| `<SerpPreview>` / `<SocialPreview>` | Google result preview + OG/Twitter card preview, updating as you type |
| `<SeoScore>` | weighted checklist (§9.3) with warnings panel |
| `<DateRangePicker>` / `<ScheduleDialog>` | start/end dates, scheduled publishing |
| `<DragList>` (dnd-kit) | banner ordering, category ordering, footer links |
| `useAutosave` | debounced PATCH every ~2 s of dirty state → `content_versions(kind='autosave')`; "last saved" indicator; restore-on-crash |
| `cmsService.ts` | typed client for the endpoints in §6.1 |
| `<DuplicateDetector>` | inline warnings for duplicate titles/slugs (server-checked) |
| `<AuditTrail>` | per-record history drawer (versions + audit events + rollback button) |

Editorial details that matter for non-technical users: every list has saved filters; every form has inline validation with plain-language messages; destructive actions confirm with entity name; every content form shows **Preview / Duplicate / Archive** in the same place; empty states include a "create your first …" button; keyboard shortcuts (⌘S save, ⌘⇧P preview).

---

## 9. SEO system (Phase 3 engine, used by all modules)

### 9.1 `<Seo>` component (extends `Layout.astro`)

Props: a `page_seo` record + page-type JSON-LD payload. Emits: title (`{seo_title} | {site_name}` pattern, settings-driven), meta description, canonical (absolute, settings base URL), robots, OG/Twitter tags with fallback chain (`page og_image → default_og_image`), breadcrumb title consumption, and JSON-LD scripts. The existing audit found all of these missing — this component fixes the whole class of issues site-wide, permanently.

### 9.2 JSON-LD matrix

| Page type | Schema |
|---|---|
| Home | `Organization` + `WebSite` (+ `SearchAction` when search ships) |
| Blog post | `BlogPosting` (author, dates, image) + `BreadcrumbList` |
| Location page | `Service`/`SoftwareApplication` + `FAQPage` (from faqs) + `BreadcrumbList` |
| KB article | `TechArticle`/`HowTo` (for numbered-steps content) + `BreadcrumbList` |
| Pricing | `Product` with `Offer`s (once plan prices are structured data) |

### 9.3 SEO score (admin)

Port of the audit notebook's weighted rule set into `src/lib/seo/score.ts`: title length 30–60, description 70–160, focus keyword in title/H1/slug/first paragraph, image alts present, canonical absolute, OG/Twitter completeness, word count ≥ 300, single H1, heading hierarchy, internal links present. Output: 0–100 + per-rule warnings — the same checklist that scored the current site **69/100**, now enforced inside the CMS before publish. **Warnings, not blockers** (publishers can override with a reason, which is audited).

### 9.4 Infrastructure

- `/sitemap.xml` server endpoint: union of `pages` (published) grouped by type; cache-tagged per section.
- `/robots.txt` from settings (default allow-all + sitemap reference); staging env forces `Disallow: /`.
- Google Search Console verification meta from settings (activates when the official domain lands — aligns with the existing plan to defer GSC until then).
- `redirects` table drives 301/302 middleware — used during migration and for any future slug change (admin warns before changing a live slug and offers to auto-create a redirect).

---

## 10. Analytics (Phase 8)

**Reuse the delivered patch** (`analytics-patch/` in project outputs): `Analytics.astro` already implements env-gated Umami + Clarity loaders and events for module clicks, CTA clicks, scroll depth, and page exit; the setup guide covers Umami Cloud / Clarity provisioning and Vercel env vars.

Changes for the CMS:
1. **IDs move to Website Settings** (`clarity_project_id`, `umami_website_id`), injected by `Layout.astro` — marketing can rotate IDs without a deploy; env vars remain as build-time fallback.
2. **Event catalog completion** per PRD: add `navbar-click`, `footer-click`, `signin-click` (already `login-click` in patch), `cta-click` (banner/announcement CTAs carry `data-umami-event` automatically from the render components), `exit-page`, `time-on-page` buckets, conversion events (`demo-booked`, `trial-started`) fired from the app's thank-you states. Umami covers visitors/countries/cities/devices/browsers/OS/referrers/UTM natively; Clarity covers scroll maps, recordings, rage/dead clicks, with custom tags via its client API for funnel stage and section attribution [^5].
3. **Consent**: cookie-consent banner text from settings; Clarity's consent API is called when consent is granted; Umami is cookieless. (Prior compliance note stands: disclose under India DPDP; add consent gating before targeting EU.)
4. **No custom dashboard in Phase 1** — confirmed by PRD and prior decision; Umami/Clarity UIs are the dashboards. The event schema is deliberately compatible with the future custom dashboard.

---

## 11. Phased implementation roadmap

The PRD order is preserved, but three PRD items are **foundational dependencies of everything else** and are pulled into **Phase 0**: Website Settings (PRD 9), Media Library (PRD 6), and the RBAC/audit/versioning spine. Analytics (PRD 8) becomes a small wave right after Phase 0 because the patch already exists.

| Wave | PRD phase | Contents | Depends on | Est. effort | Acceptance criteria (excerpt) |
|---|---|---|---|---|---|
| **0. Foundation** | 9, 6, tech reqs | Supabase project + migrations; Auth + roles + RLS; audit log; versions; AdminLayout + primitives (DataTable, StatusActions, autosave); site_settings + footer links consumed by Layout; `<Seo>` component; media library (upload/replace/compress/WebP/folders/search/usage); Vercel adapter + hybrid rendering; preview mode; robots/sitemap endpoints; repo hygiene (mojibake fix, drop `dist/`) | — | 4–5 wks | Admin can log in, edit site name/logo/default SEO, upload an image with alt text, and see it live in seconds; audit row exists for every action |
| **1. Banners** | 1 | banners module end-to-end (desktop/mobile images, HTML overlay, CTA styles, drag-drop order, scheduling window, preview, duplicate, archive, search/filter/pagination) + homepage carousel with lazy responsive WebP | 0 | 1.5–2 wks | Editor builds a scheduled homepage banner, previews it, publisher schedules it; it appears/disappears on time with zero deploys |
| **2. Announcements** | 2 | kinds, themes, icons, priority, dismissible (localStorage), locations, windows | 0 | 1 wk | Maintenance alert renders site-wide top bar; holiday wish shows only on home; dismissal persists |
| **3. SEO management** | 3 | page_seo back-office: SERP/social previews, counters, score, duplicate title/slug detection, missing-image scan; JSON-LD matrix live | 0 (component) | 1.5–2 wks | Admin shows score per page; republishing `/` fixes the live audit score from 69 → 90+ |
| **4. Analytics** | 8 | apply + extend the patch; settings-driven IDs; full event catalog; consent | 0 | 0.5–1 wk | All PRD events visible in Umami within a day of traffic |
| **5. Location pages** | 4 | location_pages + template + generator form + FAQ/LocalBusiness schema + CSV bulk seed | 0, 3 | 1.5 wks | "ERP Software Chennai" page generated, indexed, and editable without code |
| **6. Blog CMS** | 5 | posts/categories/tags, rich editor, featured image, TOC, related, schedule, archive, SEO | 0, 3 | 2–3 wks | Full editorial workflow draft→schedule→publish; RSS + sitemap inclusion |
| **7. Knowledge Base** | 7 | migrate 4 help articles (mojibake-cleaned); extend `[slug].astro`; kinds incl. release notes & video tutorials; attachments; FTS search; feedback widget; suggested-edits inbox; recently updated / popular / continue-reading; print view; copy-link; feature-release multi-destination composer + ERP webhooks | 0, 3 (+ERP API for 2 destinations) | 3–4 wks | Existing `/help/*` URLs keep working (redirects if slugs change); search returns ranked results; a feature release can fan out to KB + notes + announcement + banner in one publish |
| **8. ERP-side badges/notifications** | 7 (part) | ERP implements its half of the webhook contract | ERP team | external | "New" badge appears in ERP for a published feature release |

Total for waves 0–7: roughly **14–19 person-weeks** for one senior full-stack engineer (±30%). Waves 1–2 and 5–6 can run two-at-a-time if staffed in parallel.

---

## 12. Risks & mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **ERP API unknowns** — "New badge" and in-app notifications need an ERP-side endpoint. v1.1 probe: `app.perfecterp.com` does not resolve publicly; ERP stack/hosting unconfirmed from outside | Phase 7 destinations blocked | Webhook contract defined (§6.4); checkboxes disabled until ERP confirms; **first task when implementation starts: obtain ERP repo/dashboard access and confirm stack + Supabase usage (also closes D3)** |
| R2 | **RLS misconfiguration** could expose drafts/scheduled content | SEO/PR damage | Published-only policies as default-deny; integration tests that query as anon and assert zero drafts; service key only in serverless env |
| R3 | **Rich-text XSS** via editor HTML or overlay HTML | Site defacement | Server-side sanitize (DOMPurify) on save and render; banner `title_html` whitelisted tags (`strong/em/span/br` + class tokens); CSP headers on public pages |
| R4 | **Vercel cost/cold start** growth with SSR | Latency/bill | Aggressive CDN caching (public hit ratio target >90%); cache tags; keep heavy transforms out of request path; monitor invocations |
| R5 | **SEO regression during migration** (URL changes, missing meta) — now includes the **legacy `perfecterp.com` PHP site** (live, indexed `.php` URLs) | Traffic loss | New-site URLs preserved 1:1; `redirects` table pre-loaded with the legacy `.php` → new-page map (§13); sitemap + canonical verified against the audit checklist before cutover; post-launch re-audit with this project's notebook |
| R6 | **Mojibake carried into DB** during seeding | Corrupted content persists | Importer applies a repair pass (double-decode detection) + manual review checklist for ₹/✓/→/©/em-dash (30+ known occurrences) |
| R7 | **Supabase plan limits** — image transformations & egress are plan-gated | Media pipeline surprise | Verify plan at Phase 0; fallback = sharp-generated variants at upload (already designed either way) |
| R8 | **Editor lock-in / data portability** | Future migration pain | Content stored as portable JSON + sanitized HTML; export endpoint (JSON/CSV) per module |
| R9 | **Single-admin lockout** | Ops stall | ≥2 administrators; Supabase dashboard as break-glass; invite flow documented |
| R10 | **Branding/domain churn** (Origin-ERP ↔ Perfect ERP ↔ BillFast; vercel.app → official domain currently occupied by the legacy PHP site) | Rework, SEO dilution | All brand strings are settings; `site`/canonical/OG URLs derive from one base-URL setting; domain switch playbook already documented in the analytics setup guide, extended with the legacy redirect map (§13) |
| R11 | **Scheduled-publishing drift** (cron failure) | Campaign mistiming | Read-time window evaluation makes the public site correct even if cron dies; cron only does bookkeeping/notifications; alert on cron failure |
| R12 | **Backups/restore** | Data loss | Supabase daily backups (+PITR on Pro); quarterly restore drill; `content_versions` gives per-record rollback independent of backups |

---

## 13. Migration plan

**New in v1.1 — legacy domain finding:** the intended official domain `perfecterp.com` is **currently occupied by a legacy PHP site** (`index.php`, `about.php`, `contact.php`, `privacy.php`, `AnimalFeed.php`, `EthanolDistilleries.php`, `StorageTerminal.php`, `edibleoil.php`, `flour_rice_dal_mill.php` — all HTTP 200, presumably indexed). That legacy site promotes different verticals (process industries) than the new site (construction/manufacturing/fabrication/SME). Consequences: (a) the domain cutover is a **site replacement**, not a fresh launch — it needs the redirect map below and a content decision on whether any legacy vertical pages should be recreated as CMS/location pages; (b) `app.perfecterp.com` does not resolve publicly, so the ERP's home needs confirming before login CTAs can point at the official domain.

Legacy → new redirect seed map (loaded into the `redirects` table at cutover):

| Legacy URL | Suggested target |
|---|---|
| `/index.php`, `/` | `/` |
| `/about.php` | `/about` (new CMS page) or `/` |
| `/contact.php` | `/#contact` or new `/contact` CMS page |
| `/privacy.php` | `/privacy` (new CMS page — also fixes today's `#` footer placeholder) |
| `/AnimalFeed.php`, `/EthanolDistilleries.php`, `/StorageTerminal.php`, `/edibleoil.php`, `/flour_rice_dal_mill.php` | nearest `/industries/*` page, or dedicated CMS pages if those verticals still sell |

1. **Repo hygiene (day 1):** remove `dist/` from git index; normalize file encodings to UTF-8-no-BOM with mojibake repaired; add `.nvmrc` (Node ≥22); branch protection on `main`.
2. **Supabase bootstrap:** create projects (staging/prod); `supabase link` + apply migrations; seed roles and the first administrator; storage buckets + policies.
3. **Content seeding script** (one-off, `scripts/seed-from-repo.ts` run locally): parses `index.astro`, `pricing.astro`, `industries/*`, `help/*.md` → creates `pages` + `page_seo` rows (porting today's titles/descriptions), `kb_articles` (Markdown → editor JSON), homepage copy blocks → settings/banner placeholders. **Encoding repair runs here** with a human review diff for every fixed string.
4. **Parity cutover per route:** each public route switches from hardcoded to DB-driven behind a visual-regression check (screenshot diff vs production). `/help/*` slugs preserved; any change gets a `redirects` row.
5. **Analytics:** apply the delivered patch (or its Phase-0 successor) with settings-driven IDs; verify events in Umami realtime.
6. **Domain cutover (when the official domain is chosen):** point DNS at Vercel, load the legacy redirect map, verify old `.php` URLs 301 correctly, submit the new sitemap in GSC, monitor 404s for two weeks.
7. **Go-live checklist:** robots.txt live, sitemap correct, canonical absolute, OG image set, GSC verification staged for the official domain, re-run this project's SEO-audit notebook against production (target ≥ 90/100), 404/redirect sweep.
8. **Rollback:** per-route feature flags (`CONTENT_SOURCE=db|static`) allow instant revert to the last static build for any route during cutover.

---

## 14. What remains before implementation

The approval gate has resolved the architecture. Outstanding items, in order:

1. **Owner review of this document** → then approve Phase 0 (currently **ON HOLD** per D6).
2. **Confirm the ERP stack & Supabase usage (D3)** — needs ERP repo access, hosting dashboard, or the ERP developer; the public probe was inconclusive (see Decision log). The design works under either answer; this only finalizes project topology and the Phase-7 integration path.
3. **Pick the canonical brand & launch domain (D4)** — BillFast vs Perfect ERP vs Origin-ERP, and when `perfecterp.com` (or another domain) replaces the legacy PHP site. Needed before content seeding; everything brand-related is settings-driven afterwards.
4. When approved: **start Phase 0** (§11) — first tasks are Supabase bootstrap + repo hygiene; the ERP-stack confirmation runs in parallel and does not block the foundation.

---

## Appendix A — Evidence & sources

1. Repo clone & inspection of `github.com/varankeerthi-dev/astro` (2026-08-06): file tree, `package.json`/`package-lock.json` versions, all page/layout sources, `.env` key names, git-tracked `dist/`, mojibake counts, BOM bytes.
2. Live SEO audit of `https://astro-wheat-eight.vercel.app` (this project's notebook): 69/100 scorecard, missing robots/canonical/OG/JSON-LD, thin copy.
3. Astro docs — *On-demand rendering* (per-route prerender control, server endpoints): https://docs.astro.build/en/guides/on-demand-rendering/
4. Supabase docs — *Storage Image Transformations* (resize/quality params, imgproxy backend): https://supabase.com/docs/guides/storage/serving/image-transformations
5. Microsoft Learn — *Clarity client API* (events, custom tags, consent API, masking defaults): https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api
6. Delivered analytics patch & setup guide: `origin-erp-analytics-patch.zip`, `analytics-patch/ANALYTICS-SETUP.md` (project outputs).
7. D3 public probe (2026-08-06): DNS/HTTP fingerprint of `app.perfecterp.com` (does not resolve) and `perfecterp.com` legacy PHP site inventory (page list in §13).

*Note: web search was unavailable (provider quota) during authoring; third-party library versions in D5 are pinned at implementation time against current releases.*

## Appendix B — Proposed folder structure (delta on today's repo)

```
src/
  layouts/Layout.astro            (extended: <Seo>, settings, analytics, announcements bar)
  layouts/AdminLayout.astro       (new)
  components/
    seo/Seo.astro · JsonLd.astro
    public/BannerCarousel.astro · AnnouncementBar.astro · LocationCard.astro …
    admin/ (React) DataTable.tsx · RichEditor.tsx · MediaPicker.tsx · SeoFields.tsx
           SerpPreview.tsx · SocialPreview.tsx · SeoScore.tsx · DragList.tsx …
  lib/
    supabase/{client.ts, server.ts, admin.ts}
    cms/{banners.ts, announcements.ts, pages.ts, blog.ts, kb.ts, media.ts, releases.ts}
    seo/{score.ts, jsonld.ts} · auth/{permissions.ts, session.ts} · utils/{slug.ts, sanitize.ts}
  pages/
    index.astro · pricing.astro · industries/[slug].astro · [slug].astro
    locations/[slug].astro · blog/{index,[slug],category/[slug]}.astro
    help/{index,[slug],release-notes}.astro
    admin/*.astro (per §5.2)
    api/admin/*.ts · api/cron/publish-due.ts · api/webhooks/erp.ts
    sitemap.xml.ts · robots.txt.ts
  middleware.ts                   (auth guard + preview + redirects)
supabase/
  migrations/0001_…sql … 0010_rls.sql
  seed.sql
scripts/seed-from-repo.ts         (one-off migration + mojibake repair)
```

## Appendix C — Environment variables

| Var | Scope | Purpose |
|---|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | build+runtime | Public data reads (RLS-filtered) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin endpoints (never shipped to browser) |
| `PREVIEW_SECRET` | server only | Signs preview cookies |
| `ERP_WEBHOOK_SECRET` / `ERP_BASE_URL` | server only | Outbound feature-release webhooks |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` | server only | Cache-tag purge on publish |
| `PUBLIC_APP_URL` | build+runtime | ERP login links (exists today) |
| `PUBLIC_UMAMI_WEBSITE_ID` / `PUBLIC_CLARITY_PROJECT_ID` | build fallback | Analytics (settings override) |
| `CONTENT_SOURCE` | build | `db`/`static` per-route rollback flag |

*End of document — v1.1. D1/D2 decided; D3 investigated (inconclusive publicly); implementation on hold pending owner review.*
