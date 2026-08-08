-- seed.sql — initial content for the BillFast CMS
-- Run AFTER migrations 0001–0010. Idempotent (on conflict … do nothing / upserts).
--
-- First admin user (do this in the Supabase dashboard, then uncomment):
--   1. Authentication → Users → Add user (email + password)
--   2. update public.profiles set role = 'administrator'
--      where id = (select id from auth.users where email = 'you@example.com');

-- ── Website Settings (singleton) ────────────────────────────────────────────
-- Brand note: seeded with the site's current branding ("Origin-ERP") until
-- decision D4 (canonical brand) is made — everything here is editable in /admin/settings.
insert into public.site_settings (
  id, site_name, tagline, copyright_text,
  default_seo_title, default_seo_description, robots_txt
) values (
  1,
  'Origin-ERP',
  'The all-in-one business management platform',
  '© {year} Origin-ERP. All rights reserved.',
  'All-In-One SME ERP Software',
  'Origin-ERP - The all-in-one business management platform built for modern construction, manufacturing & trading companies.',
  E'User-agent: *\nAllow: /'
)
on conflict (id) do nothing;

-- ── Media folders ───────────────────────────────────────────────────────────
insert into public.media_folders (name, path) values
  ('Banners',   '/banners'),
  ('Blog',      '/blog'),
  ('Locations', '/locations'),
  ('Help',      '/help'),
  ('OG images', '/og-images'),
  ('Misc',      '/misc')
on conflict (path) do nothing;

-- ── Footer links (mirrors the current hardcoded footer; Legal rows start inactive) ──
insert into public.footer_links (column_name, label, url, display_order, is_active) values
  ('Product',   'Features',               '/#features',                            1, true),
  ('Product',   'Pricing',                '/pricing',                              2, true),
  ('Product',   'Login',                  'https://app.perfecterp.com/login',      3, true),
  ('Industries','Construction ERP',       '/industries/construction-erp',          1, true),
  ('Industries','Fabrication ERP',        '/industries/fabrication-erp',           2, true),
  ('Industries','Manufacturing ERP',      '/industries/manufacturing-erp',         3, true),
  ('Industries','Project Management ERP', '/industries/project-management-erp',    4, true),
  ('Industries','SME ERP',                '/industries/sme-erp-software',          5, true),
  ('Support',   'Help Center',            '/help',                                 1, true),
  ('Support',   'Contact Support',        '#',                                     2, false),  -- set URL in /admin/settings
  ('Legal',     'Privacy Policy',         '/privacy',                              1, false),  -- enable when the page exists
  ('Legal',     'Terms of Service',       '/terms',                                2, false)
on conflict do nothing;

-- ── KB categories (match the three cards on the current /help index) ────────
insert into public.kb_categories (name, slug, kind, palette_key, display_order) values
  ('Sales & Billing',        'sales-billing',        'user_guide', 'blue',    1),
  ('Field Operations',       'field-operations',     'user_guide', 'emerald', 2),
  ('Inventory & Operations', 'inventory-operations', 'user_guide', 'amber',   3)
on conflict (slug) do nothing;

-- ── Page registry + SEO records for every existing public route ─────────────
insert into public.pages (slug, title, page_type, status) values
  ('/',                                       'Home',                          'static', 'published'),
  ('/pricing',                                'Pricing',                       'static', 'published'),
  ('/industries/construction-erp',            'Construction ERP',              'static', 'published'),
  ('/industries/fabrication-erp',             'Fabrication ERP',               'static', 'published'),
  ('/industries/manufacturing-erp',           'Manufacturing ERP',             'static', 'published'),
  ('/industries/project-management-erp',      'Project Management ERP',        'static', 'published'),
  ('/industries/sme-erp-software',            'SME ERP Software',              'static', 'published'),
  ('/help',                                   'Help Center',                   'help',   'published'),
  ('/help/create-quotation',                  'Creating a Professional Quotation',        'help', 'published'),
  ('/help/inventory-transfer',                'Inventory Transfers Between Warehouses',   'help', 'published'),
  ('/help/project-billing',                   'Project Milestone Billing & Invoicing',    'help', 'published'),
  ('/help/site-visit-management',             'Site Visit Management & Field Operations', 'help', 'published')
