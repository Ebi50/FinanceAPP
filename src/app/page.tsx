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
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';

export default function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const transactionsQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'transactions') : null,
    [firestore, user]
  );
  const { data: transactions, isLoading: transactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const budgetQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  // This is simplified. We are not using useDoc as it's not ideal for a single field.
  // A more complete solution would use useDoc and handle the user profile document.
  const [budget, setBudget] = useState(2000); 


  const handleAddOrUpdateTransaction = (transaction: Omit<Transaction, 'id'> & { id?: string }) => {
    if (!user) return;
    const coll = collection(firestore, 'users', user.uid, 'transactions');
    if (transaction.id) {
      const docRef = doc(coll, transaction.id);
      setDoc(docRef, transaction, { merge: true });
    } else {
      addDoc(coll, transaction);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, 'users', user.uid, 'transactions', id);
    deleteDoc(docRef);
  };
  
  const handleImportTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    if (!user) return;
    const coll = collection(firestore, 'users', user.uid, 'transactions');
    const batch = [];
    for (const newT of newTransactions) {
        // Here we just add, assuming imported are new.
        // A more complex logic could check for duplicates before adding.
        batch.push(addDoc(coll, newT));
    }
    Promise.all(batch);
  };

  const sortedTransactions = transactions ? [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];


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
            <TabsTrigger value="categories">Kategorien</TabsTrigger>
            <TabsTrigger value="import">Import/Export</TabsTrigger>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="reports">Berichte</TabsTrigger>
            <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
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
