/**
 * Taegliches Backup der Haushaltsdaten aus der laufenden Datenbank (DATABASE_URL).
 * Ersetzt die (mit Supabase weggefallene) automatische taegliche Sicherung.
 *
 *   npm run backup:db
 *
 * Gedacht als Railway-Cron-Dienst: laeuft im privaten Netzwerk (keine oeffentliche
 * DB-Verbindung noetig), Startbefehl `node scripts/backup-db.mjs`, `DATABASE_URL`
 * als Variablen-Referenz auf den Postgres-Dienst, ein Volume gemountet und dessen
 * Pfad in `BACKUP_DIR` eingetragen. Genauso fuer gelegentliche manuelle Laeufe
 * gegen die lokal getunnelte DB nutzbar.
 *
 * Schreibt <BACKUP_DIR>/<zeitstempel>/*.json (eine Datei je Tabelle, vollstaendig,
 * menschenlesbar) + row-counts.txt. `sessions` wird bewusst NICHT gesichert
 * (Sitzungs-Tokens sind fluechtig und sicherheitsrelevant, nach einem Restore
 * meldet sich ohnehin jeder neu an).
 *
 * BACKUP_DIR              Zielverzeichnis, Standard "backups"
 * BACKUP_RETENTION_DAYS   Aeltere Backup-Ordner danach loeschen, Standard 30
 */
import 'dotenv/config';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
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

const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);

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

/** bytea kommt als Buffer aus pg — fuer lesbares JSON in Base64 wandeln. */
function toJsonSafe(table, rows) {
  if (table !== 'profiles') return rows;
  return rows.map((row) =>
    row.photo_data ? { ...row, photo_data: Buffer.from(row.photo_data).toString('base64') } : row
  );
}

async function pruneOld() {
  let entries;
  try {
    entries = await readdir(BACKUP_DIR, { withFileTypes: true });
  } catch {
    return; // Verzeichnis existiert noch nicht
  }
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = join(BACKUP_DIR, entry.name);
    const info = await stat(dirPath);
    if (info.mtimeMs < cutoff) {
      await rm(dirPath, { recursive: true, force: true });
      console.log(`  alten Backup-Ordner geloescht: ${entry.name}`);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL ist nicht gesetzt.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();

  const outDir = join(BACKUP_DIR, timestamp());
  await mkdir(outDir, { recursive: true });

  const counts = [];
  try {
    for (const { name, columns } of TABLES) {
      const { rows } = await client.query(
        `SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM ${name} ORDER BY 1`
      );
      await writeFile(join(outDir, `${name}.json`), JSON.stringify(toJsonSafe(name, rows), null, 2), 'utf8');
      counts.push(`${name}: ${rows.length} Zeilen`);
      console.log(`  ${name}: ${rows.length} Zeilen gesichert`);
    }
    await writeFile(join(outDir, 'row-counts.txt'), counts.join('\n') + '\n', 'utf8');
  } finally {
    await client.end();
  }

  await pruneOld();
  console.log('\nBackup fertig:', outDir);
}

main().catch((err) => {
  console.error('Backup fehlgeschlagen:', err);
  process.exit(1);
});
