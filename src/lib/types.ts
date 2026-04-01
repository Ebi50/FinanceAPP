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
