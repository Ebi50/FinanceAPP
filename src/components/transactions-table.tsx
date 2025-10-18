'use client';
import type { Transaction, Category } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { MoreHorizontal, Trash2, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { format, toDate, isValid } from "date-fns";
import { de } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddTransactionSheet } from "./add-transaction-sheet";
import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

interface TransactionsTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Omit<Transaction, 'id'> & { id?: string }) => void;
}

export function TransactionsTable({ transactions, onDelete, onUpdate }: TransactionsTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleDelete = (id: string) => {
    onDelete(id);
  };
  
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  }

  const handleUpdate = (updatedTransaction: Omit<Transaction, 'id'> & { id?: string }) => {
    onUpdate(updatedTransaction);
    setEditingTransaction(null);
  }


  return (
    <>
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
          const incomeCategory = categories?.find(c => c.name.toLowerCase() === 'einnahmen');
          const isIncome = category?.id === incomeCategory?.id;
          
          const transactionDate = toDate(transaction.date);

          return (
            <TableRow key={transaction.id}>
              <TableCell className="font-medium">
                {transaction.description}
              </TableCell>
              <TableCell>
                {category && (
                  <Badge variant="outline" className="flex items-center gap-2 w-fit">
                    {/* Icon logic removed */}
                    {category.name}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                 {isValid(transactionDate) ? format(transactionDate, "dd. MMMM yyyy", { locale: de }) : 'Ungültiges Datum'}
              </TableCell>
              <TableCell className={cn("text-right", isIncome ? "text-emerald-500" : "text-destructive")}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Menü umschalten</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => handleEdit(transaction)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                             <Trash2 className="mr-2 h-4 w-4" />
                             Löschen
                           </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Sind Sie absolut sicher?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird die Transaktion dauerhaft gelöscht.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(transaction.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    {editingTransaction && (
        <AddTransactionSheet
          open={!!editingTransaction}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingTransaction(null);
          }}
          transaction={editingTransaction}
          onTransactionAdded={handleUpdate}
        >
          <></>
        </AddTransactionSheet>
      )}
    </>
  );
}
