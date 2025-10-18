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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { FileUp, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import type { Transaction } from "@/lib/types";
import { categories } from "@/lib/data";
import React, { useState } from "react";
import { format } from "date-fns";

interface ImportTabProps {
  onImport: (transactions: Transaction[]) => void;
  transactions: Transaction[];
}

type RawTransactionData = any[][];
type HeaderMapping = { [key: string]: string };

export function ImportTab({ onImport, transactions }: ImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const appCategoryMap = new Map(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  );

  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<HeaderMapping>({});
  const [rawTransactionData, setRawTransactionData] = useState<RawTransactionData | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());


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
        setCurrentYear(year);

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null
        }) as RawTransactionData;

        setRawTransactionData(json);
        
        const headerRowIndex = json.findIndex(row => 
            Array.isArray(row) && row.some(cell => {
                if (typeof cell !== 'string' || !cell.trim()) return false;
                const categoryName = cell.replace(/\s*\d+\s*$/, '').trim().toLowerCase();
                return appCategoryMap.has(categoryName) || ['einnahmen:', 'haushalt', 'betrag'].includes(categoryName);
            })
        );
        
        if (headerRowIndex === -1) throw new Error("Keine gültigen Kategorie-Header gefunden.");
        
        const excelHeaders = json[headerRowIndex].filter(h => h && typeof h === 'string' && h.trim() !== '' && h.toLowerCase() !== 'betrag');

        const uniqueHeaders = [...new Set(excelHeaders.map(h => h.replace(/\s*\d+\s*$/, '').trim()))];

        setDetectedHeaders(uniqueHeaders);
        const initialMapping: HeaderMapping = {};
        uniqueHeaders.forEach(header => {
            const foundCat = appCategoryMap.get(header.toLowerCase());
            if (foundCat) {
                initialMapping[header] = foundCat;
            } else if (header.toLowerCase() === 'haushalt') {
                initialMapping[header] = appCategoryMap.get('wohnen') || '';
            }
             else {
                initialMapping[header] = '';
            }
        });
        setHeaderMapping(initialMapping);
        setIsMappingDialogOpen(true);

      } catch (error: any) {
        console.error("Fehler beim Verarbeiten der Datei:", error);
        toast({
          variant: "destructive",
          title: "Datei-Verarbeitung fehlgeschlagen",
          description: error.message || "Die Datei konnte nicht verarbeitet werden. Stellen Sie sicher, dass sie das richtige Format hat.",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const processImport = () => {
    if (!rawTransactionData) return;

    try {
        const newTransactions: Transaction[] = [];
        const json = rawTransactionData;

        const headerRowIndex = json.findIndex(row => 
            Array.isArray(row) && row.some(cell => {
                if (typeof cell !== 'string' || !cell.trim()) return false;
                const categoryName = cell.replace(/\s*\d+\s*$/, '').trim().toLowerCase();
                return appCategoryMap.has(categoryName) || ['einnahmen:', 'haushalt', 'betrag'].includes(categoryName);
            })
        );

        const headers = json[headerRowIndex].map(h => typeof h === 'string' ? h : '');
        const dataRows = json.slice(headerRowIndex + 1);

        for(let col = 0; col < headers.length; col++) {
          const header = headers[col];
          if (header && typeof header === 'string') {
            const cleanHeader = header.replace(/\s*\d+\s*$/, '').trim();
            const categoryId = headerMapping[cleanHeader];
            
            if (cleanHeader.toLowerCase().startsWith('einnahmen')) {
                continue;
            }

            if (categoryId) {
              const dateCol = col;
              const amountCol = col + 1;
              let lastValidDate = new Date(currentYear, 0, 15);
              
              if (headers[amountCol] === 'Betrag' || headers[amountCol] === '' || headers[amountCol] === null) {
                for (const row of dataRows) {
                   if (row[dateCol] && typeof row[dateCol] === 'string' && row[dateCol].toLowerCase().includes('summe')) break;

                   const dateValue = row[dateCol];
                   const amountValue = row[amountCol];

                   if ((dateValue === null || dateValue === '') && (amountValue === null || amountValue === '')) {
                     continue;
                   }
                   
                   if (amountValue && (typeof amountValue === 'number' || (typeof amountValue === 'string' && String(amountValue).trim() !== ''))) {
                      let date: Date | null = null;
                      let description = categories.find(c => c.id === categoryId)?.name || 'Importiert';

                      if(dateValue) {
                        if (typeof dateValue === 'string' && isNaN(Date.parse(dateValue)) && !/^\d{1,2}\.\d{1,2}\.?$/.test(dateValue)) {
                            description = dateValue;
                            date = new Date(lastValidDate.getFullYear(), lastValidDate.getMonth(), 15);
                        } else if (dateValue instanceof Date) {
                            date = dateValue;
                        } else if (typeof dateValue === 'number') { 
                          const d = XLSX.SSF.parse_date_code(dateValue);
                          date = new Date(currentYear, d.m - 1, d.d);
                        } else if (typeof dateValue === 'string') {
                          const parts = dateValue.split('.').map(p => parseInt(p.trim(), 10));
                          if (parts.length >= 2) {
                            date = new Date(currentYear, parts[1] - 1, parts[0] || 1);
                          }
                        }
                      } else {
                        date = new Date(lastValidDate.getFullYear(), lastValidDate.getMonth(), 15);
                      }
                      
                      if(date) {
                         lastValidDate = date;
                         const amount = typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue).replace('.', '').replace(',', '.'));
                         if (!isNaN(amount)) {
                             newTransactions.push({
                                id: `imported-${Date.now()}-${newTransactions.length}`,
                                description: description,
                                amount: amount,
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
        }

        if (newTransactions.length === 0) {
          toast({
            variant: "destructive",
            title: "Import fehlgeschlagen",
            description: "Es konnten keine gültigen Transaktionen in der Datei gefunden werden. Bitte prüfen Sie das Format und die Zuordnung.",
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
            description: error.message || "Die Datei konnte nicht verarbeitet werden.",
        });
    } finally {
        setIsMappingDialogOpen(false);
        setRawTransactionData(null);
    }
  };

  const handleMappingChange = (excelHeader: string, appCategoryId: string) => {
    setHeaderMapping(prev => ({ ...prev, [excelHeader]: appCategoryId }));
  };

  return (
    <>
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
    <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Kategorien zuordnen</DialogTitle>
                <DialogDescription>
                    Bitte ordnen Sie die gefundenen Kategorien aus Ihrer Excel-Datei den App-Kategorien zu.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-96 overflow-y-auto pr-2">
                {detectedHeaders.map(header => (
                    <div key={header} className="grid grid-cols-2 items-center gap-4">
                        <Label htmlFor={`mapping-${header}`}>{header}</Label>
                        <Select
                            value={headerMapping[header] || ''}
                            onValueChange={(value) => handleMappingChange(header, value)}
                        >
                            <SelectTrigger id={`mapping-${header}`}>
                                <SelectValue placeholder="Kategorie auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        <div className="flex items-center gap-2">
                                            <cat.icon className="h-4 w-4" />
                                            {cat.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ))}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={processImport}>Importieren</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
