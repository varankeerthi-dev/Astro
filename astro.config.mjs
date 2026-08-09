import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';

// https://docs.astro.build/en/guides/on-demand-rendering/
// Pages stay prerendered by default; CMS-driven routes opt into on-demand
// rendering with `export const prerender = false` (see PHASE0-SETUP.md).
export default defineConfig({
  site: 'https://perfecterp.com',
  adapter: vercel(),
  integrations: [react()],
  security: {
    // The CMS admin (/admin, /api/admin) is protected by its own session-cookie
    // auth guard in src/middleware.ts; the public feedback/search endpoints
    // accept cross-origin POSTs by design. Astro's default Origin check would
    // 403 every server-rendered admin form POST (e.g. /admin/login), so it is
    // disabled here — CSRF protection for admin mutations is handled by the
    // httpOnly session cookie + SameSite=Lax.
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwind()]
  }
});
// NOTE: @astrojs/sitemap was removed on purpose — /sitemap.xml is now a
// dynamic endpoint (src/pages/sitemap.xml.ts) so DB-driven routes are
// included automatically. You can `npm uninstall @astrojs/sitemap`.
