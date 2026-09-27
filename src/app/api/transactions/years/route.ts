import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authed } from '@/lib/server/http';
import { HOUSEHOLD_TIME_ZONE } from '@/lib/server/transactions';

export const dynamic = 'force-dynamic';

/** Years that actually contain transactions — used by the settings page. */
export async function GET() {
  return authed(async () => {
    const rows = await query<{ year: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM date AT TIME ZONE '${HOUSEHOLD_TIME_ZONE}')::int AS year
         FROM transactions
        ORDER BY year DESC`
    );
    return NextResponse.json({ data: rows.map((row) => row.year) });
  });
}
