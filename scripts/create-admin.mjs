// Creates or updates an admin user in the Neon database (replaces Supabase
// Auth's admin user creation).
//
// Usage:
//   node scripts/create-admin.mjs <email> <password> [full-name]
//   EMAIL=you@example.com PASSWORD=... node scripts/create-admin.mjs
//
// Reads DATABASE_URL from .env (or the environment).
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';

function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
    for (const line of txt.split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env — rely on real env */
  }
}

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (put it in .env or the environment).');
  process.exit(1);
}

const [emailArg, passwordArg, nameArg] = process.argv.slice(2);
const email = (process.env.ADMIN_EMAIL || emailArg || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || passwordArg || '';
const fullName = process.env.ADMIN_FULL_NAME || nameArg || '';

if (!email || password.length < 8) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [full-name]');
  console.error('  password must be at least 8 characters');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
const passwordHash = `scrypt$${salt}$${hash}`;

const pool = new Pool({ connectionString: url });
try {
  await pool.query('begin');
  const { rows } = await pool.query(
    `insert into public.users (email, password_hash, full_name, role)
     values ($1, $2, $3, 'administrator')
     on conflict (email) do update set password_hash = excluded.password_hash, role = 'administrator', full_name = excluded.full_name
     returning id, email, role`,
    [email, passwordHash, fullName],
  );
  const user = rows[0];
  await pool.query(
    `insert into public.profiles (id, full_name, role)
     values ($1, $2, 'administrator')
     on conflict (id) do update set full_name = excluded.full_name, role = 'administrator'`,
    [user.id, fullName],
  );
  await pool.query('commit');
  console.log(`Admin ready: ${user.email} (${user.role}) — you can now sign in at /admin/login`);
} catch (e) {
  await pool.query('rollback').catch(() => {});
  console.error('Failed:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
