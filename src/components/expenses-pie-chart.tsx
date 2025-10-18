"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { Transaction, Category } from "@/lib/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemo } from "react";

interface ExpensesPieChartProps {
  transactions: Transaction[];
}

const COLORS = ['#A7D1AB', '#FFDA63', '#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function ExpensesPieChart({ transactions }: ExpensesPieChartProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map(c => [c.id, c.name]));
  }, [categories]);

  const expensesByCategory = useMemo(() => {
    const expenses = transactions.reduce((acc, transaction) => {
      const categoryName = categoryMap.get(transaction.categoryId) || 'Sonstiges';
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += transaction.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(expenses).map(([name, value]) => ({
      name,
      value
    }));
  }, [transactions, categoryMap]);
  
  if (transactions.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Keine Ausgabendaten für dieses Jahr vorhanden.</div>;
  }


  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={expensesByCategory}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);
            return (
              <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
              </text>
            );
          }}
        >
          {expensesByCategory.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
