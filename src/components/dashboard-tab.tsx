import { OverviewStats } from "./overview-stats";
import { ExpensesChart } from "./expenses-chart";
import { RecentTransactions } from "./recent-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { Transaction } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Category } from "@/lib/types";
import { useMemo } from "react";

interface DashboardTabProps {
  transactions: Transaction[];
  budget: number;
}

export function DashboardTab({ transactions, budget }: DashboardTabProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const incomeCategory = useMemo(() => categories?.find(c => c.name.toLowerCase() === 'einnahmen'), [categories]);
  
  const transactionsWithDates = useMemo(() => {
    return transactions.map(t => ({ ...t, date: t.date.toDate() }));
  }, [transactions]);
  
  const totalExpenses = transactionsWithDates
    .filter(t => t.categoryId !== incomeCategory?.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactionsWithDates
    .filter(t => t.categoryId === incomeCategory?.id)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      <OverviewStats totalExpenses={totalExpenses} totalIncome={totalIncome} budget={budget} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ExpensesChart transactions={transactionsWithDates} />
          </CardContent>
        </Card>
        <RecentTransactions transactions={transactionsWithDates} />
      </div>
    </>
  );
}

    