import { readFileSync } from 'node:fs';
function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8');
    for (const line of txt.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();
const { Pool } = await import('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`select tablename from pg_tables where schemaname = 'public' order by tablename`);
console.log('tables (' + r.rowCount + '): ' + r.rows.map((x) => x.tablename).join(', '));
for (const t of ['sessions', 'users', 'profiles', 'kb_articles']) {
  const c = await pool.query(`select count(*) as n from public.${t}`);
  console.log(t + ':', c.rows[0].n);
}
await pool.end();
process.exit(0);
