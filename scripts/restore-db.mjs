/**
 * Spielt ein Backup aus backup-db.mjs zurueck in DATABASE_URL.
 *
 *   node scripts/restore-db.mjs backups/<zeitstempel>
 *
 * ON CONFLICT DO NOTHING: bestehende Zeilen werden nie ueberschrieben. Fuer eine
 * echte Wiederherstellung deshalb gegen eine LEERE Datenbank laufen lassen
 * (frisches Schema per `npm run db:schema`), nicht gegen eine mit vorhandenen Daten.
 * Am Ende werden die Zeilenzahlen aus dem Backup mit denen in der Datenbank
 * abgeglichen und bei Abweichung mit Fehler abgebrochen.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const TABLES = [
  {
    name: 'profiles',
    columns: [
      'id', 'email', 'password_hash', 'first_name', 'last_name', 'budget',
      'auto_logout_timeout', 'photo_data', 'photo_mime', 'photo_updated_at', 'created_at',
    ],
  },
  { name: 'expense_categories', columns: ['id', 'name', 'user_id', 'created_at'] },
  {
    name: 'transactions',
    columns: [
      'id', 'description', 'amount', 'date', 'category_id', 'user_id',
      'is_recurring', 'original_recurring_id', 'recurring_end_date', 'created_at', 'updated_at',
    ],
  },
  { name: 'transaction_items', columns: ['id', 'transaction_id', 'value', 'description'] },
];

const BATCH_SIZE = 500;

function sslFor(url) {
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal')) {
    return false;
  }
  return { rejectUnauthorized: false };
}

/** photo_data kam als Base64-String aus dem Backup — zurueck in ein Buffer/bytea. */
function fromJsonSafe(table, rows) {
  if (table !== 'profiles') return rows;
  return rows.map((row) =>
    row.photo_data ? { ...row, photo_data: Buffer.from(row.photo_data, 'base64') } : row
  );
}

async function insertRows(client, table, columns, rows) {
  if (rows.length === 0) return;
  const colList = columns.map((c) => `"${c}"`).join(', ');

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const slice = rows.slice(offset, offset + BATCH_SIZE);
    const params = [];
    const tuples = slice.map((row) => {
      const placeholders = columns.map((col) => {
        params.push(row[col] ?? null);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Aufruf: node scripts/restore-db.mjs <backup-verzeichnis>');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL ist nicht gesetzt.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();

  console.log(`Spiele Backup aus ${dir} zurueck:`);
  const expected = {};
  try {
    for (const { name, columns } of TABLES) {
      const rows = JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
      expected[name] = rows.length;
      await insertRows(client, name, columns, fromJsonSafe(name, rows));
      console.log(`  ${name}: ${rows.length} Zeilen eingespielt`);
    }

    console.log('\nAbgleich Backup vs. Datenbank:');
    let mismatch = false;
    for (const { name } of TABLES) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${name}`);
      const actual = rows[0].n;
      const mark = actual >= expected[name] ? 'ok' : 'FEHLT';
      if (actual < expected[name]) mismatch = true;
      console.log(`  ${name.padEnd(20)} Backup ${String(expected[name]).padStart(6)}  DB ${String(actual).padStart(6)}  ${mark}`);
    }
    if (mismatch) {
      console.error('\nMindestens eine Tabelle hat weniger Zeilen als im Backup.');
      process.exit(1);
    }
    console.log('\nWiederherstellung erfolgreich.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Wiederherstellung fehlgeschlagen:', err);
  process.exit(1);
});
