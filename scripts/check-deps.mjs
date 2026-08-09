#!/usr/bin/env node
// Verifies every bare (non-relative) import used in src/ is declared in
// package.json dependencies. Catches the "works locally but fails on a fresh
// install (Vercel)" bug class: e.g. @neondatabase/serverless and sharp were
// in node_modules/lockfile but missing from package.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|mjs|js|astro)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(join(root, 'src'));
const specifiers = new Set();
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const re = /(?:from\s+|import\s+|require\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) specifiers.add(m[1]);
}

const missing = [...specifiers]
  .filter((s) => !s.startsWith('.') && !s.startsWith('/'))
  .map((s) => s.split('/')[0].startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0])
  .filter((s) => !declared.has(s))
  .filter((s) => !s.startsWith('node:') && !s.startsWith('astro:'))
  .sort();

if (missing.length) {
  console.error('MISSING from package.json:');
  for (const s of missing) console.error('  ' + s);
  process.exit(1);
}
console.log(`check-deps: all ${specifiers.size} unique bare imports resolved by package.json (${files.length} files).`);
