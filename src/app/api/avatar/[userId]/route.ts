import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { HttpError, authed } from '@/lib/server/http';
import { requireUuid } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ userId: string }> };

/** Serves the avatar stored as bytea. Signed-in users only (shared household). */
export async function GET(_request: Request, { params }: Params) {
  return authed(async () => {
    const userId = requireUuid((await params).userId, 'Nutzer-ID');

    const row = await queryOne<{ photo_data: Buffer | null; photo_mime: string | null }>(
      'SELECT photo_data, photo_mime FROM profiles WHERE id = $1',
      [userId]
    );
    if (!row?.photo_data) throw new HttpError(404, 'Kein Profilbild vorhanden.');

    return new NextResponse(new Uint8Array(row.photo_data), {
      headers: {
        'Content-Type': row.photo_mime || 'application/octet-stream',
        'Content-Length': String(row.photo_data.length),
        // The URL carries ?v=<photo_updated_at>, so a change busts the cache.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  });
}
