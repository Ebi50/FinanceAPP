import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query, queryOne } from '@/lib/db';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = 'finanzapp_session';
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

// ---------------------------------------------------------------- passwords

/** Format: scrypt$<salt-hex>$<hash-hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- sessions

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  budget: number;
  autoLogoutTimeout: number;
  photoURL: string;
  displayName: string;
}

/** Creates a session row and sets the cookie. Returns the raw token. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expiresAt.toISOString(),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  // Opportunistic cleanup — the table stays tiny for two users.
  await query('DELETE FROM sessions WHERE expires_at < now()');

  return token;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Removes every session of a user except the one behind the current cookie. */
export async function destroyOtherSessions(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  await query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [
    userId,
    token ? hashToken(token) : '',
  ]);
}

export function toSessionUser(row: {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  budget: number | null;
  auto_logout_timeout: number | null;
  has_photo?: boolean;
  photo_updated_at?: Date | string | null;
}): SessionUser {
  const firstName = row.first_name ?? '';
  const lastName = row.last_name ?? '';
  const photoVersion = row.photo_updated_at
    ? new Date(row.photo_updated_at).getTime()
    : 0;

  return {
    id: row.id,
    email: row.email,
    firstName,
    lastName,
    budget: row.budget ?? 2000,
    autoLogoutTimeout: row.auto_logout_timeout ?? 0,
    photoURL: row.has_photo ? `/api/avatar/${row.id}?v=${photoVersion}` : '',
    displayName: [firstName, lastName].filter(Boolean).join(' ') || row.email || '',
  };
}

/** Returns the signed-in user, or null. Every route handler must call this itself. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne(
    `SELECT p.id, p.email, p.first_name, p.last_name, p.budget, p.auto_logout_timeout,
            p.photo_data IS NOT NULL AS has_photo, p.photo_updated_at
       FROM sessions s
       JOIN profiles p ON p.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );

  return row ? toSessionUser(row) : null;
}
