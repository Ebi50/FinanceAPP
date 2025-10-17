"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { TransactionsTable } from "./transactions-table";
import { transactions as initialTransactions } from "@/lib/data";
import type { Transaction } from "@/lib/types";
import { useState } from "react";

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };
  
  const handleUpdateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(
      transactions.map((t) =>
        t.id === updatedTransaction.id ? updatedTransaction : t
      )
    );
  };


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
          onDelete={handleDeleteTransaction}
          onUpdate={handleUpdateTransaction}
        />
      </CardContent>
    </Card>
  );
}
