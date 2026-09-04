/**
 * Spielt db/schema.sql in die Datenbank aus DATABASE_URL ein.
 * Ersatz für `psql -f`, damit unter Windows kein psql installiert sein muss.
 *
 *   npm run db:schema
 *
 * Das Schema ist idempotent (CREATE TABLE IF NOT EXISTS), ein zweiter Lauf
 * ändert nichts.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist nicht gesetzt (.env prüfen).');
    process.exit(1);
  }

  const sql = await readFile(join(here, '..', 'db', 'schema.sql'), 'utf8');

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=(require|verify-ca|verify-full|no-verify)/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Schema eingespielt.');

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log('Tabellen:', rows.map((row) => row.table_name).join(', '));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
