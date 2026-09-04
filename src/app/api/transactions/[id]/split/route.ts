import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { authed, parsed, readJson } from '@/lib/server/http';
import {
  fetchTransaction,
  insertTransaction,
  replaceItems,
  requireOwnTransaction,
} from '@/lib/server/transactions';
import { requireUuid, splitInputSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * "Bearbeiten ab Datum" for a recurring template: the old template gets an end
 * date, a new template takes over from effective_from. Both writes plus the
 * items now happen in one DB transaction instead of three separate requests.
 */
export async function POST(request: Request, { params }: Params) {
  return authed(async (user) => {
    const templateId = requireUuid((await params).id);
    const input = parsed(splitInputSchema.safeParse(await readJson(request)));

    const transaction = await withTransaction(async (client) => {
      await requireOwnTransaction(client, templateId, user.id);

      await client.query(
        'UPDATE transactions SET recurring_end_date = $1, updated_at = now() WHERE id = $2',
        [input.effective_from, templateId]
      );

      const newId = await insertTransaction(client, user.id, {
        ...input,
        date: input.effective_from,
        is_recurring: true,
        recurring_end_date: null,
        original_recurring_id: templateId,
      });
      await replaceItems(client, newId, input.items ?? []);

      return fetchTransaction(newId, client);
    });

    return NextResponse.json({ transaction }, { status: 201 });
  });
}
