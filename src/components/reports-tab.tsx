'use client';
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format, toDate, isValid, getYear } from "date-fns";
import { de } from "date-fns/locale";
import type { Transaction, Category } from "@/lib/types";
import React, { useMemo, useState, useEffect } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Label } from "./ui/label";


interface ReportsTabProps {
  transactions: Transaction[];
}

export function ReportsTab({ transactions }: ReportsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const availableYears = useMemo(() => {
    if (!transactions) return [];
    const years = new Set(
      transactions
        .map(t => {
          const date = toDate(t.date);
          return isValid(date) ? getYear(date) : null;
        })
        .filter((year): year is number => year !== null && !isNaN(year))
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const categoryMap = useMemo(() => {
    if(!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const generatePdf = (period: "monthly" | "yearly", year: number) => {
    const doc = new jsPDF();
    const tableColumn = ["Datum", "Beschreibung", "Kategorie", "Betrag"];
    const tableRows: (string | number)[][] = [];

    const now = new Date();
    const filteredTransactions = transactions.filter((t) => {
      const transactionDate = toDate(t.date);
      if (!isValid(transactionDate)) return false;
      if (period === "monthly") {
        return (
          transactionDate.getMonth() === now.getMonth() &&
          getYear(transactionDate) === year
        );
      } else {
        return getYear(transactionDate) === year;
      }
    });

    if (filteredTransactions.length === 0) {
      toast({
        title: "Keine Daten",
        description: `Für den ausgewählten Zeitraum im Jahr ${year} wurden keine Transaktionen gefunden.`,
      });
      return;
    }

    filteredTransactions.forEach((t) => {
      const transactionData = [
        format(toDate(t.date), "dd.MM.yyyy", { locale: de }),
        t.description,
        categoryMap.get(t.categoryId) || "Unbekannt",
        `-${t.amount.toFixed(2)} €`,
      ];
      tableRows.push(transactionData);
    });

    const title =
      period === "monthly" ? `Monatlicher Bericht (${format(now, 'MMMM yyyy', { locale: de })})` : `Jahresbericht ${year}`;
    doc.text(title, 14, 15);
    (doc as any).autoTable({
      startY: 20,
      head: [tableColumn],
      body: tableRows,
    });
    doc.save(`${title.toLowerCase().replace(/\s/g, "-")}.pdf`);
  };
  
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Berichte erstellen</CardTitle>
          <CardDescription>
            Laden Sie Ihre monatlichen oder jährlichen Ausgabenberichte herunter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="year-select">Jahr auswählen</Label>
                <Select
                    value={String(selectedYear)}
                    onValueChange={(value) => setSelectedYear(Number(value))}
                    disabled={availableYears.length === 0}
                >
                    <SelectTrigger id="year-select" className="w-[180px]">
                        <SelectValue placeholder="Jahr auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="secondary" onClick={() => generatePdf("monthly", selectedYear)}>
                    <Download className="mr-2 h-4 w-4" />
                    Monatlicher Bericht (PDF)
                </Button>
                <Button variant="secondary" onClick={() => generatePdf("yearly", selectedYear)}>
                    <Download className="mr-2 h-4 w-4" />
                    Jahresbericht (PDF)
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
