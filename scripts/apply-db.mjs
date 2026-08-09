import { Client } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const env = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
const url = env.split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='))?.slice(13) ?? '';
const dir = process.argv[2] || 'supabase/migrations';
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const c = new Client(url);
await c.connect();
for (const f of files) {
  try { await c.query(readFileSync(join(dir, f), 'utf8')); console.log('OK  ', f); }
  catch (e) { console.log('FAIL', f, '-', e.message); await c.end(); process.exit(1); }
}
await c.end();
console.log('DONE');
