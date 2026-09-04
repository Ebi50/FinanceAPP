import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { authed, parsed, readJson } from '@/lib/server/http';
import {
  fetchTransaction,
  fetchTransactionsForYear,
  insertTransaction,
  replaceItems,
} from '@/lib/server/transactions';
import { transactionInputSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

const yearSchema = z.coerce.number().int().min(1970).max(2200);

export async function GET(request: Request) {
  return authed(async () => {
    const url = new URL(request.url);
    const year = parsed(yearSchema.safeParse(url.searchParams.get('year') ?? new Date().getFullYear()));

    return NextResponse.json({ data: await fetchTransactionsForYear(year) });
  });
}

export async function POST(request: Request) {
  return authed(async (user) => {
    const input = parsed(transactionInputSchema.safeParse(await readJson(request)));

    const transaction = await withTransaction(async (client) => {
      const id = await insertTransaction(client, user.id, input);
      await replaceItems(client, id, input.items ?? []);
      return fetchTransaction(id, client);
    });

    return NextResponse.json({ transaction }, { status: 201 });
  });
}
