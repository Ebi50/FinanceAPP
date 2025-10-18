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
import { format, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";


type MappedTransaction = Omit<Transaction, 'id'> & { date: Date };
type RawRow = (string | number | Date | null)[];
type HeaderMapping = { [key: string]: string };

interface ImportTabProps {
  transactions: Transaction[];
  onImport: (transactions: (Omit<Transaction, "id" | "date"> & { date: Date; })[]) => void;
  categories: Category[];
}

export function ImportTab({ transactions, onImport, categories }: ImportTabProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const categoryIdMap = useMemo(() => {
    const catMap = new Map<string, string>();
    if (categories) {
        categories.forEach(c => {
            catMap.set(c.id, c.name);
        });
    }
    return catMap;
}, [categories]);

const categoryNameMap = useMemo(() => {
    const catMap = new Map<string, string>();
    if (categories) {
        categories.forEach(c => {
            catMap.set(c.name.toLowerCase(), c.id);
        });
    }
    return catMap;
}, [categories]);

  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<HeaderMapping>({});
  const [allParsedTransactions, setAllParsedTransactions] = useState<MappedTransaction[]>([]);

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
    const worksheetData = transactions.map((t) => {
        const dateObject = t.date instanceof Timestamp ? t.date.toDate() : t.date;
        const category = categoryIdMap.get(t.categoryId);
        const isIncome = category?.toLowerCase() === 'einnahmen';
        return {
          Datum: isValid(dateObject) ? format(dateObject, "yyyy-MM-dd") : "Ungültiges Datum",
          Beschreibung: t.description,
          Kategorie: category || "Unbekannt",
          Betrag: isIncome ? t.amount : -t.amount,
        }
      });
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            let allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];

                const fileYearMatch = file.name.match(/\d{4}/);
                const fileYear = fileYearMatch ? parseInt(fileYearMatch[0], 10) : new Date().getFullYear();
                
                const monthIndex = workbook.SheetNames.indexOf(sheetName);

                // Process Upper Block
                const upperBlockHeaderRow = json[2]; // Row 3 in Excel
                if (upperBlockHeaderRow) {
                    for (let colIdx = 0; colIdx <= 8; colIdx += 2) { // A-J -> 0-9
                        const categoryName = upperBlockHeaderRow[colIdx] as string;
                        if (categoryName && typeof categoryName === 'string') {
                            allDetectedCategories.add(categoryName);
                            for (let rowIdx = 3; rowIdx < 27; rowIdx++) { // Rows 4-27
                                const row = json[rowIdx];
                                if (!row) continue;
                                const cell1 = row[colIdx];
                                if (typeof cell1 === 'string' && cell1.toLowerCase().includes('summe')) break;
                                if (cell1 === null && row[colIdx + 1] === null) continue; // Skip empty lines

                                const amount = row[colIdx + 1] as number;
                                if (typeof amount !== 'number') continue;
                                
                                let description = categoryName;
                                let date: Date;

                                if (cell1 instanceof Date) {
                                    date = cell1;
                                } else if (typeof cell1 === 'string' && cell1.trim()) {
                                    description = cell1.trim();
                                    date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                } else {
                                    date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                }
                                
                                if (isValid(date)) {
                                    allTransactions.push({ description, amount, date, categoryId: categoryName });
                                }
                            }
                        }
                    }
                }

                 // Process Lower Block
                const lowerBlockHeaderRow = json[29]; // Row 30
                if (lowerBlockHeaderRow) {
                    for (let colIdx = 0; colIdx <= 12; colIdx += 2) { // A-N -> 0-13
                        const categoryName = lowerBlockHeaderRow[colIdx] as string;
                        if (categoryName && typeof categoryName === 'string') {
                             allDetectedCategories.add(categoryName);
                             for (let rowIdx = 30; rowIdx < 54; rowIdx++) { // Rows 31-54
                                const row = json[rowIdx];
                                if (!row) continue;
                                const cell1 = row[colIdx];
                                if (typeof cell1 === 'string' && cell1.toLowerCase().includes('summe')) break;
                                if (cell1 === null && row[colIdx + 1] === null) continue;

                                let amount = 0;
                                // Special KV logic
                                if (categoryName.toLowerCase().includes('kv')) {
                                    const amount1 = row[colIdx + 1] as number;
                                    const amount2 = row[colIdx + 2] as number; // Assuming second amount is next column
                                    if(typeof amount1 === 'number') amount += amount1;
                                    if(typeof amount2 === 'number') amount += amount2;
                                } else {
                                    const amountCell = row[colIdx + 1] as number;
                                     if(typeof amountCell === 'number') amount = amountCell;
                                }

                                if (amount === 0) continue;
                                
                                let description = categoryName;
                                let date: Date;
                                
                                 if (cell1 instanceof Date) {
                                    date = cell1;
                                } else if (typeof cell1 === 'string' && cell1.trim()) {
                                    description = cell1.trim();
                                    date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                } else {
                                    date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                }

                                if (isValid(date)) {
                                     if (amount < 0) {
                                        allTransactions.push({ description, amount: Math.abs(amount), date, categoryId: 'Einnahmen' });
                                        allDetectedCategories.add('Einnahmen');
                                    } else {
                                        allTransactions.push({ description, amount, date, categoryId: categoryName });
                                    }
                                }
                            }
                             if(categoryName.toLowerCase().includes('kv')) colIdx++; // Skip one extra column for KV
                        }
                    }
                }
            });

            if (allTransactions.length === 0) {
              toast({
                  variant: "destructive",
                  title: "Keine Transaktionen gefunden",
                  description: "Es konnten keine gültigen Transaktionen aus der Datei gelesen werden. Bitte überprüfen Sie das Format.",
              });
              return;
            }
            
            const uniqueCategories = Array.from(allDetectedCategories);
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
            setAllParsedTransactions(allTransactions);
            setIsMappingDialogOpen(true);

        } catch (error: any) {
            console.error("Fehler beim Verarbeiten der Datei:", error);
            toast({
                variant: "destructive",
                title: "Datei-Verarbeitung fehlgeschlagen",
                description: error.message || "Die Datei konnte nicht verarbeitet werden. Stellen Sie sicher, dass sie das richtige Format hat.",
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    reader.readAsArrayBuffer(file);
  };


  const processImport = () => {
    if (allParsedTransactions.length === 0) return;
  
    try {
      const transactionsWithMappedCategory = allParsedTransactions
        .map(t => {
          const excelCategoryName = t.categoryId; 
          const mappedAppCategoryId = headerMapping[excelCategoryName];
          
          if (!mappedAppCategoryId) return null;

          return { ...t, categoryId: mappedAppCategoryId };
        })
        .filter((t): t is MappedTransaction => t !== null);
  
      if (transactionsWithMappedCategory.length === 0) {
        toast({
            variant: "destructive",
            title: "Keine Transaktionen zuzuordnen",
            description: "Es wurden keine Transaktionen importiert, weil keine Kategorien zugeordnet wurden.",
        });
        setIsMappingDialogOpen(false);
        return;
      }
  
      onImport(transactionsWithMappedCategory);
      
      toast({
          title: "Import erfolgreich gestartet",
          description: `${transactionsWithMappedCategory.length} Transaktionen werden im Hintergrund importiert.`,
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
        setAllParsedTransactions([]);
        setDetectedHeaders([]);
        setHeaderMapping({});
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
                    Bitte ordnen Sie die gefundenen Kategorien aus Ihrer Excel-Datei den App-Kategorien zu. Nicht zugeordnete Kategorien werden nicht importiert.
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
