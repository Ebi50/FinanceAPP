'use client';
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter as UiTableFooter,
} from "@/components/ui/table";
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
import { ExpensesChart } from "./expenses-chart";
import { formatCurrency, cn } from "@/lib/utils";
import html2canvas from "html2canvas";

interface ReportsTabProps {
  transactions: Transaction[];
  availableYears: number[];
  currentYear: number;
  setCurrentYear: (year: number) => void;
}

interface AutoTableDoc extends jsPDF {
  autoTable: (options: any) => jsPDF;
}


export function ReportsTab({ transactions, availableYears, currentYear, setCurrentYear }: ReportsTabProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth());


  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);
  
  const categoryMap = useMemo(() => {
    if(!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);
  
  const incomeCategory = useMemo(() => categories?.find(c => c.name.toLowerCase() === 'einnahmen'), [categories]);

  const [transactionsForChart, setTransactionsForChart] = useState<Transaction[]>([]);
  const [yearlyTransactions, setYearlyTransactions] = useState<Transaction[]>([]);
  const periodTitle = selectedMonth !== null ? `${de.localize?.month(selectedMonth, { width: 'long' })} ${currentYear}` : `Gesamtjahr ${currentYear}`;

  const generatePdf = async (period: "monthly" | "yearly", year: number, month: number | null) => {
    const doc = new jsPDF() as AutoTableDoc;
    
    let reportTransactions = transactions.filter(t => {
        const transactionDate = t.date.toDate();
        return isValid(transactionDate) && getYear(transactionDate) === year;
    });

    let title;
    if (period === "monthly" && month !== null) {
        reportTransactions = reportTransactions.filter(t => getMonth(t.date.toDate()) === month);
        title = `Monatlicher Bericht (${format(new Date(year, month), 'MMMM yyyy', { locale: de })})`;
    } else {
        title = `Jahresbericht ${year}`;
    }
    
    const chartDataForPdf = period === 'monthly' && month !== null 
    ? reportTransactions 
    : yearlyTransactions;

    // Update state for the chart to render with the correct data
    setTransactionsForChart(chartDataForPdf.filter(t => t.categoryId !== incomeCategory?.id));
    
    // Wait for the chart to re-render with new data
    await new Promise(resolve => setTimeout(resolve, 500));


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
        expenseBody.push([{ content: categoryName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } }]);
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
        theme: 'striped',
        didParseCell: (data) => {
            if (typeof data.cell.raw === 'object' && data.cell.raw !== null && 'colSpan' in data.cell.raw) {
                data.cell.styles.halign = 'left';
            }
        }
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
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 'auto' } }
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
            const imgWidth = pdfWidth * 0.9; // Use 90% of page width
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
    setTransactionsForChart([]); // Reset chart data
  };
  
  useEffect(() => {
    const yearlyData = transactions.filter(t => {
      const transactionDate = t.date.toDate();
      return isValid(transactionDate) && getYear(transactionDate) === currentYear;
    });
    setYearlyTransactions(yearlyData);
  }, [transactions, currentYear]);

  const filteredTableTransactions = useMemo(() => {
    if (selectedMonth === null) {
      return yearlyTransactions;
    }
    return yearlyTransactions.filter(t => {
      const transactionDate = t.date.toDate();
      return isValid(transactionDate) && getMonth(transactionDate) === selectedMonth;
    });
  }, [yearlyTransactions, selectedMonth]);

  useEffect(() => {
    // This effect now correctly filters the data for the chart based on the selected month
    const expensesForChart = filteredTableTransactions.filter(t => t.categoryId !== incomeCategory?.id);
    setTransactionsForChart(expensesForChart);
  }, [filteredTableTransactions, incomeCategory]);


  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
      setCurrentYear(availableYears[0]);
    }
  }, [availableYears, currentYear, setCurrentYear]);

  const expensesByCategoryForTable = useMemo(() => {
    const expenses = filteredTableTransactions
      .filter(t => t.categoryId !== incomeCategory?.id)
      .reduce((acc, transaction) => {
      const categoryName = categoryMap.get(transaction.categoryId) || 'Sonstiges';
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += transaction.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(expenses).map(([name, total]) => ({
      name,
      total
    })).sort((a,b) => b.total - a.total);
  }, [filteredTableTransactions, categoryMap, incomeCategory]);
  
  const incomeByDescriptionForTable = useMemo(() => {
    if (!incomeCategory) return [];
    
    const incomes = filteredTableTransactions
      .filter(t => t.categoryId === incomeCategory.id)
      .reduce((acc, transaction) => {
        const description = transaction.description || 'Unbekannte Einnahme';
        if (!acc[description]) {
          acc[description] = 0;
        }
        acc[description] += transaction.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(incomes).map(([name, total]) => ({
      name,
      total
    })).sort((a,b) => b.total - a.total);
  }, [filteredTableTransactions, incomeCategory]);

  const totalExpenses = useMemo(() => expensesByCategoryForTable.reduce((sum, item) => sum + item.total, 0), [expensesByCategoryForTable]);
  const totalIncome = useMemo(() => incomeByDescriptionForTable.reduce((sum, item) => sum + item.total, 0), [incomeByDescriptionForTable]);
  const balance = totalIncome - totalExpenses;
  

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <Label htmlFor="year-select-reports">Jahr auswählen</Label>
          <Select
              value={String(currentYear)}
              onValueChange={(value) => setCurrentYear(Number(value))}
              disabled={availableYears.length === 0}
          >
              <SelectTrigger id="year-select-reports" className="w-[120px]">
                  <SelectValue placeholder="Jahr" />
              </SelectTrigger>
              <SelectContent>
                  {availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="month-select-reports">Monat auswählen</Label>
          <Select
              value={selectedMonth === null ? 'all' : String(selectedMonth)}
              onValueChange={(value) => {
                  if (value === 'all') {
                      setSelectedMonth(null);
                  } else {
                      setSelectedMonth(Number(value));
                  }
              }}
          >
              <SelectTrigger id="month-select-reports" className="w-[180px]">
                  <SelectValue placeholder="Monat" />
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
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-3 flex flex-col gap-4">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">Berichte erstellen</CardTitle>
                <CardDescription>
                Laden Sie Ihre monatlichen oder jährlichen Ausgabenberichte herunter.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
                <Button variant="secondary" onClick={() => generatePdf("monthly", currentYear, selectedMonth)} disabled={selectedMonth === null}>
                    <Download className="mr-2 h-4 w-4" />
                    Monatlicher Bericht (PDF)
                </Button>
                <Button variant="secondary" onClick={() => generatePdf("yearly", currentYear, null)}>
                    <Download className="mr-2 h-4 w-4" />
                    Jahresbericht (PDF)
                </Button>
            </CardContent>
            </Card>
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">Ausgabenverteilung {periodTitle}</CardTitle>
                <CardDescription>Visuelle Aufschlüsselung Ihrer Ausgaben nach Kategorien für den ausgewählten Zeitraum.</CardDescription>
            </CardHeader>
            <CardContent>
                {transactionsForChart.length > 0 ? (
                <div ref={chartRef}>
                    <ExpensesChart transactions={transactionsForChart} />
                </div>
                ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    Keine Ausgabendaten für den ausgewählten Zeitraum vorhanden.
                </div>
                )}
            </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Einnahmenübersicht {periodTitle}</CardTitle>
                    <CardDescription>Gesamteinnahmen für den ausgewählten Zeitraum.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Einnahmequelle</TableHead>
                                <TableHead className="text-right">Gesamtbetrag</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {incomeByDescriptionForTable.length > 0 ? incomeByDescriptionForTable.map(item => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">Keine Einnahmen in diesem Zeitraum erfasst.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <UiTableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Gesamtsumme</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalIncome)}</TableCell>
                            </TableRow>
                        </UiTableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Kategorienübersicht {periodTitle}</CardTitle>
                    <CardDescription>Gesamtausgaben pro Kategorie für den ausgewählten Zeitraum.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kategorie</TableHead>
                                <TableHead className="text-right">Gesamtbetrag</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expensesByCategoryForTable.map(item => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                            ))}
                             {expensesByCategoryForTable.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">Keine Ausgaben in diesem Zeitraum.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <UiTableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Gesamtsumme</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalExpenses)}</TableCell>
                            </TableRow>
                        </UiTableFooter>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Zusammenfassung {periodTitle}</CardTitle>
                    <CardDescription>
                        Gesamtergebnis für den ausgewählten Zeitraum.
                    </CardDescription>
                </Header>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Gesamteinnahmen</span>
                        <span className="text-emerald-500 font-semibold">{formatCurrency(totalIncome)}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-medium">Gesamtausgaben</span>
                        <span className="text-destructive font-semibold">{formatCurrency(totalExpenses)}</span>
                    </div>
                     <div className={cn(
                        "flex justify-between items-center border-t pt-4 mt-4",
                        balance >= 0 ? "text-emerald-600" : "text-destructive"
                        )}>
                        <span className="font-bold text-lg">Differenz</span>
                        <span className="font-bold text-lg">{formatCurrency(balance)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
      {/* Hidden container for rendering chart for PDF */}
      <div className="absolute -z-10" style={{ left: '-9999px', top: '-9999px', width: '800px', height: 'auto' }}>
          <div ref={chartRef}>
              {transactionsForChart.length > 0 && <ExpensesChart transactions={transactionsForChart} />}
          </div>
      </div>
    </>
  );
}
