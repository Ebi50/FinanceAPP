import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { destroyOtherSessions, hashPassword, verifyPassword } from '@/lib/server/auth';
import { HttpError, authed, parsed, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  return authed(async (user) => {
    const body = parsed(schema.safeParse(await readJson(request)));

    const row = await queryOne('SELECT password_hash FROM profiles WHERE id = $1', [user.id]);
    if (!(await verifyPassword(body.currentPassword, row?.password_hash ?? null))) {
      throw new HttpError(400, 'Das aktuelle Passwort ist nicht korrekt.');
    }

    await query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [
      await hashPassword(body.newPassword),
      user.id,
    ]);

    // A password change invalidates sessions on other devices.
    await destroyOtherSessions(user.id);

    return NextResponse.json({ ok: true });
  });
}
