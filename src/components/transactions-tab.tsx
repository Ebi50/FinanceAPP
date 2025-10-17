import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { TransactionsTable } from "./transactions-table";
import { transactions } from "@/lib/data";

export function TransactionsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Transaktionen</CardTitle>
        <CardDescription>
          Eine detaillierte Liste all Ihrer letzten Transaktionen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TransactionsTable transactions={transactions} />
      </CardContent>
    </Card>
  );
}
