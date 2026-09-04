/**
 * Sichert alle Haushaltsdaten aus Supabase auf die lokale Festplatte, bevor an
 * der Migration weitergearbeitet wird. Reines Lesen (nur SELECT) — verändert
 * bei Supabase nichts.
 *
 * Braucht SUPABASE_DATABASE_URL in .env (die Postgres-Connection-String aus
 * dem Supabase-Dashboard, NICHT die NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).
 *
 *   npm run backup:supabase
 *
 * Ergebnis: backups/<Zeitstempel>/*.json (eine Datei je Tabelle, vollständig,
 * menschenlesbar) + row-counts.txt zum Abgleich nach dem Import.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const TABLES = ['profiles', 'expense_categories', 'transactions', 'transaction_items'];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error('SUPABASE_DATABASE_URL ist nicht gesetzt (.env prüfen).');
    console.error('Zu finden im Supabase-Dashboard: Project Settings → Database → Connection string.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase verlangt TLS
  });

  console.log('Verbinde mit Supabase …');
  await client.connect();

  const outDir = join('backups', timestamp());
  await mkdir(outDir, { recursive: true });

  const counts = [];

  try {
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT * FROM public.${table} ORDER BY 1`);
      await writeFile(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
      counts.push(`${table}: ${rows.length} Zeilen`);
      console.log(`  ${table}: ${rows.length} Zeilen gesichert`);
    }

    // Best-effort: auth.users (id + email) — für den Abgleich der User-IDs beim
    // Import. Schlägt ohne Superuser-Rechte fehl; dann bitte manuell im
    // Supabase SQL-Editor holen (select id, email from auth.users;).
    try {
      const { rows: authUsers } = await client.query('SELECT id, email FROM auth.users ORDER BY email');
      await writeFile(join(outDir, 'auth_users.json'), JSON.stringify(authUsers, null, 2), 'utf8');
      counts.push(`auth.users: ${authUsers.length} Zeilen`);
      console.log(`  auth.users: ${authUsers.length} Zeilen gesichert`);
    } catch (err) {
      console.warn('  auth.users konnte nicht gelesen werden (kein Superuser-Zugriff über diese Connection).');
      console.warn('  Bitte manuell im Supabase SQL-Editor holen: select id, email from auth.users;');
    }

    await writeFile(join(outDir, 'row-counts.txt'), counts.join('\n') + '\n', 'utf8');

    console.log('\nFertig. Backup liegt in:', outDir);
    console.log('Diese Zeilenzahlen nach dem Import in die neue Datenbank gegenprüfen.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Backup fehlgeschlagen:', err);
  process.exit(1);
});
