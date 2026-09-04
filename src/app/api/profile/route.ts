import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryOne } from '@/lib/db';
import { toSessionUser } from '@/lib/server/auth';
import { HttpError, authed, parsed, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({
  first_name: z.string().max(100).nullish(),
  last_name: z.string().max(100).nullish(),
  budget: z.number().finite().min(0).max(10_000_000).optional(),
  auto_logout_timeout: z.number().int().min(0).max(1440).optional(),
});

export async function PATCH(request: Request) {
  return authed(async (user) => {
    const input = parsed(schema.safeParse(await readJson(request)));

    const sets: string[] = [];
    const values: any[] = [];
    const set = (column: string, value: any) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (input.first_name !== undefined) set('first_name', input.first_name ?? '');
    if (input.last_name !== undefined) set('last_name', input.last_name ?? '');
    if (input.budget !== undefined) set('budget', input.budget);
    if (input.auto_logout_timeout !== undefined) {
      set('auto_logout_timeout', input.auto_logout_timeout);
    }
    if (sets.length === 0) throw new HttpError(400, 'Keine Änderungen übergeben.');

    values.push(user.id);
    const row = await queryOne(
      `UPDATE profiles SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, email, first_name, last_name, budget, auto_logout_timeout,
                 photo_data IS NOT NULL AS has_photo, photo_updated_at`,
      values
    );

    return NextResponse.json({ user: toSessionUser(row) });
  });
}
