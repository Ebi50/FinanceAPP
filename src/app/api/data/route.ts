import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { authed, parsed } from '@/lib/server/http';
import { HOUSEHOLD_TIME_ZONE } from '@/lib/server/transactions';

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
    // Period boundaries are local midnight in household time, not UTC.
    const local = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    const rows = await query(
      `DELETE FROM transactions
        WHERE user_id = $1
          AND date >= ($2::timestamp AT TIME ZONE '${HOUSEHOLD_TIME_ZONE}')
          AND date < ($3::timestamp AT TIME ZONE '${HOUSEHOLD_TIME_ZONE}')
      RETURNING id`,
      [user.id, local(start), local(end)]
    );

    return NextResponse.json({ deleted: rows.length });
  });
}
