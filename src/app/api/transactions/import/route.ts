import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { authed, parsed, readJson } from '@/lib/server/http';
import { importInputSchema, roundAmount } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 500;

export async function POST(request: Request) {
  return authed(async (user) => {
    const { transactions } = parsed(importInputSchema.safeParse(await readJson(request)));

    const inserted = await withTransaction(async (client) => {
      let count = 0;

      for (let offset = 0; offset < transactions.length; offset += CHUNK_SIZE) {
        const chunk = transactions.slice(offset, offset + CHUNK_SIZE);
        const values: any[] = [];
        const placeholders = chunk.map((t, index) => {
          const base = index * 5;
          values.push(t.description ?? '', roundAmount(t.amount), t.date, t.category_id ?? null, user.id);
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
        });

        const result = await client.query(
          `INSERT INTO transactions (description, amount, date, category_id, user_id)
           VALUES ${placeholders.join(', ')}`,
          values
        );
        count += result.rowCount ?? chunk.length;
      }

      return count;
    });

    return NextResponse.json({ inserted }, { status: 201 });
  });
}
