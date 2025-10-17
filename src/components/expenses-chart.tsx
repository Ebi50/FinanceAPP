// Note: This component uses Recharts, which is already included in the project's dependencies.
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { Transaction } from "@/lib/types";
import { categories } from "@/lib/data";

interface ExpensesChartProps {
  transactions: Transaction[];
}

export function ExpensesChart({ transactions }: ExpensesChartProps) {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const expensesByCategory = transactions.reduce((acc, transaction) => {
    const categoryName = categoryMap.get(transaction.categoryId) || 'Sonstiges';
    if (!acc[categoryName]) {
      acc[categoryName] = 0;
    }
    acc[categoryName] += transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(expensesByCategory).map(([name, total]) => ({
    name,
    total
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${formatCurrency(value as number)}`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
            }}
            cursor={{ fill: 'hsl(var(--secondary))' }}
        />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
