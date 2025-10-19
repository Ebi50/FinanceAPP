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
import { format, isValid, getYear, getMonth } from "date-fns";
import { de } from "date-fns/locale";
import type { Transaction, Category } from "@/lib/types";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Label } from "./ui/label";
import { ExpensesPieChart } from "./expenses-pie-chart";
import { formatCurrency } from "@/lib/utils";
import html2canvas from "html2canvas";

interface ReportsTabProps {
  transactions: Transaction[];
  availableYears: number[];
  currentYear: number;
  setCurrentYear: (year: number) => void;
  currentMonth: number;
}

interface AutoTableDoc extends jsPDF {
  autoTable: (options: any) => jsPDF;
}


export function ReportsTab({ transactions, availableYears, currentYear, setCurrentYear, currentMonth }: ReportsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const chartRef = useRef<HTMLDivElement>(null);

  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const categoryMap = useMemo(() => {
    if(!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);
  
  const incomeCategory = useMemo(() => categories?.find(c => c.name.toLowerCase() === 'einnahmen'), [categories]);

  const generatePdf = async (period: "monthly" | "yearly", year: number, month: number) => {
    const doc = new jsPDF() as AutoTableDoc;

    if (transactions.length === 0) {
      toast({ title: "Keine Daten", description: "Keine Transaktionen für die Berichterstellung vorhanden." });
      return;
    }
    
    const reportDate = new Date(year, month);
    
    const reportTransactions = transactions.filter(t => {
      const transactionDate = t.date.toDate();
      if (!isValid(transactionDate)) return false;
      const transactionYear = getYear(transactionDate);

      if (period === "monthly") {
        return (
          getMonth(transactionDate) === month &&
          transactionYear === year
        );
      } else { // yearly
        return transactionYear === year;
      }
    });


    if (reportTransactions.length === 0) {
      toast({
        title: "Keine Daten",
        description: `Für den ausgewählten Zeitraum im Jahr ${year} wurden keine Transaktionen gefunden.`,
      });
      return;
    }

    const expenses = reportTransactions.filter(t => t.categoryId !== incomeCategory?.id);
    const income = reportTransactions.filter(t => t.categoryId === incomeCategory?.id);

    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpenses;

    const title = period === "monthly" ? `Monatlicher Bericht (${format(reportDate, 'MMMM yyyy', { locale: de })})` : `Jahresbericht ${year}`;
    doc.text(title, 14, 20);

    let lastY = 30;

    const expensesByCategory = expenses.reduce((acc, t) => {
      const categoryName = categoryMap.get(t.categoryId) || 'Unbekannt';
      if (!acc[categoryName]) {
        acc[categoryName] = { transactions: [], total: 0 };
      }
      acc[categoryName].transactions.push(t);
      acc[categoryName].total += t.amount;
      return acc;
    }, {} as Record<string, {transactions: Transaction[], total: number}>);

    if (expenses.length > 0) {
      doc.text("Ausgaben", 14, lastY);
      
      const expenseBody = [];
      for (const categoryName in expensesByCategory) {
        expenseBody.push([{ content: categoryName, colSpan: 4, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
        expensesByCategory[categoryName].transactions.forEach(t => {
          expenseBody.push([
            format(t.date.toDate(), "dd.MM.yyyy"),
            t.description,
            formatCurrency(t.amount)
          ]);
        });
        expenseBody.push([{ content: `Summe ${categoryName}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(expensesByCategory[categoryName].total), styles: { fontStyle: 'bold' } }]);
      }
      
      doc.autoTable({
        startY: lastY + 5,
        head: [['Datum', 'Beschreibung', 'Betrag']],
        body: expenseBody,
        theme: 'striped'
      });
      lastY = doc.autoTable.previous.finalY;
    }

    if (income.length > 0) {
       lastY += 10;
      doc.text("Einnahmen", 14, lastY);
      const incomeBody = income.map(t => [
        format(t.date.toDate(), "dd.MM.yyyy"),
        t.description,
        formatCurrency(t.amount)
      ]);
       doc.autoTable({
        startY: lastY + 5,
        head: [['Datum', 'Beschreibung', 'Betrag']],
        body: incomeBody,
        theme: 'striped'
      });
      lastY = doc.autoTable.previous.finalY;
    }
   
    lastY += 10;
    doc.autoTable({
      startY: lastY,
      body: [
        [{ content: 'Gesamteinnahmen:', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalIncome), styles: { halign: 'right' } }],
        [{ content: 'Gesamtausgaben:', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalExpenses), styles: { halign: 'right' } }],
        [{ content: 'Ergebnis:', styles: { fontStyle: 'bold', fillColor: balance >= 0 ? [200, 255, 200] : [255, 200, 200] } }, { content: formatCurrency(balance), styles: { halign: 'right', fontStyle: 'bold', fillColor: balance >= 0 ? [200, 255, 200] : [255, 200, 200] } }],
      ],
      theme: 'grid',
    });
    lastY = doc.autoTable.previous.finalY;

    if (expenses.length > 0) {
        lastY += 10;
        doc.text("Zusammenfassung nach Kategorien", 14, lastY);
        const categorySummaryBody = Object.entries(expensesByCategory).map(([name, data]) => [name, formatCurrency(data.total)]);
        doc.autoTable({
            startY: lastY + 5,
            head: [['Kategorie', 'Gesamtbetrag']],
            body: categorySummaryBody,
            theme: 'grid'
        });
        lastY = doc.autoTable.previous.finalY;

        // Add Chart
        if (chartRef.current) {
            const canvas = await html2canvas(chartRef.current, {
                backgroundColor: null, // Transparent background
                scale: 3, // Increase resolution
            });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            const imgWidth = pdfWidth * 0.7; // Use 70% of page width
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            lastY += 10;

            if (lastY + imgHeight > pdfHeight - 20) {
                doc.addPage();
                lastY = 20;
            }

            doc.text("Ausgabenverteilung", 14, lastY);
            doc.addImage(imgData, 'PNG', 14, lastY + 5, imgWidth, imgHeight);
        }
    }


    doc.save(`${title.toLowerCase().replace(/\s/g, "-")}.pdf`);
  };
  
  const transactionsForYear = useMemo(() => {
    return transactions.filter(t => {
        const transactionDate = t.date.toDate();
        return isValid(transactionDate) && getYear(transactionDate) === currentYear;
    });
  }, [transactions, currentYear]);

  const expensesForYear = useMemo(() => {
    return transactionsForYear.filter(t => t.categoryId !== incomeCategory?.id);
  }, [transactionsForYear, incomeCategory]);


  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
      setCurrentYear(availableYears[0]);
    }
  }, [availableYears, currentYear, setCurrentYear]);

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
                    value={String(currentYear)}
                    onValueChange={(value) => setCurrentYear(Number(value))}
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
                <Button variant="secondary" onClick={() => generatePdf("monthly", currentYear, currentMonth)}>
                    <Download className="mr-2 h-4 w-4" />
                    Monatlicher Bericht (PDF)
                </Button>
                <Button variant="secondary" onClick={() => generatePdf("yearly", currentYear, currentMonth)}>
                    <Download className="mr-2 h-4 w-4" />
                    Jahresbericht (PDF)
                </Button>
            </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <CardTitle className="font-headline">Ausgabenverteilung {currentYear}</CardTitle>
            <CardDescription>Visuelle Aufschlüsselung Ihrer Ausgaben nach Kategorien für das ausgewählte Jahr.</CardDescription>
        </CardHeader>
        <CardContent>
            <div ref={chartRef}>
              <ExpensesPieChart transactions={expensesForYear} />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
