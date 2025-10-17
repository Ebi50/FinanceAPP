import { OverviewStats } from "./overview-stats";
import { ExpensesChart } from "./expenses-chart";
import { RecentTransactions } from "./recent-transactions";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function DashboardTab() {
  return (
    <>
      <OverviewStats />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ExpensesChart />
          </CardContent>
        </Card>
        <RecentTransactions />
      </div>
    </>
  );
}
