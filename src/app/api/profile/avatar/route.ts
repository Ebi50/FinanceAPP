import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { toSessionUser } from '@/lib/server/auth';
import { HttpError, authed } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  return authed(async (user) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      throw new HttpError(400, 'Es wurde keine Datei übergeben.');
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new HttpError(415, 'Bitte eine JPEG-, PNG-, GIF- oder WebP-Datei wählen.');
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(413, 'Das Bild darf höchstens 2 MB groß sein.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const row = await queryOne(
      `UPDATE profiles SET photo_data = $1, photo_mime = $2, photo_updated_at = now()
        WHERE id = $3
       RETURNING id, email, first_name, last_name, budget, auto_logout_timeout,
                 photo_data IS NOT NULL AS has_photo, photo_updated_at`,
      [bytes, file.type, user.id]
    );

    return NextResponse.json({ user: toSessionUser(row) });
  });
}
