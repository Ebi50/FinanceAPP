/**
 * Setzt das Passwort eines Nutzers direkt in der Datenbank.
 *
 *   npm run set-password -- <email>
 *   npm run set-password -- <email> --create      (Nutzer anlegen, falls neu)
 *
 * Ersetzt den Passwort-Reset per E-Mail. Braucht DATABASE_URL (aus .env).
 */
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(query, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    // Prompt ist schon geschrieben — ab hier die Eingabe nicht mehr spiegeln.
    rl._writeToOutput = () => {};
  });
}

async function main() {
  const args = process.argv.slice(2);
  const create = args.includes('--create');
  const email = args.find((arg) => !arg.startsWith('--'));

  if (!email) {
    console.error('Aufruf: npm run set-password -- <email> [--create]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist nicht gesetzt (.env prüfen).');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=(require|verify-ca|verify-full|no-verify)/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
  });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT id, email FROM profiles WHERE lower(email) = lower($1)', [email]);

    if (rows.length === 0 && !create) {
      console.error(`Kein Nutzer mit der E-Mail ${email}. Mit --create anlegen.`);
      process.exit(1);
    }

    const password = await askHidden(`Neues Passwort für ${email}: `);
    if (password.length < 8) {
      console.error('Das Passwort muss mindestens 8 Zeichen lang sein.');
      process.exit(1);
    }
    const repeat = await askHidden('Passwort wiederholen: ');
    if (password !== repeat) {
      console.error('Die Passwörter stimmen nicht überein.');
      process.exit(1);
    }

    const hash = await hashPassword(password);

    if (rows.length === 0) {
      const inserted = await client.query(
        'INSERT INTO profiles (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, hash]
      );
      console.log(`Nutzer angelegt: ${email} (${inserted.rows[0].id})`);
    } else {
      await client.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
      // Ein Passwortwechsel meldet alle bestehenden Sitzungen ab.
      await client.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
      console.log(`Passwort gesetzt für ${rows[0].email} (${rows[0].id}); alle Sitzungen beendet.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
