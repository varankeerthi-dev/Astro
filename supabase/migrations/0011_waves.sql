-- 0011_waves.sql — Waves 1–7 supporting changes
-- Editor v1 stores Markdown in content_md; content_json (TipTap document) stays
-- reserved for the future rich editor, so no re-migration is needed later.

alter table public.kb_articles    add column if not exists content_md text;
alter table public.blog_posts     add column if not exists content_md text;
alter table public.location_pages add column if not exists description_md text;

-- Registry rows for the new public indexes (keeps sitemap.xml + SEO management complete)
insert into public.pages (slug, title, page_type, status) values
  ('/blog',               'Blog',          'blog', 'published'),
  ('/help/release-notes', 'Release Notes', 'help', 'published')
on conflict do nothing;

insert into public.page_seo (page_id, seo_title, meta_description, focus_keyword)
select p.id, v.seo_title, v.meta_description, v.focus_keyword
from public.pages p
join (values
  ('/blog',
   'Blog',
   'Product updates, guides, and stories from the Origin-ERP team.',
   'ERP blog'),
  ('/help/release-notes',
   'Release Notes',
   'What is new, improved, and fixed in each Origin-ERP release.',
   'release notes')
) as v(slug, seo_title, meta_description, focus_keyword) on v.slug = p.slug
on conflict (page_id) do nothing;
