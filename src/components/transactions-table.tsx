'use client';
import type { Transaction, Category, TransactionItem } from "@/lib/types";
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
import { MoreHorizontal, Trash2, Edit, ArrowUpDown, Repeat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { format, isValid } from "date-fns";
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
import { collection, doc } from 'firebase/firestore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface TransactionsTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string; date: Date; items: TransactionItem[] }) => void;
}

type SortKey = 'description' | 'category' | 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

export function TransactionsTable({ transactions, onDelete, onUpdate }: TransactionsTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const handleDelete = (transaction: Transaction) => {
    onDelete(transaction.id);
  };
  
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  }

  const handleUpdate = (updatedTransaction: Omit<Transaction, 'id' | 'date'> & { id?: string; date: Date; items: TransactionItem[] }) => {
    onUpdate(updatedTransaction);
    setEditingTransaction(null);
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };
  
  const sortedTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return [...transactions].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch(sortKey) {
        case 'category':
          valA = categoryMap.get(a.categoryId)?.name || '';
          valB = categoryMap.get(b.categoryId)?.name || '';
          break;
        case 'date':
           // Convert Firestore Timestamp to JS Date for comparison
          valA = a.date.toDate();
          valB = b.date.toDate();
          break;
        case 'amount':
          valA = a.amount;
          valB = b.amount;
          break;
        default: // description
          valA = a.description?.toLowerCase() || '';
          valB = b.description?.toLowerCase() || '';
          break;
      }
      
      if (valA < valB) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [transactions, sortKey, sortDirection, categoryMap]);

  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ' 🔼' : ' 🔽';
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('description')}>
                Beschreibung
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('category')}>
                Kategorie
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => handleSort('date')}>
                Datum
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" onClick={() => handleSort('amount')}>
                Betrag
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <span className="sr-only">Aktionen</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTransactions.map((transaction) => {
            const category = categoryMap.get(transaction.categoryId);
            const incomeCategory = categories?.find(c => c.name.toLowerCase() === 'einnahmen');
            const isIncome = category?.id === incomeCategory?.id;
            const isVirtual = (transaction as any).isVirtual;
            const isOriginalRecurring = (transaction as any).isRecurring === true;
            
            // This robustly converts Firestore Timestamps into a JS Date for formatting
            const transactionDate = transaction.date.toDate();

            return (
              <TableRow key={transaction.id} className={cn(isVirtual && "text-muted-foreground/80")}>
                <TableCell className="font-medium">
                  {transaction.description}
                  {transaction.items && transaction.items.length > 1 && (
                    <span className="text-xs text-muted-foreground ml-2">({transaction.items.length} Posten)</span>
                  )}
                  {(isVirtual || isOriginalRecurring) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Repeat className="h-3 w-3 ml-2 inline-block"/>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isOriginalRecurring ? "Vorlage für wiederkehrende Transaktionen" : "Automatisch wiederholte Transaktion"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TableCell>
                <TableCell>
                  {category && (
                    <Badge variant="outline" className="flex items-center gap-2 w-fit">
                      {category.name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isValid(transactionDate) ? format(transactionDate, "dd. MMMM yyyy", { locale: de }) : 'Ungültiges Datum'}
                </TableCell>
                <TableCell className={cn("text-right", isIncome ? "text-emerald-500" : "text-destructive", isVirtual && "font-normal")}>
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
                              <AlertDialogAction onClick={() => handleDelete(transaction)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
          />
        )}
    </>
  );
}
