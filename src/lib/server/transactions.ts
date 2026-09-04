import type { PoolClient } from 'pg';
import { query } from '@/lib/db';
import { HttpError } from './http';
import { roundAmount, type TransactionInput } from './validation';

/** Column list plus the aggregated items, shaped exactly like the client expects. */
const SELECT_TRANSACTION = `
  SELECT t.id, t.description, t.amount, t.date, t.category_id, t.user_id,
         t.is_recurring, t.original_recurring_id, t.recurring_end_date,
         t.created_at, t.updated_at,
         COALESCE((
           SELECT json_agg(json_build_object('value', i.value, 'description', i.description) ORDER BY i.id)
             FROM transaction_items i
            WHERE i.transaction_id = t.id
         ), '[]'::json) AS items
    FROM transactions t
`;

export async function fetchTransactionsForYear(year: number) {
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const nextYearStart = `${year + 1}-01-01T00:00:00.000Z`;

  // Same rule as the old PostgREST `or` filter: the selected year plus every
  // recurring template, because instances are generated in the client.
  return query(
    `${SELECT_TRANSACTION}
      WHERE (t.date >= $1 AND t.date < $2) OR t.is_recurring = true
      ORDER BY t.date DESC`,
    [yearStart, nextYearStart]
  );
}

export async function fetchTransaction(id: string, client?: PoolClient) {
  const sql = `${SELECT_TRANSACTION} WHERE t.id = $1`;
  const rows = client ? (await client.query(sql, [id])).rows : await query(sql, [id]);
  return rows[0] ?? null;
}

/** Loads a transaction and makes sure the current user may write to it. */
export async function requireOwnTransaction(client: PoolClient, id: string, userId: string) {
  const { rows } = await client.query(
    'SELECT id, user_id, is_recurring FROM transactions WHERE id = $1 FOR UPDATE',
    [id]
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Transaktion nicht gefunden.');
  if (row.user_id !== userId) {
    throw new HttpError(403, 'Nur eigene Transaktionen können geändert werden.');
  }
  return row as { id: string; user_id: string; is_recurring: boolean };
}

export async function insertTransaction(
  client: PoolClient,
  userId: string,
  input: TransactionInput & { original_recurring_id?: string | null }
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO transactions
       (description, amount, date, category_id, user_id, is_recurring, original_recurring_id, recurring_end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.description ?? '',
      roundAmount(input.amount),
      input.date,
      input.category_id ?? null,
      userId,
      input.is_recurring ?? false,
      input.original_recurring_id ?? null,
      input.recurring_end_date ?? null,
    ]
  );
  return rows[0].id as string;
}

export async function replaceItems(
  client: PoolClient,
  transactionId: string,
  items: { value: number; description?: string | null }[]
): Promise<void> {
  await client.query('DELETE FROM transaction_items WHERE transaction_id = $1', [transactionId]);
  if (items.length === 0) return;

  const values: any[] = [];
  const placeholders = items.map((item, index) => {
    const base = index * 3;
    values.push(transactionId, roundAmount(item.value), item.description || null);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  await client.query(
    `INSERT INTO transaction_items (transaction_id, value, description) VALUES ${placeholders.join(', ')}`,
    values
  );
}