on conflict do nothing;

-- SEO records (titles/descriptions ported from the current hardcoded pages)
insert into public.page_seo (page_id, seo_title, meta_description, focus_keyword)
select p.id, v.seo_title, v.meta_description, v.focus_keyword
from public.pages p
join (values
  ('/',
   'All-In-One SME ERP Software',
   'Origin-ERP - The all-in-one business management platform built for modern construction, manufacturing & trading companies.',
   'ERP software'),
  ('/pricing',
   'Pricing - Simple & Transparent Plans',
   'Choose the perfect Origin-ERP plan for your construction, fabrication, or manufacturing business. Start with a free 14-day trial.',
   'ERP pricing'),
  ('/industries/construction-erp',
   'ERP Software for Construction Companies',
   'Optimized project tracking, BOQ management, and site material tools for construction contractors.',
   'construction ERP software'),
  ('/industries/fabrication-erp',
   'ERP Software for Fabrication Shops',
   'Job estimation, material nesting checks, labor tracking, and work order invoicing for fabrication companies.',
   'fabrication ERP software'),
  ('/industries/manufacturing-erp',
   'ERP Software for SME Manufacturers',
   'Optimize manufacturing resources, manage BOMs, warehouse inventory, and invoice templates.',
   'manufacturing ERP software'),
  ('/industries/project-management-erp',
   'ERP for Project Management & Execution',
   'Track project milestones, schedule tasks, log daily site updates, and approve subcontractor invoices.',
   'project management ERP'),
  ('/industries/sme-erp-software',
   'SME ERP Software - Origin-ERP',
   'Affordable, easy-to-use ERP platform for growing trading, service, and engineering businesses.',
   'SME ERP software'),
  ('/help',
   'Help Center - Documentation & Guides',
   'Find step-by-step guides, user documentation, and FAQs for Origin-ERP. Learn how to manage projects, create quotes, and track inventory.',
   'ERP help'),
  ('/help/create-quotation',           'Creating a Professional Quotation',                 null, null),
  ('/help/inventory-transfer',         'Inventory Transfers Between Warehouses',            null, null),
  ('/help/project-billing',            'Project Milestone Billing & Invoicing',             null, null),
  ('/help/site-visit-management',      'Site Visit Management & Field Operations',          null, null)
) as v(slug, seo_title, meta_description, focus_keyword) on v.slug = p.slug
on conflict (page_id) do nothing;

-- ── Legacy perfecterp.com redirect map (activates the moment the domain flips) ──
-- These old PHP URLs are live and indexed today; without 301s the domain
-- cutover would turn them into 404s. Repoint targets in /admin as real pages appear.
insert into public.redirects (from_path, to_path, status_code, is_active) values
  ('/index.php',              '/',                                 301, true),
  ('/about.php',              '/',                                 301, true),  -- repoint to /about when the CMS page exists
  ('/contact.php',            '/',                                 301, true),  -- repoint to /contact when the CMS page exists
  ('/privacy.php',            '/',                                 301, true),  -- repoint to /privacy when the CMS page exists
  ('/AnimalFeed.php',         '/industries/manufacturing-erp',     301, true),
  ('/EthanolDistilleries.php','/industries/manufacturing-erp',     301, true),
  ('/StorageTerminal.php',    '/industries/manufacturing-erp',     301, true),
  ('/edibleoil.php',          '/industries/manufacturing-erp',     301, true),
  ('/flour_rice_dal_mill.php','/industries/manufacturing-erp',     301, true)
on conflict (from_path) do nothing;
