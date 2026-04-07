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
import { format, isValid, parseISO } from "date-fns";
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
} from "@/components/ui/alert-dialog";
import { AddTransactionSheet } from "./add-transaction-sheet";
import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { useCategories } from '@/lib/categories-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface TransactionsTableProps {
  transactions: Transaction[];
  onDelete: (id: string, mode?: 'all' | 'from_here', instanceDate?: string) => void;
  onUpdate: (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string; date: Date; items: TransactionItem[]; effectiveFrom?: Date }) => void;
}

type SortKey = 'description' | 'category' | 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

const toDate = (d: string | Date): Date => {
  if (d instanceof Date) return d;
  return parseISO(d);
};

export function TransactionsTable({ transactions, onDelete, onUpdate }: TransactionsTableProps) {
  const { categories } = useCategories();

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);


  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const handleDelete = (transaction: Transaction) => {
    onDelete(transaction.id);
    setDeletingTransaction(null);
  };

  const handleEdit = (transaction: Transaction) => {
    // Blur the DropdownMenu trigger before opening the Sheet.
    // Otherwise Radix cannot set aria-hidden on the page content
    // because the focused trigger button is inside the hidden region.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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

    // Data arrives pre-sorted by date desc from parent — skip re-sort if that's the key
    if (sortKey === 'date' && sortDirection === 'desc') return transactions;

    return [...transactions].sort((a, b) => {
      let cmp = 0;

      switch(sortKey) {
        case 'category': {
          const nameA = categoryMap.get(a.category_id)?.name || '';
          const nameB = categoryMap.get(b.category_id)?.name || '';
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'date': {
          // ISO 8601 strings sort correctly with localeCompare
          const dateA = typeof a.date === 'string' ? a.date : '';
          const dateB = typeof b.date === 'string' ? b.date : '';
          cmp = dateA.localeCompare(dateB);
          break;
        }
        case 'amount':
          cmp = a.amount - b.amount;
          break;
        default: {
          const descA = a.description?.toLowerCase() || '';
          const descB = b.description?.toLowerCase() || '';
          cmp = descA.localeCompare(descB);
          break;
        }
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [transactions, sortKey, sortDirection, categoryMap]);

  // Reset visible count when transactions change
  const transactionsLength = transactions?.length ?? 0;
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [transactionsLength, sortKey, sortDirection]);

  const displayedTransactions = sortedTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < sortedTransactions.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const incomeCategory = useMemo(() => categories?.find(c => c.name.toLowerCase() === 'einnahmen'), [categories]);

  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ' \u{1F53C}' : ' \u{1F53D}';
  };

  return (
    <TooltipProvider>
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
          {displayedTransactions.map((transaction) => {
            const category = categoryMap.get(transaction.category_id);
            const isIncome = category?.id === incomeCategory?.id;
            const isVirtual = transaction.is_virtual;
            const isOriginalRecurring = transaction.is_recurring === true;

            const transactionDate = toDate(transaction.date);

            return (
              <TableRow key={transaction.id} className={cn(isVirtual && "text-muted-foreground/80")}>
                <TableCell className="font-medium">
                  {transaction.description}
                  {transaction.items && transaction.items.length > 1 && (
                    <span className="text-xs text-muted-foreground ml-2">({transaction.items.length} Posten)</span>
                  )}
                  {(isVirtual || isOriginalRecurring) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Repeat className="h-3 w-3 ml-2 inline-block"/>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isOriginalRecurring ? "Vorlage für wiederkehrende Transaktionen" : "Automatisch wiederholte Transaktion"}</p>
                      </TooltipContent>
                    </Tooltip>
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
                      <DropdownMenuItem onSelect={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setDeletingTransaction(transaction); }} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={handleLoadMore}>
            Weitere {Math.min(PAGE_SIZE, sortedTransactions.length - visibleCount)} von {sortedTransactions.length} Transaktionen laden
          </Button>
        </div>
      )}
      <AddTransactionSheet
        open={!!editingTransaction}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        onTransactionAdded={handleUpdate}
      />
      <AlertDialog open={!!deletingTransaction} onOpenChange={(isOpen) => { if (!isOpen) setDeletingTransaction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transaktion löschen</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTransaction && (deletingTransaction.is_recurring || deletingTransaction.is_virtual)
                ? 'Dies ist eine wiederkehrende Transaktion. Wie möchten Sie vorgehen?'
                : 'Diese Aktion kann nicht rückgängig gemacht werden. Dadurch wird die Transaktion dauerhaft gelöscht.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            {deletingTransaction && (deletingTransaction.is_recurring || deletingTransaction.is_virtual) && (
              <AlertDialogAction
                onClick={() => {
                  if (deletingTransaction) {
                    onDelete(deletingTransaction.id, 'from_here', deletingTransaction.date);
                    setDeletingTransaction(null);
                  }
                }}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Ab hier löschen
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => {
                if (deletingTransaction) {
                  onDelete(deletingTransaction.id, 'all');
                  setDeletingTransaction(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Alle löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
