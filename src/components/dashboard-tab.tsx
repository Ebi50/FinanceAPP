import { OverviewStats } from "./overview-stats";
import { ExpensesChart } from "./expenses-chart";
import { RecentTransactions } from "./recent-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { Transaction, Category } from "@/lib/types";
import { useUser, useTable } from '@/lib/supabase';
import { useMemo } from "react";
import { parseISO } from 'date-fns';

interface DashboardTabProps {
  transactions: Transaction[];
  budget: number;
}

export function DashboardTab({ transactions, budget }: DashboardTabProps) {
  const { user } = useUser();
  const { data: categories } = useTable<Category>({
    table: 'expense_categories',
    enabled: !!user,
  });

  const incomeCategory = useMemo(() => categories?.find(c => c.name.toLowerCase() === 'einnahmen'), [categories]);

  const transactionsWithDates = useMemo(() => {
    return transactions.map(t => ({ ...t, date: typeof t.date === 'string' ? parseISO(t.date) : t.date }));
  }, [transactions]);

  const totalExpenses = transactionsWithDates
    .filter(t => t.category_id !== incomeCategory?.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactionsWithDates
    .filter(t => t.category_id === incomeCategory?.id)
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
