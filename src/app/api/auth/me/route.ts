import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth';
import { route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return route(async () => {
    // Returns 200 with user: null when nobody is signed in — the client treats
    // that as "show the login page", not as an error.
    return NextResponse.json({ user: await getSessionUser() });
  });
}
