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
  vite: {
    plugins: [tailwind()]
  }
});
// NOTE: @astrojs/sitemap was removed on purpose — /sitemap.xml is now a
// dynamic endpoint (src/pages/sitemap.xml.ts) so DB-driven routes are
// included automatically. You can `npm uninstall @astrojs/sitemap`.
