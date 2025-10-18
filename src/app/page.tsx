'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PlusCircle } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { DashboardTab } from "@/components/dashboard-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { ReportsTab } from "@/components/reports-tab";
import { ImportTab } from "@/components/import-tab";
import { AddTransactionSheet } from "@/components/add-transaction-sheet";
import type { Transaction } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';


export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const transactionsQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'transactions') : null,
    [firestore, user]
  );
  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{budget?: number}>(userProfileQuery);
  const budget = userProfile?.budget ?? 2000;


  const handleAddOrUpdateTransaction = (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string, date: Date }) => {
    if (!user) return;
    const coll = collection(firestore, 'users', user.uid, 'transactions');
    
    const transactionData = {
        ...transaction,
        createdAt: serverTimestamp(),
    };
    delete (transactionData as any).id;


    if (transaction.id) {
      const docRef = doc(coll, transaction.id);
      setDocumentNonBlocking(docRef, transactionData, { merge: true });
    } else {
      addDocumentNonBlocking(coll, transactionData);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, 'users', user.uid, 'transactions', id);
    deleteDocumentNonBlocking(docRef);
  };
  
  const handleImportTransactions = (newTransactions: (Omit<Transaction, 'id' | 'date'> & { date: Date })[]) => {
    if (!user) return;
    const coll = collection(firestore, 'users', user.uid, 'transactions');
    for (const newT of newTransactions) {
      addDocumentNonBlocking(coll, newT);
    }
  };

  const sortedTransactions = transactions ? [...transactions].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : (a.date as any).toMillis();
    const dateB = b.date instanceof Date ? b.date.getTime() : (b.date as any).toMillis();
    return dateB - dateA;
  }) : [];


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
          <h1 className="text-2xl font-headline font-bold tracking-tight">ExpenceTrack</h1>
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
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
            <TabsTrigger value="categories">Kategorien</TabsTrigger>
            <TabsTrigger value="reports">Berichte</TabsTrigger>
            <TabsTrigger value="import">Import/Export</TabsTrigger>
          </TabsList>
          <TabsContent value="reports" className="space-y-4">
            <ReportsTab transactions={sortedTransactions} />
          </TabsContent>
          <TabsContent value="import" className="space-y-4">
            <ImportTab onImport={handleImportTransactions} transactions={sortedTransactions} />
          </TabsContent>
          <TabsContent value="categories" className="space-y-4">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-4">
            <TransactionsTab 
              transactions={sortedTransactions} 
              onDelete={handleDeleteTransaction}
              onUpdate={handleAddOrUpdateTransaction}
            />
          </TabsContent>
          <TabsContent value="overview" className="space-y-4">
            <DashboardTab transactions={sortedTransactions} budget={budget} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
