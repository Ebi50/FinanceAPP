import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/server/auth';
import { authed } from '@/lib/server/http';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Deletes the account. Transactions and categories stay in place (user_id
 * becomes NULL), because the household data belongs to both users.
 */
export async function DELETE() {
  return authed(async (user) => {
    await query('DELETE FROM profiles WHERE id = $1', [user.id]);

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);

    return NextResponse.json({ ok: true });
  });
}
