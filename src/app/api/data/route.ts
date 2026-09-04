import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { authed, parsed } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const yearSchema = z.coerce.number().int().min(1970).max(2200);
const monthSchema = z.coerce.number().int().min(0).max(11);

/**
 * Deletes the current user's transactions in a period. Like the RLS rules
 * before, other household members' rows are left untouched.
 */
export async function DELETE(request: Request) {
  return authed(async (user) => {
    const url = new URL(request.url);
    const year = parsed(yearSchema.safeParse(url.searchParams.get('year')));
    const monthParam = url.searchParams.get('month');
    const month = monthParam === null || monthParam === 'all'
      ? null
      : parsed(monthSchema.safeParse(monthParam));

    const start = month === null
      ? new Date(Date.UTC(year, 0, 1))
      : new Date(Date.UTC(year, month, 1));
    const end = month === null
      ? new Date(Date.UTC(year + 1, 0, 1))
      : new Date(Date.UTC(year, month + 1, 1));

    const rows = await query(
      `DELETE FROM transactions
        WHERE user_id = $1 AND date >= $2 AND date < $3
      RETURNING id`,
      [user.id, start.toISOString(), end.toISOString()]
    );

    return NextResponse.json({ deleted: rows.length });
  });
}
