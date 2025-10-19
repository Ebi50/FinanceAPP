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
};

export type Category = {
  id: string;
  name: string;
};
