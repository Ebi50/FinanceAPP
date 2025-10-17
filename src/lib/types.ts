import type { LucideIcon } from "lucide-react";

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  categoryId: string;
};

export type Category = {
  id: string;
  name: string;
  icon: LucideIcon;
  subcategories?: Category[];
};
