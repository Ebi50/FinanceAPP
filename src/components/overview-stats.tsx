import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "./ui/progress";

interface OverviewStatsProps {
    totalExpenses: number;
    totalIncome: number;
    budget: number;
}

export function OverviewStats({ totalExpenses, totalIncome, budget }: OverviewStatsProps) {
    const budgetToShow = totalIncome > 0 ? totalIncome : budget;
    const budgetProgress = budgetToShow > 0 ? (totalExpenses / budgetToShow) * 100 : 0;
    const savings = totalIncome - totalExpenses;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Gesamtausgaben
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
                Ausgaben im ausgewählten Zeitraum
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Einnahmen
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground">
                Einnahmen im ausgewählten Zeitraum
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget-Auslastung</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budgetToShow)}</div>
             <p className="text-xs text-muted-foreground mb-2">
                {formatCurrency(totalExpenses)} von {formatCurrency(budgetToShow)} verwendet
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
            <div className="text-2xl font-bold">{formatCurrency(savings)}</div>
            <p className="text-xs text-muted-foreground">
                Verbleibendes Geld im Zeitraum
            </p>
            </CardContent>
        </Card>
    </div>
  );
}
