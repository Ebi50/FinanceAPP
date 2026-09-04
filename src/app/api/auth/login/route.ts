import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryOne } from '@/lib/db';
import { createSession, toSessionUser, verifyPassword } from '@/lib/server/auth';
import { HttpError, parsed, readJson, route } from '@/lib/server/http';
import { clearFailures, isRateLimited, registerFailure } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return route(async () => {
    const body = parsed(schema.safeParse(await readJson(request)));
    const key = body.email.toLowerCase();

    if (isRateLimited(key)) {
      throw new HttpError(429, 'Zu viele Fehlversuche. Bitte später erneut versuchen.');
    }

    const profile = await queryOne(
      `SELECT id, email, password_hash, first_name, last_name, budget, auto_logout_timeout,
              photo_data IS NOT NULL AS has_photo, photo_updated_at
         FROM profiles
        WHERE lower(email) = $1`,
      [key]
    );

    const valid = await verifyPassword(body.password, profile?.password_hash ?? null);
    if (!profile || !valid) {
      registerFailure(key);
      throw new HttpError(401, 'Die Anmeldedaten sind nicht korrekt.');
    }

    clearFailures(key);
    await createSession(profile.id);

    return NextResponse.json({ user: toSessionUser(profile) });
  });
}
