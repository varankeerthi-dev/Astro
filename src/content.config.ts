import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog is DB-driven (src/pages/blog/* query Postgres via lib/cms/query.ts) —
// the content collection was removed so the glob-loader doesn't warn about
// the missing src/content/blog/ directory.

const help = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/help' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    lastUpdated: z.string().optional(),
  }),
});

export const collections = { help };
