'use client';
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Download, FileUp, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { Transaction } from "@/lib/types";
import { categories } from "@/lib/data";
import React from "react";

interface ReportsTabProps {
  transactions: Transaction[];
  onImport: (transactions: Transaction[]) => void;
}

export function ReportsTab({ transactions, onImport }: ReportsTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const generatePdf = (period: "monthly" | "yearly") => {
    const doc = new jsPDF();
    const tableColumn = ["Datum", "Beschreibung", "Kategorie", "Betrag"];
    const tableRows: (string | number)[][] = [];

    const now = new Date();
    const filteredTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.date);
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
        format(new Date(t.date), "dd.MM.yyyy", { locale: de }),
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

  const handleExportExcel = () => {
    const worksheetData = transactions.map((t) => ({
      Datum: format(new Date(t.date), "yyyy-MM-dd"),
      Beschreibung: t.description,
      Kategorie: categoryMap.get(t.categoryId) || "Unbekannt",
      Betrag: t.amount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaktionen");
    XLSX.writeFile(workbook, "transaktionen.xlsx");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const yearMatch = file.name.match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null
        }) as any[][];

        const appCategoryMap = new Map(
          categories.map((c) => [c.name.toLowerCase(), c.id])
        );
        const newTransactions: Transaction[] = [];

        const headerRowIndex = json.findIndex(row => row.some(cell => typeof cell === 'string' && appCategoryMap.has(cell.split(' ')[0].toLowerCase())));
        if (headerRowIndex === -1) throw new Error("Keine gültigen Kategorie-Header gefunden.");
        
        const headers = json[headerRowIndex];
        const dataRows = json.slice(headerRowIndex + 1);

        for(let col = 0; col < headers.length; col++) {
          const header = headers[col];
          if (header && typeof header === 'string') {
            const categoryName = header.split(' ')[0].toLowerCase();
            const categoryId = appCategoryMap.get(categoryName);
            
            if (categoryId) {
              // Assuming 'Datum' is in the same column and 'Betrag' is in the next one
              const dateCol = col;
              const amountCol = col + 1;
              if (headers[amountCol] === 'Betrag') {
                for (const row of dataRows) {
                   const dateValue = row[dateCol];
                   const amountValue = row[amountCol];

                   if (amountValue && (typeof amountValue === 'number' || (typeof amountValue === 'string' && amountValue.trim() !== ''))) {
                      // Stop when we hit a 'Summe' row for this block
                      if (typeof row[dateCol-1] === 'string' && row[dateCol-1].toLowerCase().includes('summe')) break;
                      
                      let date;
                      if(dateValue) {
                         // Handle Excel date serial number or string DD.MM
                        if (typeof dateValue === 'number') {
                          date = XLSX.SSF.parse_date_code(dateValue);
                          date = new Date(year, date.m - 1, date.d);
                        } else if (typeof dateValue === 'string') {
                          const parts = dateValue.split('.').map(p => parseInt(p.trim(), 10));
                          if (parts.length >= 2) {
                            date = new Date(year, parts[1] - 1, parts[0]);
                          }
                        }
                      }
                      
                      if(date) {
                         newTransactions.push({
                            id: `imported-${Date.now()}-${newTransactions.length}`,
                            description: categories.find(c => c.id === categoryId)?.name || 'Importiert',
                            amount: typeof amountValue === 'number' ? amountValue : parseFloat(amountValue.replace(',', '.')),
                            date,
                            categoryId,
                         });
                      }
                   }
                }
              }
            }
          }
        }

        if (newTransactions.length === 0) {
          toast({
            variant: "destructive",
            title: "Import fehlgeschlagen",
            description: "Es konnten keine gültigen Transaktionen in der Datei gefunden werden. Bitte prüfen Sie das Format.",
          });
          return;
        }

        onImport(newTransactions);
        toast({
          title: "Import erfolgreich",
          description: `${newTransactions.length} Transaktionen wurden importiert.`,
        });
      } catch (error: any) {
        console.error("Fehler beim Importieren der Datei:", error);
        toast({
          variant: "destructive",
          title: "Import fehlgeschlagen",
          description: error.message || "Die Datei konnte nicht verarbeitet werden. Stellen Sie sicher, dass sie das richtige Format hat.",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input to allow importing the same file again
    event.target.value = "";
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
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Daten importieren & exportieren</CardTitle>
          <CardDescription>
            Laden Sie Ihre Ausgabendaten aus einer Excel-Datei hoch oder exportieren Sie sie.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={handleImportClick}>
            <FileUp className="mr-2 h-4 w-4" />
            Aus Excel importieren
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            className="hidden"
            accept=".xlsx, .xls"
          />
          <Button variant="secondary" onClick={handleExportExcel}>
            <FileDown className="mr-2 h-4 w-4" />
            Nach Excel exportieren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
