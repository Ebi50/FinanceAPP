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
import type { Transaction, Category } from "@/lib/types";
import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

interface ImportTabProps {
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  transactions: Transaction[];
}

type RawTransactionData = any[][];
type HeaderMapping = { [key: string]: string };

export function ImportTab({ onImport, transactions }: ImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const categoriesQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'expenseCategories') : null, [firestore, user]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  
  const categoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const appCategoryMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  }, [categories]);

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
      Datum: format(new Date(t.date.toString()), "yyyy-MM-dd"),
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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, bookVBA: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null
        }) as RawTransactionData;
        
        if (!json || json.length === 0) {
            throw new Error("Die Excel-Datei ist leer oder konnte nicht gelesen werden.");
        }

        setRawTransactionData(json);
        
        const dataHeaderRowIndex = json.findIndex(row => 
            Array.isArray(row) && row.some(cell => {
                const cellStr = String(cell || '').trim().toLowerCase();
                return ['datum', 'beschreibung', 'betrag'].includes(cellStr);
            })
        );
        
        if (dataHeaderRowIndex === -1 || dataHeaderRowIndex === 0) {
            throw new Error("Es konnte keine gültige Kopfzeile mit 'Datum' und 'Betrag' gefunden werden. Stellen Sie sicher, dass eine Zeile darüber für die Kategorien existiert.");
        }
        
        const categoryRow = json[dataHeaderRowIndex - 1];
        const excelHeadersToMap: string[] = [];
        let lastCategory: string | null = null;
        
        for (let i = 0; i < categoryRow.length; i++) {
            const categoryName = categoryRow[i];
            
            if (categoryName && typeof categoryName === 'string' && categoryName.trim() !== '') {
                lastCategory = categoryName.trim();
            }

            if (lastCategory && !excelHeadersToMap.includes(lastCategory)) {
                 const dataHeaderCell = String(json[dataHeaderRowIndex][i] || '').trim().toLowerCase();
                 if (dataHeaderCell === 'datum') {
                    excelHeadersToMap.push(lastCategory);
                 }
            }
        }
        
        const uniqueHeaders = [...new Set(excelHeadersToMap)];

        if (uniqueHeaders.length === 0) {
          throw new Error("Keine zuzuordnenden Kategorien in der Datei gefunden. Bitte prüfen Sie die Struktur Ihrer Excel-Datei.");
        }

        setDetectedHeaders(uniqueHeaders);
        const initialMapping: HeaderMapping = {};
        uniqueHeaders.forEach(header => {
            const simplifiedHeader = header.toLowerCase().replace(/\s*\d+\s*$/, '').trim();
            const foundCatId = appCategoryMap.get(header.toLowerCase()) || appCategoryMap.get(simplifiedHeader);
            if (foundCatId) {
                initialMapping[header] = foundCatId;
            } else {
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
        const newTransactions: Omit<Transaction, 'id'>[] = [];
        const json = rawTransactionData;

        const dataHeaderRowIndex = json.findIndex(row => 
            Array.isArray(row) && row.some(cell => {
                const cellStr = String(cell || '').trim().toLowerCase();
                return ['datum', 'beschreibung', 'betrag'].includes(cellStr);
            })
        );
        
        if (dataHeaderRowIndex === -1) throw new Error("Konnte die Daten-Kopfzeile nicht erneut finden.");

        const categoryRow = json[dataHeaderRowIndex - 1];
        const dataHeaderRow = json[dataHeaderRowIndex].map(h => String(h || '').toLowerCase());
        const dataRows = json.slice(dataHeaderRowIndex + 1);

        const filledCategoryRow = categoryRow.reduce((acc, cell, i) => {
            if (cell && String(cell).trim() !== '') {
                acc[i] = String(cell).trim();
            } else if (i > 0 && acc[i-1]) {
                acc[i] = acc[i-1];
            } else {
                acc[i] = null;
            }
            return acc;
        }, [] as (string | null)[]);

        for (let col = 0; col < dataHeaderRow.length; col++) {
            const dataHeader = dataHeaderRow[col];
            const excelCategoryName = filledCategoryRow[col];

            if (excelCategoryName && dataHeader === 'datum') {
                const appCategoryId = headerMapping[excelCategoryName];
                
                if (appCategoryId) {
                    let lastValidDate: Date | null = null;
                    for (const row of dataRows) {
                        if ((!row[col] && !row[col + 1] && !row[col + 2])) continue;
                        if (String(row[col] || '').toLowerCase().includes('summe') || String(row[col + 2] || '').toLowerCase().includes('summe')) break;

                        const dateValue = row[col];
                        const descriptionValue = row[col+1];
                        const amountValue = row[col + 2]; 
                        
                        if (amountValue && (typeof amountValue === 'number' || String(amountValue).trim() !== '')) {
                            let date: Date | null = null;
                            if (dateValue instanceof Date) {
                                date = dateValue;
                                lastValidDate = date;
                            } else if (typeof dateValue === 'string' && dateValue.includes('.')) {
                                const parts = dateValue.split('.').map(p => parseInt(p.trim(), 10));
                                if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                    date = new Date(currentYear, parts[1] - 1, parts[0]);
                                    lastValidDate = date;
                                }
                            } else if (typeof dateValue === 'number') { 
                                date = XLSX.SSF.parse_date_code(dateValue);
                                lastValidDate = date;
                            } else if (lastValidDate) { 
                                date = lastValidDate;
                            }

                            if (date) {
                                const amount = typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue).replace('.', '').replace(',', '.'));
                                if (!isNaN(amount) && amount > 0) {
                                    newTransactions.push({
                                        description: String(descriptionValue || excelCategoryName),
                                        amount: amount,
                                        date,
                                        categoryId: appCategoryId,
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
              accept=".xlsx, .xls, .xlsm"
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
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto pr-2">
                {detectedHeaders.map(header => (
                    <div key={header} className="grid grid-cols-[1fr_1fr] items-center gap-4">
                        <Label htmlFor={`mapping-${header}`} className="text-left font-semibold truncate">
                          {header}
                        </Label>
                        <Select
                            value={headerMapping[header] || ''}
                            onValueChange={(value) => handleMappingChange(header, value)}
                        >
                            <SelectTrigger id={`mapping-${header}`} className="w-full">
                                <SelectValue placeholder="Kategorie auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories?.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        <div className="flex items-center gap-2">
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
