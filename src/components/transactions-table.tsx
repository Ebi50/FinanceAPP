import type { Transaction } from "@/lib/types";
import { categories } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { de } from 'date-fns/locale';

interface TransactionsTableProps {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Beschreibung</TableHead>
          <TableHead>Kategorie</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
          <TableHead>
            <span className="sr-only">Aktionen</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const category = categoryMap.get(transaction.categoryId);
          return (
            <TableRow key={transaction.id}>
              <TableCell className="font-medium">
                {transaction.description}
              </TableCell>
              <TableCell>
                {category && (
                  <Badge variant="outline" className="flex items-center gap-2 w-fit">
                    <category.icon className="h-3 w-3" />
                    {category.name}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {format(transaction.date, "dd. MMMM yyyy", { locale: de })}
              </TableCell>
              <TableCell className="text-right text-destructive">
                -{formatCurrency(transaction.amount)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Menü umschalten</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                    <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Löschen</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
