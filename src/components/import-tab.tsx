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

type MappedTransaction = Omit<Transaction, 'id' | 'createdAt'>;
type RawRow = (string | number | Date | null)[];
type HeaderMapping = { [key: string]: string };

interface ImportTabProps {
  transactions: Transaction[];
  categories: Category[];
  onImport: (transactions: MappedTransaction[]) => void;
}

export function ImportTab({ transactions, categories, onImport }: ImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const categoryIdMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    return new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  }, [categories]);

  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<HeaderMapping>({});
  const [rawTransactionData, setRawTransactionData] = useState<RawRow[] | null>(null);
  const [fileYear, setFileYear] = useState<number>(new Date().getFullYear());


  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportExcel = () => {
    if (!transactions.length) {
      toast({
        variant: "destructive",
        title: "Keine Daten für den Export",
        description: "Es sind keine Transaktionen zum Exportieren vorhanden.",
      });
      return;
    }
    const worksheetData = transactions.map((t) => ({
      Datum: t.date instanceof Date ? format(t.date, "yyyy-MM-dd") : format(new Date((t.date as any).seconds * 1000), "yyyy-MM-dd"),
      Beschreibung: t.description,
      Kategorie: categoryIdMap.get(t.categoryId) || "Unbekannt",
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
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, sheets: 0 });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];

            if (!json || json.length < 2) {
                throw new Error("Die Excel-Datei ist zu klein oder konnte nicht gelesen werden.");
            }
            
            const yearMatch = file.name.match(/\d{4}/);
            setFileYear(yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear());

            const headerRowIndex = json.findIndex(row => 
                Array.isArray(row) && 
                row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'datum') &&
                row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'betrag')
            );
            
            if (headerRowIndex === -1) {
                 throw new Error("Kopfzeile mit 'Datum' und 'Betrag' nicht gefunden. Bitte prüfen Sie die Datei.");
            }
            
            const categoryRow = json[headerRowIndex - 1];
            if (!Array.isArray(categoryRow)) {
                 throw new Error("Die Zeile über der Kopfzeile konnte nicht als Kategoriezeile gelesen werden.");
            }

            let lastCategory = '';
            const filledCategoryRow = categoryRow.map(cell => {
                const cellStr = cell ? String(cell).trim() : '';
                if (cellStr) {
                    lastCategory = cellStr;
                }
                return lastCategory;
            });

            const uniqueCategories = [...new Set(filledCategoryRow.filter(c => c))];

            if (uniqueCategories.length === 0) {
              throw new Error("Keine zuzuordnenden Kategorien in der Datei gefunden.");
            }

            setRawTransactionData(json);
            setDetectedHeaders(uniqueCategories);

            const initialMapping: HeaderMapping = {};
            uniqueCategories.forEach(header => {
                const foundCatId = categoryNameMap.get(header.toLowerCase());
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
        const newTransactions: MappedTransaction[] = [];
        
        const headerRowIndex = rawTransactionData.findIndex(row => 
            Array.isArray(row) && 
            row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'datum') &&
            row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'betrag')
        );

        if (headerRowIndex === -1) {
            throw new Error("Konnte die Kopfzeile beim Verarbeiten nicht finden.");
        }

        const categoryRow = rawTransactionData[headerRowIndex - 1];
        let lastCategory = '';
        const filledCategoryRow = categoryRow.map(cell => {
            const cellStr = cell ? String(cell).trim() : '';
            if (cellStr) lastCategory = cellStr;
            return lastCategory;
        });

        const headerRow = rawTransactionData[headerRowIndex];
        const colMap: { [key: string]: number } = {};
        headerRow.forEach((cell, index) => {
            if (typeof cell === 'string') {
                const cellStr = cell.trim().toLowerCase();
                if (cellStr === 'datum' || cellStr === 'beschreibung' || cellStr === 'betrag') {
                    colMap[cellStr] = index;
                }
            }
        });
        
        if (colMap['datum'] === undefined || colMap['betrag'] === undefined) {
             throw new Error("Benötigte Spalten 'Datum' oder 'Betrag' nicht gefunden.");
        }

        for (let dataRowIndex = headerRowIndex + 1; dataRowIndex < rawTransactionData.length; dataRowIndex++) {
            const dataRow = rawTransactionData[dataRowIndex];
            
            if (!Array.isArray(dataRow) || dataRow.every(c => c === null || String(c).trim() === '') || String(dataRow[colMap['datum']]).toLowerCase().includes('summe')) {
                continue;
            }

            const dateValue = dataRow[colMap['datum']];
            const amountValue = dataRow[colMap['betrag']];
            const descriptionValue = colMap['beschreibung'] !== undefined ? dataRow[colMap['beschreibung']] : null;
            
            // Find the category for this row's amount
            const categoryName = filledCategoryRow[colMap['betrag']];
            if (!categoryName || amountValue === null || String(amountValue).trim() === '') continue;

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
                       date = new Date(fileYear, month - 1, day);
                   }
               }
            }
            if(!date) continue;
            
            const description = descriptionValue ? String(descriptionValue) : categoryName;
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
        
        if (newTransactions.length === 0) {
          throw new Error("Es konnten keine gültigen Transaktionen zum Importieren gefunden werden.");
        }

        onImport(newTransactions);

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
          <CardContent>
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
            <CardContent>
            <Button variant="secondary" onClick={handleExportExcel} disabled={transactions.length === 0}>
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
                                        {cat.name}
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
