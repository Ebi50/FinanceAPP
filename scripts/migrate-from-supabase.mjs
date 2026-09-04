/**
 * Einmalige Datenuebernahme Supabase -> neue Postgres-Datenbank (Railway/Neon).
 *
 *   npm run migrate:from-supabase
 *
 * Was das Skript macht:
 *   1. Liest ALLE Zeilen der vier Haushalts-Tabellen aus Supabase (nur SELECT,
 *      Supabase wird nie veraendert) und legt sie zusaetzlich als JSON unter
 *      backups/<zeitstempel>/ ab -- das ist zugleich das Rueckfall-Backup.
 *   2. Schreibt sie in die Ziel-Datenbank aus DATABASE_URL. Original-IDs bleiben
 *      erhalten (profiles.id und transactions.user_id muessen zusammenpassen).
 *      Die Spalte photo_url faellt weg (Avatare kommen per set-avatar zurueck).
 *   3. Ist beliebig oft wiederholbar (ON CONFLICT DO NOTHING) -- fuer den
 *      finalen Lauf am Umzugsabend.
 *   4. Vergleicht am Ende die Zeilenzahlen. Bei jeder Abweichung: Exit-Code 1.
 *
 * Voraussetzungen in .env:
 *   SUPABASE_DATABASE_URL   Connection-String aus dem Supabase-Dashboard
 *                           (Project Settings -> Database -> Connection string),
 *                           NICHT die NEXT_PUBLIC_SUPABASE_URL.
 *   DATABASE_URL            Ziel-Datenbank. Vorher einmal `npm run db:schema`.
 *
 * Kein Datenverlust moeglich: Quelle read-only, Ziel idempotent, Abgleich am Ende
 * erzwungen. Zeigt ein Verweis (user_id / category_id) ins Leere, wird die Zeile
 * NICHT verworfen, sondern mit NULL an dieser Stelle uebernommen und gemeldet.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

// Reihenfolge = Fremdschluessel-Reihenfolge. Die Spaltenliste gilt fuer Lesen
// (Supabase) und Schreiben (Ziel) gleichermassen; photo_url ist hier bewusst nicht
// dabei, sonst schlaegt der Insert ins neue Schema fehl.
const TABLES = [
  { name: 'profiles', columns: ['id', 'email', 'first_name', 'last_name', 'budget', 'auto_logout_timeout', 'created_at'] },
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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function sslFor(url) {
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal')) {
    return false;
  }
  return { rejectUnauthorized: false };
}

async function connect(label, url) {
  if (!url) {
    console.error(`${label} ist nicht gesetzt (.env pruefen).`);
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();
  return client;
}

/** Baut ein mehrzeiliges, parametrisiertes INSERT ... ON CONFLICT DO NOTHING. */
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
    process.stdout.write(`\r  ${table}: ${Math.min(offset + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  console.log('=== Datenuebernahme Supabase -> neue Datenbank ===\n');

  const source = await connect('SUPABASE_DATABASE_URL', process.env.SUPABASE_DATABASE_URL);
  const target = await connect('DATABASE_URL', process.env.DATABASE_URL);

  const outDir = join('backups', timestamp());
  await mkdir(outDir, { recursive: true });

  const data = {};
  const warnings = [];

  try {
    // ---- 1. Lesen + JSON-Backup -------------------------------------------------
    console.log('Lese aus Supabase (nur SELECT):');
    for (const { name, columns } of TABLES) {
      const { rows } = await source.query(
        `SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM public.${name} ORDER BY 1`
      );
      data[name] = rows;
      await writeFile(join(outDir, `${name}.json`), JSON.stringify(rows, null, 2), 'utf8');
      console.log(`  ${name}: ${rows.length} Zeilen`);
    }
    console.log(`\nJSON-Backup liegt in ${outDir}\n`);

    // ---- 2. Verweise pruefen (nichts verwerfen, nur NULLen + melden) -----------
    const profileIds = new Set(data.profiles.map((r) => r.id));
    const categoryIds = new Set(data.expense_categories.map((r) => r.id));
    const transactionIds = new Set(data.transactions.map((r) => r.id));

    for (const row of data.expense_categories) {
      if (row.user_id && !profileIds.has(row.user_id)) {
        warnings.push(`expense_categories ${row.id}: user_id ${row.user_id} unbekannt -> NULL`);
        row.user_id = null;
      }
    }
    for (const row of data.transactions) {
      if (row.user_id && !profileIds.has(row.user_id)) {
        warnings.push(`transactions ${row.id}: user_id ${row.user_id} unbekannt -> NULL`);
        row.user_id = null;
      }
      if (row.category_id && !categoryIds.has(row.category_id)) {
        warnings.push(`transactions ${row.id}: category_id ${row.category_id} unbekannt -> NULL`);
        row.category_id = null;
      }
    }
    const orphanItems = data.transaction_items.filter((r) => !transactionIds.has(r.transaction_id));
    if (orphanItems.length > 0) {
      console.error(`\nABBRUCH: ${orphanItems.length} transaction_items ohne zugehoerige Transaktion.`);
      console.error('Das JSON-Backup ist geschrieben. Bitte diese Zeilen pruefen:');
      orphanItems.forEach((r) => console.error(`  item ${r.id} -> transaction_id ${r.transaction_id}`));
      process.exit(1);
    }

    // ---- 3. Schreiben ins Ziel -----------------------------------------------
    console.log('Schreibe in die Ziel-Datenbank (ON CONFLICT DO NOTHING):');
    for (const { name, columns } of TABLES) {
      await insertRows(target, name, columns, data[name]);
    }

    if (warnings.length > 0) {
      console.log(`\n${warnings.length} Verweis(e) ins Leere korrigiert:`);
      warnings.forEach((w) => console.log(`  ${w}`));
    }

    // ---- 4. Zeilenzahlen abgleichen ----------------------------------------
    console.log('\nAbgleich Supabase vs. Ziel:');
    let mismatch = false;
    for (const { name } of TABLES) {
      const src = data[name].length;
      const { rows } = await target.query(`SELECT count(*)::int AS n FROM ${name}`);
      const dst = rows[0].n;
      const mark = dst >= src ? 'ok' : 'FEHLT';
      if (dst < src) mismatch = true;
      console.log(`  ${name.padEnd(20)} Supabase ${String(src).padStart(6)}  Ziel ${String(dst).padStart(6)}  ${mark}`);
    }

    if (mismatch) {
      console.error('\nMindestens eine Tabelle hat im Ziel weniger Zeilen. NICHT umschalten.');
      process.exit(1);
    }
    console.log('\nFertig. Zeilenzahlen stimmen. Naechste Schritte: db/README.md, Abschnitt 5 (Passwoerter, Avatare).');
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error('\nMigration fehlgeschlagen:', err);
  process.exit(1);
});
