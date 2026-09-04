import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { HttpError, authed, parsed, readJson } from '@/lib/server/http';
import { fetchTransaction, replaceItems, requireOwnTransaction } from '@/lib/server/transactions';
import { requireUuid, roundAmount, transactionPatchSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return authed(async (user) => {
    const id = requireUuid((await params).id);
    const input = parsed(transactionPatchSchema.safeParse(await readJson(request)));

    const transaction = await withTransaction(async (client) => {
      await requireOwnTransaction(client, id, user.id);

      // Only touch the columns the client actually sent.
      const sets: string[] = [];
      const values: any[] = [];
      const set = (column: string, value: any) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };

      if (input.description !== undefined) set('description', input.description);
      if (input.amount !== undefined) set('amount', roundAmount(input.amount));
      if (input.date !== undefined) set('date', input.date);
      if (input.category_id !== undefined) set('category_id', input.category_id ?? null);
      if (input.is_recurring !== undefined) set('is_recurring', input.is_recurring);
      if (input.recurring_end_date !== undefined) {
        set('recurring_end_date', input.recurring_end_date ?? null);
      }
      sets.push('updated_at = now()');

      values.push(id);
      await client.query(
        `UPDATE transactions SET ${sets.join(', ')} WHERE id = $${values.length}`,
        values
      );

      // Items are replaced wholesale — inside the same DB transaction, so a
      // failure can no longer leave a transaction without its items.
      if (input.items !== undefined) {
        await replaceItems(client, id, input.items);
      }

      return fetchTransaction(id, client);
    });

    return NextResponse.json({ transaction });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return authed(async (user) => {
    const id = requireUuid((await params).id);
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') ?? 'all';
    const date = url.searchParams.get('date');

    if (mode === 'from_here') {
      if (!date || Number.isNaN(Date.parse(date))) {
        throw new HttpError(400, 'Für "ab hier löschen" wird ein gültiges Datum benötigt.');
      }

      const rows = await query(
        `UPDATE transactions SET recurring_end_date = $1, updated_at = now()
          WHERE id = $2 AND user_id = $3
        RETURNING id`,
        [date, id, user.id]
      );
      if (rows.length === 0) {
        throw new HttpError(404, 'Vorlage nicht gefunden oder gehört einem anderen Nutzer.');
      }

      return NextResponse.json({ ok: true, mode });
    }

    if (mode !== 'all') {
      throw new HttpError(400, 'Unbekannter Löschmodus.');
    }

    const deleted = await withTransaction(async (client) => {
      await requireOwnTransaction(client, id, user.id);

      // Follow-up templates created by earlier splits go with it.
      const chained = await client.query(
        'DELETE FROM transactions WHERE original_recurring_id = $1 AND user_id = $2 RETURNING id',
        [id, user.id]
      );
      await client.query('DELETE FROM transactions WHERE id = $1', [id]);
      return (chained.rowCount ?? 0) + 1;
    });

    return NextResponse.json({ ok: true, mode, deleted });
  });
}
