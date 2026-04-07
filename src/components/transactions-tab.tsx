"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { TransactionsTable } from "./transactions-table";
import type { Transaction, TransactionItem } from "@/lib/types";

interface TransactionsTabProps {
  transactions: Transaction[];
  onDelete: (id: string, mode?: 'all' | 'from_here', instanceDate?: string) => void;
  onUpdate: (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string; date: Date; items: TransactionItem[]; effectiveFrom?: Date }) => void;
}

export function TransactionsTab({ transactions, onDelete, onUpdate }: TransactionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Transaktionen</CardTitle>
        <CardDescription>
          Eine detaillierte Liste all Ihrer letzten Transaktionen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TransactionsTable 
          transactions={transactions} 
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      </CardContent>
    </Card>
  );
}
