import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db';
import { authed, parsed, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export async function GET() {
  return authed(async () => {
    const data = await query(
      'SELECT id, name, user_id, created_at FROM expense_categories ORDER BY name ASC'
    );
    return NextResponse.json({ data });
  });
}

export async function POST(request: Request) {
  return authed(async (user) => {
    const { name } = parsed(schema.safeParse(await readJson(request)));

    const category = await queryOne(
      `INSERT INTO expense_categories (name, user_id) VALUES ($1, $2)
       RETURNING id, name, user_id, created_at`,
      [name, user.id]
    );

    return NextResponse.json({ category }, { status: 201 });
  });
}
