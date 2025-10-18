'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PlusCircle, Trash2 } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { DashboardTab } from "@/components/dashboard-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { ReportsTab } from "@/components/reports-tab";
import { ImportTab } from "@/components/import-tab";
import { AddTransactionSheet } from "@/components/add-transaction-sheet";
import type { Transaction, Category } from '@/lib/types';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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


export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
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

  const categoriesQuery = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null,
    [firestore, user]
  );
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{budget?: number}>(userProfileQuery);
  const budget = userProfile?.budget ?? 2000;


  const handleAddOrUpdateTransaction = (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string, date: Date }) => {
    if (!user) return;
    const coll = collection(firestore, 'users', user.uid, 'transactions');
    
    // Create a mutable copy to work with
    const transactionData: Omit<Transaction, 'id' | 'date'> & { id?: string, date: Date | Timestamp } = { ...transaction };
    
    // Convert Date to Firestore Timestamp
    transactionData.date = Timestamp.fromDate(transaction.date);

    if (transaction.id) {
      const docRef = doc(coll, transaction.id);
      const { id, ...dataToUpdate } = transactionData;
      setDocumentNonBlocking(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      // For new transactions, ensure all data is correctly prepared.
      const { id, ...dataToAdd } = transactionData;
      addDocumentNonBlocking(coll, { ...dataToAdd, createdAt: serverTimestamp() });
    }
  };

  const handleImportTransactions = async (importedTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    if (!user || !firestore) return;

    const batch = writeBatch(firestore);
    const transactionsCollection = collection(firestore, `users/${user.uid}/transactions`);

    importedTransactions.forEach((transactionData) => {
      const docRef = doc(transactionsCollection); // Create a new document with a unique ID
      batch.set(docRef, { ...transactionData, createdAt: serverTimestamp() });
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
    const docRef = doc(firestore, 'users', user.uid, 'transactions', id);
    deleteDocumentNonBlocking(docRef);
  };
  
  const handleDeleteAllTransactions = async () => {
    if (!user || !firestore) return;

    const transactionsCollection = collection(firestore, `users/${user.uid}/transactions`);
    try {
      const querySnapshot = await getDocs(transactionsCollection);
      const batch = writeBatch(firestore);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({
        title: "Alle Transaktionen gelöscht",
        description: "Alle Ihre Transaktionsdaten wurden entfernt.",
      });
    } catch (error) {
      console.error("Error deleting all transactions: ", error);
      toast({
        variant: "destructive",
        title: "Löschen fehlgeschlagen",
        description: "Beim Löschen der Transaktionen ist ein Fehler aufgetreten.",
      });
    }
  };

  const sortedTransactions = transactions ? [...transactions].sort((a, b) => {
    // Ensure we are comparing valid Date objects
    const dateA = a.date ? (a.date as any).toDate ? (a.date as any).toDate() : new Date(a.date) : new Date(0);
    const dateB = b.date ? (b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date) : new Date(0);
    return dateB.getTime() - dateA.getTime();
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Alle Transaktionen löschen</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Sind Sie absolut sicher?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Dadurch werden alle Ihre Transaktionen dauerhaft gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllTransactions}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Alles löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AddTransactionSheet onTransactionAdded={handleAddOrUpdateTransaction}>
              <Button variant="destructive">
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
            <TabsTrigger value="import">Importieren</TabsTrigger>
          </TabsList>
          <TabsContent value="reports" className="space-y-4">
            <ReportsTab transactions={sortedTransactions} />
          </TabsContent>
          <TabsContent value="import" className="space-y-4">
            <ImportTab 
              transactions={sortedTransactions} 
              onImport={handleImportTransactions}
              categories={categories || []}
            />
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
