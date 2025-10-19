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
import type { Transaction, Category, TransactionItem } from '@/lib/types';
import { useUser, useFirestore, useCollection, useDoc, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase/provider';
import { isValid } from 'date-fns';
import { de } from 'date-fns/locale';


export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
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

  const transactionsQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'transactions') : null,
    [firestore, user]
  );
  const { data: allTransactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const categoriesQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'expenseCategories') : null,
    [firestore, user]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{budget?: number}>(userProfileQuery);
  const budget = userProfile?.budget ?? 2000;


  const handleAddOrUpdateTransaction = (transactionData: Omit<Transaction, 'id' | 'date' | 'amount'> & { id?: string, date: Date, amount: number, items: TransactionItem[] }) => {
    if (!user || !firestore) return;
  
    const { id: transactionId, date, items, ...restOfData } = transactionData;
  
    const firestoreTimestamp = Timestamp.fromDate(date);
  
    if (transactionId) {
      const docRef = doc(firestore, 'transactions', transactionId);
      const dataToUpdate = {
        ...restOfData,
        date: firestoreTimestamp,
        items, 
        updatedAt: serverTimestamp(),
      };
      setDocumentNonBlocking(docRef, dataToUpdate, { merge: true });
    } else {
      const coll = collection(firestore, 'transactions');
      const dataToCreate = {
        ...restOfData,
        date: firestoreTimestamp,
        items,
        userId: user.uid, // Add user ID for tracking
        createdAt: serverTimestamp(),
      };
      addDocumentNonBlocking(coll, dataToCreate);
    }
  };

  const handleImportTransactions = async (importedTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    if (!user || !firestore) return;

    const batch = writeBatch(firestore);
    const transactionsCollection = collection(firestore, `transactions`);

    importedTransactions.forEach((transactionData) => {
      const docRef = doc(transactionsCollection);
      batch.set(docRef, { ...transactionData, userId: user.uid, createdAt: serverTimestamp() });
    });

    try {
      await batch.commit();
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


  const handleDeleteTransaction = (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, 'transactions', id);
    deleteDocumentNonBlocking(docRef);
  };
  
  const availableYears = useMemo(() => {
    if (!allTransactions) return [new Date().getFullYear()];

    const years = new Set<number>();
    allTransactions.forEach(t => {
      if (t.date && t.date.toDate) { 
        const date = t.date.toDate();
        if (isValid(date)) {
            years.add(date.getFullYear());
        }
      }
    });
    
    years.add(new Date().getFullYear());

    return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
  
    const filteredByYear = allTransactions.filter(t => {
        if (!t.date || !t.date.toDate) return false;
        const date = t.date.toDate();
        return isValid(date) && date.getFullYear() === currentYear;
    });

    const filteredByMonth = currentMonth === null 
        ? filteredByYear 
        : filteredByYear.filter(t => {
            const date = t.date.toDate();
            return isValid(date) && date.getMonth() === currentMonth;
        });

    return filteredByMonth.sort((a, b) => {
        const dateA = a.date.toDate();
        const dateB = b.date.toDate();
        if (!isValid(dateA) || !isValid(dateB)) return 0;
        return dateB.getTime() - dateA.getTime();
    });
    
  }, [allTransactions, currentMonth, currentYear]);

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
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200">Übersicht</TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200">Transaktionen</TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200">Kategorien</TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200">Berichte</TabsTrigger>
            <TabsTrigger value="import" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-gray-200">Importieren</TabsTrigger>
          </TabsList>
           {activeTab === 'transactions' && (
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
                          {de.localize?.month(i)}
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
              transactions={allTransactions || []}
              availableYears={availableYears}
              currentYear={currentYear}
              setCurrentYear={setCurrentYear}
            />
          </TabsContent>
          <TabsContent value="import" className="space-y-4">
            <ImportTab 
              transactions={allTransactions || []} 
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
