import { Pool, types } from 'pg';

// numeric (OID 1700) arrives as a string by default — the whole app calculates
// with numbers, so parse it here once instead of at every call site.
types.setTypeParser(1700, (value: string) => parseFloat(value));

function sslOption() {
  const url = process.env.DATABASE_URL ?? '';
  const mode = (process.env.DATABASE_SSL ?? '').toLowerCase();

  if (mode === 'disable') return false;
  if (mode === 'require' || mode === 'no-verify') return { rejectUnauthorized: false };
  if (/sslmode=(require|prefer|verify-ca|verify-full|no-verify)/.test(url)) {
    return { rejectUnauthorized: false };
  }
  // Railway private network and local Postgres: no TLS.
  return false;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL ist nicht gesetzt.');
  }

  return new Pool({
    connectionString,
    // Next.js can open several pools across hot reloads; keep each one small.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslOption(),
  });
}

// Survive hot reloads in development, otherwise every reload leaks a pool.
const globalForPool = globalThis as unknown as { __finanzappPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__finanzappPool) {
    const pool = createPool();
    pool.on('error', (err) => console.error('[db] idle client error:', err));
    globalForPool.__finanzappPool = pool;
  }
  return globalForPool.__finanzappPool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs fn inside a database transaction and always releases the client. */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection is already broken — nothing to roll back
    }
    throw err;
  } finally {
    client.release();
  }
}
