import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://perfecterp.com',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwind()]
  }
});