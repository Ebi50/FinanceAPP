import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { HttpError, authed, parsed, readJson } from '@/lib/server/http';
import { requireUuid } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export async function PATCH(request: Request, { params }: Params) {
  return authed(async (user) => {
    const id = requireUuid((await params).id);
    const { name } = parsed(schema.safeParse(await readJson(request)));

    const category = await queryOne(
      `UPDATE expense_categories SET name = $1 WHERE id = $2 AND user_id = $3
       RETURNING id, name, user_id, created_at`,
      [name, id, user.id]
    );
    if (!category) {
      throw new HttpError(404, 'Kategorie nicht gefunden oder gehört einem anderen Nutzer.');
    }

    return NextResponse.json({ category });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return authed(async (user) => {
    const id = requireUuid((await params).id);

    const rows = await query(
      'DELETE FROM expense_categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );
    if (rows.length === 0) {
      throw new HttpError(404, 'Kategorie nicht gefunden oder gehört einem anderen Nutzer.');
    }

    return NextResponse.json({ ok: true });
  });
}
