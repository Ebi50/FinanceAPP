// Note: This component uses Recharts, which is already included in the project's dependencies.
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/utils"

const data = [
  { name: "Lebensmittel", total: 450.50 },
  { name: "Wohnen", total: 850.00 },
  { name: "Transport", total: 150.10 },
  { name: "Essen gehen", total: 120.00 },
  { name: "Unterhaltung", total: 80.75 },
  { name: "Sonstiges", total: 200.30 },
]

export function ExpensesChart() {
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
