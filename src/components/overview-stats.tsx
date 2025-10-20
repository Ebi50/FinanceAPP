import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { Euro, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "./ui/progress";

interface OverviewStatsProps {
    totalExpenses: number;
    totalIncome: number;
    budget: number;
}

export function OverviewStats({ totalExpenses, totalIncome, budget }: OverviewStatsProps) {
    const budgetToShow = budget; // Immer das in den Einstellungen festgelegte Budget verwenden
    const budgetProgress = budgetToShow > 0 ? (totalExpenses / budgetToShow) * 100 : 0;
    const savings = totalIncome - totalExpenses;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-destructive/10 dark:bg-destructive/20">
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
        <Card className="bg-emerald-50 dark:bg-emerald-950/50">
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
        <Card className={cn(
            savings >= 0 ? "bg-emerald-50 dark:bg-emerald-950/50" : "bg-destructive/10 dark:bg-destructive/20"
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ersparnis</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
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
