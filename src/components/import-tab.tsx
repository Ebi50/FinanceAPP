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
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';

interface ImportTabProps {
  transactions: Transaction[];
}

type RawTransactionData = (string | number | null)[][];
type HeaderMapping = { [key: string]: string };

export function ImportTab({ transactions }: ImportTabProps) {
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
      Datum: t.date instanceof Date ? format(t.date, "yyyy-MM-dd") : format(new Date((t.date as any).seconds * 1000), "yyyy-MM-dd"),
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, sheets: 0 });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: null
            }) as RawTransactionData;
    
            if (!json || json.length < 1) {
                throw new Error("Die Excel-Datei ist leer oder konnte nicht gelesen werden.");
            }

            const headerRowIndex = json.findIndex(row => 
                Array.isArray(row) && 
                row.some(cell => String(cell).trim().toLowerCase() === 'datum') &&
                row.some(cell => String(cell).trim().toLowerCase() === 'betrag')
            );
            
            if (headerRowIndex === -1 || headerRowIndex === 0) {
                 throw new Error("Gültige Kopfzeile mit 'Datum' und 'Betrag' nicht gefunden oder sie befindet sich in der ersten Zeile.");
            }

            const categoryRow = json[headerRowIndex - 1];
            if (!Array.isArray(categoryRow)) {
                 throw new Error("Die Zeile über der Kopfzeile konnte nicht als Kategoriezeile gelesen werden.");
            }
            
            let lastCategory = '';
            const filledCategoryRow = categoryRow.map(cell => {
                const cellStr = cell ? String(cell).trim() : '';
                if (cellStr) {
                    const cleanedCategory = cellStr.replace(/\s+\d+$/, '').trim();
                    if(cleanedCategory) {
                       lastCategory = cleanedCategory;
                       return lastCategory;
                    }
                }
                return lastCategory;
            });
            
            const uniqueCategories = [...new Set(filledCategoryRow.filter(c => c))];

            if (uniqueCategories.length === 0) {
              throw new Error("Keine zuzuordnenden Kategorien in der Datei gefunden. Bitte prüfen Sie die Struktur Ihrer Excel-Datei.");
            }
    
            setRawTransactionData(json);
            setDetectedHeaders(uniqueCategories);
    
            const initialMapping: HeaderMapping = {};
            uniqueCategories.forEach(header => {
                const foundCatId = appCategoryMap.get(header.toLowerCase());
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


  const processImport = async () => {
    if (!rawTransactionData || !user) return;

    try {
        const newTransactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];
        const data = rawTransactionData;

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (!Array.isArray(row)) continue;

            const isHeaderRow = row.some(cell => String(cell).trim().toLowerCase() === 'datum') &&
                                row.some(cell => String(cell).trim().toLowerCase() === 'betrag');

            if (isHeaderRow && rowIndex > 0) {
                const categoryRow = data[rowIndex - 1];
                let lastCategory = '';
                const filledCategoryRow = categoryRow.map(cell => {
                    const cellStr = cell ? String(cell).trim() : '';
                    if (cellStr) {
                        const cleanedCategory = cellStr.replace(/\s+\d+$/, '').trim();
                        if(cleanedCategory) {
                           lastCategory = cleanedCategory;
                           return lastCategory;
                        }
                    }
                    return lastCategory;
                });
                
                const colMap: { [key: string]: number } = {};
                row.forEach((cell, index) => {
                    const cellStr = String(cell).trim().toLowerCase();
                    if (cellStr === 'datum' || cellStr === 'beschreibung' || cellStr === 'betrag') {
                        colMap[cellStr] = index;
                    }
                });

                if (colMap['datum'] === undefined || colMap['betrag'] === undefined) {
                    continue; 
                }

                for (let dataRowIndex = rowIndex + 1; dataRowIndex < data.length; dataRowIndex++) {
                    const dataRow = data[dataRowIndex];
                    if (!Array.isArray(dataRow) || dataRow.every(c => c === null || String(c).trim() === '') || String(dataRow[colMap['datum']]).toLowerCase().includes('summe')) {
                        rowIndex = dataRowIndex;
                        break; 
                    }
                    
                    const dateValue = dataRow[colMap['datum']];
                    const descriptionValue = colMap['beschreibung'] !== undefined ? dataRow[colMap['beschreibung']] : null;
                    const amountValue = dataRow[colMap['betrag']];
                    const categoryName = filledCategoryRow[colMap['datum']];

                    if (!categoryName || amountValue === null || amountValue === undefined || String(amountValue).trim() === '') continue;

                    const appCategoryId = headerMapping[categoryName];
                    if (!appCategoryId) continue;
                    
                    let date: Date | null = null;
                    if (dateValue instanceof Date) {
                       date = dateValue;
                    } else if (typeof dateValue === 'number' && dateValue > 1) { // Excel date number
                        const excelEpoch = new Date(1899, 11, 30);
                        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
                    } else if (typeof dateValue === 'string') {
                       const parts = dateValue.match(/(\d{1,2})\.(\d{1,2})/);
                       if(parts) {
                           const day = parseInt(parts[1], 10);
                           const month = parseInt(parts[2], 10);
                           if (!isNaN(day) && !isNaN(month)) {
                               date = new Date(currentYear, month - 1, day);
                           }
                       }
                    }
                    
                    const description = descriptionValue ? String(descriptionValue) : categoryName;
                    if(!date || !description) continue;
                    
                    const amount = typeof amountValue === 'number' ? amountValue : parseFloat(String(amountValue).replace('.', '').replace(',', '.'));

                    if (!isNaN(amount) && amount !== 0) {
                        newTransactions.push({
                            description: String(description),
                            amount: Math.abs(amount),
                            date,
                            categoryId: appCategoryId,
                        });
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

        const coll = collection(firestore, 'users', user.uid, 'transactions');
        for (const newT of newTransactions) {
            addDocumentNonBlocking(coll, {...newT, createdAt: serverTimestamp()});
        }
        
        toast({
          title: "Import erfolgreich",
          description: `${newTransactions.length} Transaktionen werden importiert.`,
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
              accept=".xlsx, .xls, .ods"
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
                    <div key={header} className="grid grid-cols-2 items-center gap-4">
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
