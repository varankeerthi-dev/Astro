import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().default('Perfect ERP Team'),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const help = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/help' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    lastUpdated: z.string().optional(),
  }),
});

export const collections = { blog, help };