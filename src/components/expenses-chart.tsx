// Note: This component uses Recharts, which is already included in the project's dependencies.
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { Transaction, Category } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemo } from "react";

interface ExpensesChartProps {
  transactions: Transaction[];
}

const COLORS = ['#A7D1AB', '#FFDA63', '#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#fd6b6b', '#a0d2db'];


export function ExpensesChart({ transactions }: ExpensesChartProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(c => [c.id, c.name]));
  }, [categories]);

  const expensesByCategory = useMemo(() => {
    const incomeCategory = categories?.find(c => c.name.toLowerCase() === 'einnahmen');
    const expenses = transactions
      .filter(t => t.categoryId !== incomeCategory?.id)
      .reduce((acc, transaction) => {
        const categoryName = categoryMap.get(transaction.categoryId) || 'Sonstiges';
        if (!acc[categoryName]) {
          acc[categoryName] = 0;
        }
        acc[categoryName] += transaction.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(expenses).map(([name, total]) => ({
      name,
      total
    }));
  }, [transactions, categoryMap, categories]);


  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={expensesByCategory}>
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={70}
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
            formatter={(value: number) => formatCurrency(value)}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} >
          {expensesByCategory.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
