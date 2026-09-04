'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { DashboardTab } from "@/components/dashboard-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { ReportsTab } from "@/components/reports-tab";
import { ImportTab } from "@/components/import-tab";
import { AddTransactionSheet } from "@/components/add-transaction-sheet";
import type { Transaction, TransactionItem } from '@/lib/types';
import { useUser } from '@/lib/auth-provider';
import { useTransactions } from '@/lib/api-hooks';
import { api } from '@/lib/api';
import { useCategories } from '@/lib/categories-context';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, startTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isValid, addMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';


export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState<number | null>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Server-side: only load selected year + all recurring templates
  const {
    data: allTransactions,
    isLoading: transactionsLoading,
    setData: setAllTransactions,
    refetch: refetchTransactions,
  } = useTransactions(currentYear, !!user);

  const { categories } = useCategories();
  const budget = user?.budget ?? 2000;


  const handleAddOrUpdateTransaction = async (transactionData: Omit<Transaction, 'id' | 'date' | 'amount'> & { id?: string, date: Date, amount: number, items: TransactionItem[], effectiveFrom?: Date }) => {
    if (!user) return;

    const { id, date, items, effectiveFrom, ...restOfData } = transactionData;
    let transactionId = id;

    const isoDate = date.toISOString();

    // If we are editing a virtual (recurring) transaction, target the original template.
    if (transactionId && transactionId.includes('-recurring-')) {
        transactionId = transactionId.split('-recurring-')[0];
    }

    const payload = {
      description: restOfData.description ?? '',
      amount: transactionData.amount,
      category_id: restOfData.category_id || null,
      is_recurring: restOfData.is_recurring ?? false,
      items: items ?? [],
    };

    try {
      if (transactionId) {
        // Check if this is a recurring split (edit from a specific date forward)
        const originalTransaction = allTransactions?.find(t => t.id === transactionId);
        const isSplitEdit = effectiveFrom && originalTransaction?.is_recurring;

        if (isSplitEdit) {
          // SPLIT: old template gets an end date, a new template takes over —
          // one request, one DB transaction.
          const effectiveIso = effectiveFrom.toISOString();
          await api.splitTransaction(transactionId, {
            ...payload,
            date: effectiveIso,
            effective_from: effectiveIso,
          });
          refetchTransactions();
        } else {
          // NORMAL UPDATE (non-recurring transaction)
          // Optimistic update: update local state immediately (non-blocking)
          startTransition(() => {
            setAllTransactions(prev => prev ? prev.map(t =>
              t.id === transactionId
                ? { ...t, ...restOfData, amount: transactionData.amount, date: isoDate, items: items || t.items }
                : t
            ) : prev);
          });

          await api.updateTransaction(transactionId, { ...payload, date: isoDate });
        }
      } else {
        const created = await api.createTransaction({ ...payload, date: isoDate });

        // Optimistic: add new transaction to local state (non-blocking)
        startTransition(() => {
          setAllTransactions(prev => prev ? [...prev, created] : [created]);
        });
      }
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      toast({
        variant: 'destructive',
        title: 'Speichern fehlgeschlagen',
        description: error?.message || 'Die Transaktion konnte nicht gespeichert werden.',
      });
      refetchTransactions();
    }
  };

  const handleImportTransactions = async (importedTransactions: (Omit<Transaction, 'id' | 'date'> & { date: Date })[]) => {
    if (!user) return;

    try {
      await api.importTransactions(importedTransactions.map(t => ({
        description: t.description ?? '',
        amount: t.amount,
        date: t.date.toISOString(),
        category_id: t.category_id || null,
      })));

      toast({
        title: "Import erfolgreich",
        description: `${importedTransactions.length} Transaktionen wurden erfolgreich importiert.`,
      });
      refetchTransactions();
    } catch (error) {
      console.error("Error importing transactions: ", error);
      toast({
        variant: "destructive",
        title: "Import fehlgeschlagen",
        description: "Beim Speichern der Transaktionen ist ein Fehler aufgetreten.",
      });
    }
  };

  const handleDeleteTransaction = async (id: string, mode: 'all' | 'from_here' = 'all', instanceDate?: string) => {
    if (!user) return;

    let templateId = id;
    if (id.includes('-recurring-')) {
        templateId = id.split('-recurring-')[0];
    }

    try {
      if (mode === 'from_here' && instanceDate) {
        // Sets recurring_end_date — stops generating from this month onward
        await api.deleteTransaction(templateId, 'from_here', instanceDate);
        refetchTransactions();
      } else {
        // Deletes the template and all chained templates
        startTransition(() => {
          setAllTransactions(prev => prev ? prev.filter(t =>
            t.id !== templateId && t.original_recurring_id !== templateId
          ) : prev);
        });

        await api.deleteTransaction(templateId, 'all');
      }
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast({
        variant: 'destructive',
        title: 'Löschen fehlgeschlagen',
        description: error?.message || 'Die Transaktion konnte nicht gelöscht werden.',
      });
      refetchTransactions();
    }
  };

  const parseDate = (d: string | Date): Date => {
    if (d instanceof Date) return d;
    return parseISO(d);
  };

  const transactionsWithRecurrences = useMemo(() => {
    if (!allTransactions) return [];

    const generatedTransactions: Transaction[] = [];

    for (const t of allTransactions) {
      generatedTransactions.push(t);

      if (t.is_recurring) {
        const originalDate = parseDate(t.date);
        const endDate = t.recurring_end_date ? parseDate(t.recurring_end_date) : null;

        for (let i = 1; i <= 120; i++) {
          const futureDate = addMonths(originalDate, i);

          // Stop generating if we've reached the end date
          if (endDate && futureDate >= endDate) break;

          // Only include instances for the current display year
          if (futureDate.getFullYear() !== currentYear) continue;

          generatedTransactions.push({
            ...t,
            id: `${t.id}-recurring-${i}`,
            date: futureDate.toISOString(),
            is_recurring: false,
            is_virtual: true,
          });
        }
      }
    }

    return generatedTransactions;
  }, [allTransactions, currentYear]);

  // Static year range — data is loaded per-year from server
  const availableYears = useMemo(() => {
    const now = new Date().getFullYear();
    const years: number[] = [];
    for (let y = now + 1; y >= now - 10; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const yearTransactions = useMemo(() => {
    if (!transactionsWithRecurrences) return [];
    const yearStr = String(currentYear);
    return transactionsWithRecurrences
      .filter(t => {
        const dateStr = typeof t.date === 'string' ? t.date : '';
        return dateStr.startsWith(yearStr);
      })
      .sort((a, b) => {
        const dateA = typeof a.date === 'string' ? a.date : '';
        const dateB = typeof b.date === 'string' ? b.date : '';
        return dateB.localeCompare(dateA);
      });
  }, [transactionsWithRecurrences, currentYear]);

  const filteredTransactions = useMemo(() => {
    if (currentMonth === null) return yearTransactions;
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;
    return yearTransactions.filter(t => {
      const dateStr = typeof t.date === 'string' ? t.date : '';
      return dateStr.startsWith(prefix);
    });
  }, [yearTransactions, currentMonth, currentYear]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
      setCurrentYear(availableYears[0]);
    }
  }, [availableYears, currentYear]);


  if (isUserLoading || !user) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Laden...</p>
        </div>
    )
  }

  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4 md:px-8">
          <h1 className="text-2xl font-headline font-bold tracking-tight">Dashboard</h1>
          <div className="ml-auto flex items-center space-x-4">
            <UserNav />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-headline font-bold tracking-tight">Übersicht</h2>
          <div className="flex items-center space-x-2">
            <AddTransactionSheet onTransactionAdded={handleAddOrUpdateTransaction}>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Transaktion hinzufügen
              </Button>
            </AddTransactionSheet>
          </div>
        </div>
        <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
            <TabsTrigger value="categories">Kategorien</TabsTrigger>
            <TabsTrigger value="reports">Berichte</TabsTrigger>
            <TabsTrigger value="import">Importieren</TabsTrigger>
          </TabsList>
           {(activeTab === 'overview' || activeTab === 'transactions' || activeTab === 'reports') && (
              <div className="flex items-center gap-2 pt-4">
                  <Select value={currentMonth === null ? 'all' : String(currentMonth)} onValueChange={(value) => {
                      if (value === 'all') {
                          setCurrentMonth(null);
                      } else {
                          setCurrentMonth(Number(value));
                      }
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Monat auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Monate</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {de.localize?.month(i, { width: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(currentYear)} onValueChange={(value) => setCurrentYear(Number(value))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Jahr auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
            )}
          <TabsContent value="reports" className="space-y-4">
            <ReportsTab
              transactions={yearTransactions}
              currentMonth={currentMonth}
              currentYear={currentYear}
            />
          </TabsContent>
          <TabsContent value="import" className="space-y-4">
            <ImportTab
              transactions={transactionsWithRecurrences}
              onImport={handleImportTransactions}
              categories={categories || []}
            />
          </TabsContent>
          <TabsContent value="categories" className="space-y-4">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-4">
            <TransactionsTab
              transactions={filteredTransactions}
              onDelete={handleDeleteTransaction}
              onUpdate={handleAddOrUpdateTransaction}
            />
          </TabsContent>
          <TabsContent value="overview" className="space-y-4">
            <DashboardTab transactions={filteredTransactions} budget={budget} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
