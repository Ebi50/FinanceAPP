'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import type { Transaction, Category } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemo } from "react";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(c => [c.id, c]));
  }, [categories]);

  const incomeCategory = useMemo(() => {
    if (!categories) return undefined;
    return categories.find(c => c.name.toLowerCase() === 'einnahmen');
  }, [categories]);
  
  const recent = transactions.slice(0, 5);
  
  return (
    <Card className="col-span-4 lg:col-span-3">
      <CardHeader>
        <CardTitle className="font-headline">Letzte Transaktionen</CardTitle>
        <CardDescription>
          Sie haben diesen Monat {transactions.length} Transaktionen getätigt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {recent.map((transaction) => {
            const category = categoryMap.get(transaction.categoryId);
            const isIncome = category?.id === incomeCategory?.id;
            return (
              <div key={transaction.id} className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary">
                    {/* Icon display can be re-added if icons are stored in firestore */}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {category?.name}
                  </p>
                </div>
                <div className={cn(
                  "ml-auto font-medium",
                  isIncome ? "text-emerald-500" : "text-destructive"
                )}>
                  {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
