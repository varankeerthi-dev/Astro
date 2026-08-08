-- 0006_locations.sql — Phase 4 location landing pages
-- One row = one SEO landing page like "ERP Software Chennai" (/locations/erp-software-chennai).

create table if not exists public.location_pages (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.pages(id) on delete set null,  -- slug + SEO via page_seo
  city text not null,
  state text not null,
  hero_heading text,
  hero_subheading text,
  banner_media_id uuid references public.media_assets(id) on delete set null,
  description_rich jsonb,                 -- rich editor document (JSON)
  testimonials jsonb not null default '[]',   -- [{name, company, quote, rating}]
  faqs jsonb not null default '[]',           -- [{q, a}] → rendered as FAQPage JSON-LD
  contact jsonb,                          -- {phone, email, address}
  map_embed_url text,
  cta_label text,
  cta_url text,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists location_pages_lookup on public.location_pages (city, state)
  where deleted_at is null;
create index if not exists location_pages_public_idx on public.location_pages (status, publish_at)
  where deleted_at is null;
