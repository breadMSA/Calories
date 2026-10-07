// Database access. Uses Neon's HTTP driver in production (DATABASE_URL) and an
// embedded PGlite instance for local development so no cloud setup is required.

import { neon } from '@neondatabase/serverless';
import { SCHEMA, SCHEMA_VERSION } from './schema.js';

type Row = Record<string, any>;
type QueryFn = (text: string, params?: unknown[]) => Promise<Row[]>;

let queryFn: QueryFn | null = null;
let ready: Promise<void> | null = null;

async function createQueryFn(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = neon(url);
    return (text, params = []) => sql.query(text, params) as Promise<Row[]>;
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not configured');
  }
  // Module name is held in a variable so the deployment bundler does not trace this dev-only dependency.
  const pgliteModule = '@electric-sql/pglite';
  const { PGlite } = await import(/* @vite-ignore */ pgliteModule);
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const dir = process.env.PGLITE_DIR || '.data/pglite';
  // Reuse one instance across dev-server module reloads; two instances must not open the same directory.
  const g = globalThis as { __pglite?: InstanceType<typeof PGlite> };
  if (!g.__pglite) {
    mkdirSync(dirname(dir), { recursive: true });
    g.__pglite = new PGlite(dir);
  }
  const db = g.__pglite;
  return async (text, params = []) => (await db.query(text, params)).rows as Row[];
}

async function init(): Promise<void> {
  const q = await createQueryFn();
  // Skip the DDL round trips on cold starts once the schema is current.
  const current = await q(
    `SELECT CASE WHEN to_regclass('public.schema_meta') IS NULL THEN 0
       ELSE (SELECT coalesce(max(version), 0) FROM schema_meta) END AS version`,
  ).catch(() => [{ version: 0 }]);
  if (Number(current[0]?.version) < SCHEMA_VERSION) {
    for (const statement of SCHEMA) await q(statement);
    await q('CREATE TABLE IF NOT EXISTS schema_meta (version integer NOT NULL)');
    await q('DELETE FROM schema_meta');
    await q('INSERT INTO schema_meta (version) VALUES ($1)', [SCHEMA_VERSION]);
  }
  queryFn = q;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!ready) {
    ready = init().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  return (await queryFn!(text, params)) as T[];
}

export async function queryOne<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
