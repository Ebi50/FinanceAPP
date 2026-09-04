import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/server/auth';
import { route } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function POST() {
  return route(async () => {
    await destroyCurrentSession();
    return NextResponse.json({ ok: true });
  });
}
