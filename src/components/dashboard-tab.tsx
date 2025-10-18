import { OverviewStats } from "./overview-stats";
import { ExpensesChart } from "./expenses-chart";
import { RecentTransactions } from "./recent-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { Transaction } from "@/lib/types";

interface DashboardTabProps {
  transactions: Transaction[];
}

export function DashboardTab({ transactions }: DashboardTabProps) {
  
  const totalExpenses = transactions
    .filter(t => t.categoryId !== 'cat-14') // Filter out income
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter(t => t.categoryId === 'cat-14') // Filter for income
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      <OverviewStats totalExpenses={totalExpenses} totalIncome={totalIncome} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ExpensesChart transactions={transactions} />
          </CardContent>
        </Card>
        <RecentTransactions transactions={transactions} />
      </div>
    </>
  );
}
