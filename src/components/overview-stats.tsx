import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "./ui/progress";

interface OverviewStatsProps {
    totalExpenses: number;
}

export function OverviewStats({ totalExpenses }: OverviewStatsProps) {
    const budget = 2000;
    const budgetProgress = (totalExpenses / budget) * 100;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Gesamtausgaben (Monat)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
                -3.2% gegenüber dem Vormonat
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Einnahmen (Monat)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(3500.00)}</div>
            <p className="text-xs text-muted-foreground">
                +5.1% gegenüber dem Vormonat
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget-Auslastung</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budget)}</div>
             <p className="text-xs text-muted-foreground mb-2">
                {formatCurrency(totalExpenses)} von {formatCurrency(budget)} verwendet
            </p>
            <Progress value={budgetProgress} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ersparnis</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(3500 - totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
                Verbleibendes Geld in diesem Monat
            </p>
            </CardContent>
        </Card>
    </div>
  );
}
