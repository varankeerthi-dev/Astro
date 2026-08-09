// Neon Postgres data layer (replaces Supabase). Single shared pool via
// @neondatabase/serverless — its Pool/Client are API-compatible with
// node-postgres, so every call below is plain parameterized SQL.
//
// The app connects as the database owner, so RLS is bypassed in practice;
// the public-vs-draft separation is enforced explicitly in lib/cms/query.ts
// (mirroring what the old Supabase anon policies allowed).
import { Pool } from '@neondatabase/serverless';

function env(name: string): string | undefined {
  const meta = import.meta.env as Record<string, string | undefined>;
  const proc = process.env as Record<string, string | undefined>;
  return meta[name] ?? proc[name];
}

export const DATABASE_URL = env('DATABASE_URL');
/** True when the DB is configured (equivalent of the old cmsServerReady). */
export const dbReady = Boolean(DATABASE_URL);

if (!dbReady) {
  console.warn('[db] DATABASE_URL not set — CMS routes will render fallbacks / 503.');
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
    pool.on('error', (err) => console.error('[db] idle client error', err.message));
  }
  return pool;
}

export interface Row {
  [key: string]: unknown;
}

/** Run a SELECT / DML statement and return the resulting rows. */
export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

/** First row or null (replaces supabase .maybeSingle()). */
export async function queryOne<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a statement and return the affected row count. */
export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const res = await getPool().query(text, params as never[]);
  return res.rowCount ?? 0;
}

/** One row, throwing if none (replaces supabase .single()). */
export async function querySingle<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T> {
  const row = await queryOne<T>(text, params);
  if (!row) throw new Error('not_found');
  return row;
}

/**
 * Run `fn` inside a transaction. `q` executes statements on the same client
 * (BEGIN/COMMIT/ROLLBACK). Replaces the multi-statement atomic writes that
 * Supabase PostgREST offered (article + page + SEO, feedback + counter).
 */
export async function withTx<T>(
  fn: (q: (text: string, params?: unknown[]) => Promise<Row[]>) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(async (text, params = []) => {
      const res = await client.query(text, params as never[]);
      return res.rows as Row[];
    });
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection-level failure — nothing to roll back */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Identifiers from our own configs are interpolated; this guards typos. */
export function safeIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return name;
}
