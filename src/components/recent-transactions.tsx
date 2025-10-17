import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { categories } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import type { Transaction } from "@/lib/types";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const recent = transactions.slice(0, 5);
  const categoryMap = new Map(categories.map(c => [c.id, c]));

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
            const Icon = category?.icon;
            return (
              <div key={transaction.id} className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
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
                <div className="ml-auto font-medium text-destructive">
                  -{formatCurrency(transaction.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
