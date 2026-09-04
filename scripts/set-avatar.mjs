/**
 * Legt ein Profilbild direkt in der Datenbank ab (profiles.photo_data).
 * Gedacht für die Übernahme der beiden Bilder aus dem Supabase-Storage.
 *
 *   node scripts/set-avatar.mjs <email> <pfad-zur-bilddatei>
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import pg from 'pg';

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

async function main() {
  const [email, filePath] = process.argv.slice(2);

  if (!email || !filePath) {
    console.error('Aufruf: node scripts/set-avatar.mjs <email> <bilddatei>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist nicht gesetzt (.env prüfen).');
    process.exit(1);
  }

  const mime = MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
  if (!mime) {
    console.error('Unbekannter Dateityp. Erlaubt: jpg, jpeg, png, gif, webp.');
    process.exit(1);
  }

  const bytes = await readFile(filePath);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=(require|verify-ca|verify-full|no-verify)/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
  });
  await client.connect();

  try {
    const { rowCount } = await client.query(
      `UPDATE profiles SET photo_data = $1, photo_mime = $2, photo_updated_at = now()
        WHERE lower(email) = lower($3)`,
      [bytes, mime, email]
    );

    if (rowCount === 0) {
      console.error(`Kein Nutzer mit der E-Mail ${email}.`);
      process.exit(1);
    }
    console.log(`Profilbild gesetzt für ${email} (${bytes.length} Bytes, ${mime}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
