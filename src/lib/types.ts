import type { LucideIcon } from "lucide-react";

export type TransactionItem = {
  value: number;
  description?: string;
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO date string from PostgreSQL
  category_id: string;
  items?: TransactionItem[];
  user_id: string;
  is_recurring?: boolean;
  is_virtual?: boolean;
  original_recurring_id?: string;
  recurring_end_date?: string;
  created_at?: string;
  updated_at?: string;
};

export type Category = {
  id: string;
  name: string;
  user_id: string;
};

export type TransactionItemRow = {
  id: string;
  transaction_id: string;
  value: number;
  description?: string;
};

/** The signed-in user as delivered by GET /api/auth/me. */
export type AppUser = {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  budget: number;
  autoLogoutTimeout: number;
  photoURL: string;
  displayName: string;
};
