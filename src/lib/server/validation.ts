import { z } from 'zod';
import { HttpError } from './http';

/** ISO date string as produced by Date.toISOString() on the client. */
export const isoDate = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Ungültiges Datum.' });

export const uuid = z.string().uuid();

export const transactionItemSchema = z.object({
  value: z.number().finite(),
  description: z.string().nullish(),
});

export const transactionInputSchema = z.object({
  description: z.string().max(500).default(''),
  amount: z.number().finite(),
  date: isoDate,
  category_id: uuid.nullish(),
  is_recurring: z.boolean().optional().default(false),
  recurring_end_date: isoDate.nullish(),
  items: z.array(transactionItemSchema).max(200).optional(),
});

export const transactionPatchSchema = transactionInputSchema.partial().extend({
  items: z.array(transactionItemSchema).max(200).optional(),
});

export const splitInputSchema = transactionInputSchema.extend({
  /** First date the new template is effective for. */
  effective_from: isoDate,
});

export const importInputSchema = z.object({
  transactions: z
    .array(
      z.object({
        description: z.string().max(500).default(''),
        amount: z.number().finite(),
        date: isoDate,
        category_id: uuid.nullish(),
      })
    )
    .min(1)
    .max(20000),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionPatch = z.infer<typeof transactionPatchSchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;

/** Amounts are stored with two decimals throughout the app. */
export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function requireUuid(value: string, label = 'ID'): string {
  if (!uuid.safeParse(value).success) {
    throw new HttpError(400, `Ungültige ${label}.`);
  }
  return value;
}
