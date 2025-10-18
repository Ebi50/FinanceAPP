'use client';
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Download, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { Transaction, Category } from "@/lib/types";
import React from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';


interface ReportsTabProps {
  transactions: Transaction[];
}

export function ReportsTab({ transactions }: ReportsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const categoryMap = useMemoFirebase(() => {
    if(!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const generatePdf = (period: "monthly" | "yearly") => {
    const doc = new jsPDF();
    const tableColumn = ["Datum", "Beschreibung", "Kategorie", "Betrag"];
    const tableRows: (string | number)[][] = [];

    const now = new Date();
    const filteredTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.date.toString());
      if (period === "monthly") {
        return (
          transactionDate.getMonth() === now.getMonth() &&
          transactionDate.getFullYear() === now.getFullYear()
        );
      } else {
        return transactionDate.getFullYear() === now.getFullYear();
      }
    });

    if (filteredTransactions.length === 0) {
      toast({
        title: "Keine Daten",
        description: `Für den ${
          period === "monthly" ? "aktuellen Monat" : "aktuelles Jahr"
        } wurden keine Transaktionen gefunden.`,
      });
      return;
    }

    filteredTransactions.forEach((t) => {
      const transactionData = [
        format(new Date(t.date.toString()), "dd.MM.yyyy", { locale: de }),
        t.description,
        categoryMap.get(t.categoryId) || "Unbekannt",
        `-${t.amount.toFixed(2)} €`,
      ];
      tableRows.push(transactionData);
    });

    const title =
      period === "monthly" ? "Monatlicher Bericht" : "Jahresbericht";
    doc.text(title, 14, 15);
    (doc as any).autoTable({
      startY: 20,
      head: [tableColumn],
      body: tableRows,
    });
    doc.save(`${title.toLowerCase().replace(" ", "-")}.pdf`);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Berichte erstellen</CardTitle>
          <CardDescription>
            Laden Sie Ihre monatlichen oder jährlichen Ausgabenberichte herunter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={() => generatePdf("monthly")}>
            <Download className="mr-2 h-4 w-4" />
            Monatlicher Bericht (PDF)
          </Button>
          <Button variant="secondary" onClick={() => generatePdf("yearly")}>
            <Download className="mr-2 h-4 w-4" />
            Jahresbericht (PDF)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
