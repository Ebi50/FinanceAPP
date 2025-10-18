'use client';
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { FileUp, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import type { Transaction } from "@/lib/types";
import { categories } from "@/lib/data";
import React from "react";
import { format } from "date-fns";

interface ImportTabProps {
  onImport: (transactions: Transaction[]) => void;
  transactions: Transaction[];
}

export function ImportTab({ onImport, transactions }: ImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));


  const handleImportClick = () => {
    fileInputRef.current?.click();
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

        const headerRowIndex = json.findIndex(row => 
            Array.isArray(row) && row.some(cell => {
                if (typeof cell !== 'string') return false;
                const categoryName = cell.replace(/\s*\d+\s*$/, '').trim().toLowerCase();
                return appCategoryMap.has(categoryName);
            })
        );

        if (headerRowIndex === -1) throw new Error("Keine gültigen Kategorie-Header gefunden.");
        
        const headers = json[headerRowIndex];
        const dataRows = json.slice(headerRowIndex + 1);

        for(let col = 0; col < headers.length; col++) {
          const header = headers[col];
          if (header && typeof header === 'string') {
            const categoryName = header.replace(/\s*\d+\s*$/, '').trim().toLowerCase();
            const categoryId = appCategoryMap.get(categoryName);
            
            if (categoryId) {
              const dateCol = col;
              const amountCol = col + 1;
              let lastValidDate = new Date(year, 0, 15);
              
              if (headers[amountCol] === 'Betrag') {
                for (const row of dataRows) {
                   const dateValue = row[dateCol];
                   const amountValue = row[amountCol];

                   if ((dateValue === null || dateValue === '') && (amountValue === null || amountValue === '')) {
                     continue;
                   }
                   
                   if (amountValue && (typeof amountValue === 'number' || (typeof amountValue === 'string' && amountValue.trim() !== ''))) {
                      if (typeof row[dateCol-1] === 'string' && row[dateCol-1].toLowerCase().includes('summe')) break;
                      
                      let date: Date | null = null;
                      let description = categories.find(c => c.id === categoryId)?.name || 'Importiert';

                      if(dateValue) {
                        if (typeof dateValue === 'string' && isNaN(Date.parse(dateValue)) && !/^\d{1,2}\.\d{1,2}\.?$/.test(dateValue)) {
                            description = dateValue;
                            date = new Date(year, lastValidDate.getMonth(), 15);
                        } else if (typeof dateValue === 'number') {
                          const d = XLSX.SSF.parse_date_code(dateValue);
                          date = new Date(year, d.m - 1, d.d);
                        } else if (typeof dateValue === 'string') {
                          const parts = dateValue.split('.').map(p => parseInt(p.trim(), 10));
                          if (parts.length >= 2) {
                            date = new Date(year, parts[1] - 1, parts[0]);
                          }
                        }
                      }
                      
                      if(date) {
                         lastValidDate = date;
                         newTransactions.push({
                            id: `imported-${Date.now()}-${newTransactions.length}`,
                            description: description,
                            amount: typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue).replace(',', '.')),
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
    event.target.value = "";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
          <CardHeader>
            <CardTitle className="font-headline">Daten importieren</CardTitle>
            <CardDescription>
              Laden Sie Ihre Ausgabendaten aus einer Excel-Datei hoch.
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
          </CardContent>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle className="font-headline">Daten exportieren</CardTitle>
            <CardDescription>
                Laden Sie Ihre Ausgabendaten als Excel-Datei herunter.
            </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" onClick={handleExportExcel}>
                <FileDown className="mr-2 h-4 w-4" />
                Nach Excel exportieren
            </Button>
            </CardContent>
        </Card>
    </div>
  );
}
