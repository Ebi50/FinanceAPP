import type { LucideIcon } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

export type TransactionItem = {
  value: number;
  description?: string;
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: Date | Timestamp;
  categoryId: string;
  items?: TransactionItem[];
  userId: string;
  isRecurring?: boolean;
  isVirtual?: boolean; // Added to identify virtual transactions
  originalRecurringId?: string; // Link to the original recurring transaction
};

export type Category = {
  id: string;
  name: string;
  userId: string;
};
