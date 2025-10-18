import type { LucideIcon } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: Date | Timestamp;
  categoryId: string;
};

export type Category = {
  id: string;
  name: string;
};
