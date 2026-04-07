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
import { useUser, useSupabase, useTable } from '@/lib/supabase';
import { useCategories } from '@/lib/categories-context';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, startTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isValid, addMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';


export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const supabase = useSupabase();
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
  const yearStart = `${currentYear}-01-01T00:00:00.000Z`;
  const nextYearStart = `${currentYear + 1}-01-01T00:00:00.000Z`;

  const { data: allTransactions, isLoading: transactionsLoading, setData: setAllTransactions, refetch: refetchTransactions } = useTable<Transaction>({
    table: 'transactions',
    select: '*, items:transaction_items(value, description)',
    or: `and(date.gte.${yearStart},date.lt.${nextYearStart}),is_recurring.eq.true`,
    realtime: false,
    enabled: !!user,
  });

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

    if (transactionId) {
      // Check if this is a recurring split (edit from a specific date forward)
      const originalTransaction = allTransactions?.find(t => t.id === transactionId);
      const isSplitEdit = effectiveFrom && originalTransaction?.is_recurring;

      if (isSplitEdit) {
        // SPLIT: Set end date on old template, create new template from effectiveFrom
        const effectiveIso = effectiveFrom.toISOString();

        // 1. Update old template: set recurring_end_date
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ recurring_end_date: effectiveIso, updated_at: new Date().toISOString() })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Error updating old template:', updateError);
          return;
        }

        // 2. Create new recurring template from effectiveFrom
        const { data: newTx, error: insertError } = await supabase
          .from('transactions')
          .insert({
            ...restOfData,
            amount: transactionData.amount,
            date: effectiveIso,
            user_id: user.id,
            is_recurring: true,
            original_recurring_id: transactionId,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating new template:', insertError);
          return;
        }

        // 3. Create transaction items for the new template
        if (newTx && items && items.length > 0) {
          await supabase.from('transaction_items').insert(
            items.map(item => ({ transaction_id: newTx.id, value: item.value, description: item.description || null }))
          );
        }

        // Refetch to get clean state with both templates
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

        const { error } = await supabase
          .from('transactions')
          .update({
            ...restOfData,
            amount: transactionData.amount,
            date: isoDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);

        if (error) {
          console.error('Error updating transaction:', error);
          refetchTransactions();
          return;
        }

        // Update transaction items
        if (items) {
          await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
          if (items.length > 0) {
            await supabase.from('transaction_items').insert(
              items.map(item => ({ transaction_id: transactionId, value: item.value, description: item.description || null }))
            );
          }
        }
      }
    } else {
      const { data: newTx, error } = await supabase
        .from('transactions')
        .insert({
          ...restOfData,
          amount: transactionData.amount,
          date: isoDate,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating transaction:', error);
        return;
      }

      // Optimistic: add new transaction to local state (non-blocking)
      if (newTx) {
        const newTransaction = {
          ...restOfData,
          id: newTx.id,
          amount: transactionData.amount,
          date: isoDate,
          user_id: user.id,
          items: items || [],
        } as Transaction;
        startTransition(() => {
          setAllTransactions(prev => prev ? [...prev, newTransaction] : [newTransaction]);
        });

        if (items && items.length > 0) {
          await supabase.from('transaction_items').insert(
            items.map(item => ({ transaction_id: newTx.id, value: item.value, description: item.description || null }))
          );
        }
      }
    }
  };

  const handleImportTransactions = async (importedTransactions: Omit<Transaction, 'id' | 'created_at'>[]) => {
    if (!user) return;

    const rows = importedTransactions.map(t => ({
      ...t,
      user_id: user.id,
    }));

    try {
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      toast({
        title: "Import erfolgreich",
        description: `${importedTransactions.length} Transaktionen wurden erfolgreich importiert.`,
      });
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

    if (mode === 'from_here' && instanceDate) {
      // Set recurring_end_date on the template — stops generating from this month onward
      const { error } = await supabase
        .from('transactions')
        .update({ recurring_end_date: instanceDate, updated_at: new Date().toISOString() })
        .eq('id', templateId);

      if (error) {
        console.error('Error setting recurring end date:', error);
      }
      refetchTransactions();
    } else {
      // Delete the template and all chained templates
      startTransition(() => {
        setAllTransactions(prev => prev ? prev.filter(t =>
          t.id !== templateId && t.original_recurring_id !== templateId
        ) : prev);
      });

      // Delete chained templates first
      await supabase
        .from('transactions')
        .delete()
        .eq('original_recurring_id', templateId);

      // Delete the template itself
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', templateId);

      if (error) {
        console.error('Error deleting transaction:', error);
        refetchTransactions();
      }
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

  const filteredTransactions = useMemo(() => {
    if (!transactionsWithRecurrences) return [];

    // Build prefix for fast string-based filtering (no Date parsing needed)
    // ISO dates: "2026-04-07T..." — year is chars 0-3, month is chars 5-6
    const yearStr = String(currentYear);
    const monthStr = currentMonth !== null ? String(currentMonth + 1).padStart(2, '0') : null;
    const prefix = monthStr ? `${yearStr}-${monthStr}` : yearStr;

    const filtered = transactionsWithRecurrences.filter(t => {
      const dateStr = typeof t.date === 'string' ? t.date : '';
      if (!dateStr) return false;
      return monthStr ? dateStr.startsWith(prefix) : dateStr.startsWith(yearStr);
    });

    // Sort by ISO date string descending (lexicographic sort works for ISO 8601)
    return filtered.sort((a, b) => {
      const dateA = typeof a.date === 'string' ? a.date : '';
      const dateB = typeof b.date === 'string' ? b.date : '';
      return dateB.localeCompare(dateA);
    });

  }, [transactionsWithRecurrences, currentMonth, currentYear]);

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
              transactions={filteredTransactions}
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
