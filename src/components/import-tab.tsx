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

type MappedTransaction = Omit<Transaction, 'id' | 'createdAt'>;
type RawRow = (string | number | Date | null)[];
type HeaderMapping = { [key: string]: string };

interface ImportTabProps {
  transactions: Transaction[];
  onImport: (transactions: MappedTransaction[]) => void;
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
      const date = t.date.toDate();
      const category = categoryIdMap.get(t.categoryId);
      const isIncome = category?.toLowerCase() === 'einnahmen';
      return {
        Datum: isValid(date) ? format(date, "yyyy-MM-dd") : "Ungültiges Datum",
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
            
            const fileYearMatch = file.name.match(/\d{4}/);
            const fileYear = fileYearMatch ? parseInt(fileYearMatch[0], 10) : new Date().getFullYear();

            const monthMap: {[key: string]: number} = { 'jan': 0, 'feb': 1, 'mär': 2, 'apr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11 };
            
            const allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach(sheetName => {
                const monthStr = sheetName.toLowerCase().slice(0, 3);
                const monthIndex = monthMap[monthStr];

                if (monthIndex === undefined) return;

                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];
                
                if (rawJson.length < 1) return;
                
                const incomeCategoryId = categoryNameMap.get('einnahmen');

                // Phase 1: Process horizontal blocks (upper part of the sheet, A-K)
                const headerRow = rawJson[0] || [];
                for (let col = 0; col < 11; col += 2) { 
                    const categoryNameCell = headerRow[col];
                    if (typeof categoryNameCell === 'string' && categoryNameCell.trim()) {
                        const categoryName = categoryNameCell.trim();
                        allDetectedCategories.add(categoryName);
                        
                        let currentRow = 2; // Start from the third row
                        while (currentRow < 29 && currentRow < rawJson.length) {
                            const rowData = rawJson[currentRow];
                            if (!rowData || !rowData[col] && !rowData[col+1] || (typeof rowData[col] === 'string' && String(rowData[col]).toLowerCase().includes('summe'))) {
                                break;
                            }

                            const dateOrDescCell = rowData[col];
                            const amountCell = rowData[col + 1];

                            if (amountCell !== null && amountCell !== undefined && String(amountCell).trim() !== '') {
                                let date: Date | null = null;
                                let description: string = '';

                                if (dateOrDescCell instanceof Date && isValid(dateOrDescCell)) {
                                    date = new Date(Date.UTC(fileYear, monthIndex, dateOrDescCell.getUTCDate(), 12, 0, 0));
                                    description = categoryName;
                                } else if (typeof dateOrDescCell === 'string') {
                                    const dayMatch = dateOrDescCell.match(/^(\d{1,2})/);
                                    if (dayMatch) {
                                       const day = parseInt(dayMatch[1], 10);
                                       date = new Date(Date.UTC(fileYear, monthIndex, day, 12, 0, 0));
                                       description = dateOrDescCell.substring(dayMatch[0].length).trim() || categoryName;
                                    } else {
                                        description = dateOrDescCell.trim();
                                        date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                    }
                                } else {
                                     description = categoryName;
                                     date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                }
                                
                                const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                                if (date && isValid(date) && !isNaN(amount) && amount !== 0) {
                                    if (amount < 0 && incomeCategoryId) {
                                        allDetectedCategories.add("Einnahmen");
                                        allTransactions.push({
                                            description: `${description} Erstattung`,
                                            amount: Math.abs(amount),
                                            date,
                                            categoryId: "Einnahmen"
                                        });
                                    } else {
                                        allTransactions.push({
                                            description,
                                            amount: Math.abs(amount),
                                            date,
                                            categoryId: categoryName
                                        });
                                    }
                                }
                            }
                             // Special KV Case
                            if (categoryName.toLowerCase().startsWith('kv') && col + 2 < 11 && rowData[col + 2] !== null) {
                                const timoAmountCell = rowData[col+2];
                                const timoAmount = typeof timoAmountCell === 'number' ? timoAmountCell : parseFloat(String(timoAmountCell).replace('.', '').replace(',', '.'));
                                if (dateOrDescCell && !isNaN(timoAmount) && timoAmount !== 0) {
                                     const date = dateOrDescCell instanceof Date ? new Date(Date.UTC(fileYear, monthIndex, dateOrDescCell.getUTCDate(), 12, 0, 0)) : new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                     allTransactions.push({
                                        description: `${String(dateOrDescCell)} (Timo)`,
                                        amount: Math.abs(timoAmount),
                                        date,
                                        categoryId: categoryName
                                    });
                                }
                            }
                            currentRow++;
                        }
                    }
                }

                // Phase 2: Process vertical blocks (lower part, from L)
                for (let startRow = 29; startRow < rawJson.length; startRow++) {
                    const categoryNameCell = rawJson[startRow]?.[11]; // Column L
                     if (typeof categoryNameCell === 'string' && categoryNameCell.trim() && !categoryNameCell.toLowerCase().includes('summe') && !categoryNameCell.toLowerCase().includes('einnahmen')) {
                       const categoryName = categoryNameCell.trim();
                       allDetectedCategories.add(categoryName);

                       let currentRow = startRow + 2; // Data starts 2 rows below header
                       while(currentRow < rawJson.length) {
                         const rowData = rawJson[currentRow];
                         if (!rowData || !rowData[11] || (typeof rowData[11] === 'string' && String(rowData[11]).toLowerCase().includes('summe'))) {
                            startRow = currentRow; // Skip processed rows
                            break;
                         }
                         const descCell = rowData[11];
                         const amountCell = rowData[12];
                         
                         let description: string = '';

                         if (typeof descCell === 'string' && descCell.trim()) {
                             description = descCell.trim();
                         }
                         const date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));

                         if (amountCell !== null && amountCell !== undefined && String(amountCell).trim() !== '') {
                            const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                            if(isValid(date) && !isNaN(amount) && amount !== 0) {
                                allTransactions.push({ description, amount: Math.abs(amount), date, categoryId: categoryName });
                            }
                         }
                         currentRow++;
                       }
                    }
                }
                
                // Phase 3: Process Einnahmen block at the end
                const einnahmenRowIndex = rawJson.findIndex(row => typeof row?.[0] === 'string' && row[0].toLowerCase().startsWith('einnahmen'));
                if (einnahmenRowIndex !== -1) {
                    allDetectedCategories.add("Einnahmen");
                    for (let r = einnahmenRowIndex + 1; r < rawJson.length; r++) {
                        const rowData = rawJson[r];
                        if (!rowData || !rowData[0] || (typeof rowData[0] === 'string' && String(rowData[0]).toLowerCase().startsWith('summe'))) break;
                        
                        const description = rowData[0];
                        if (description && typeof description === 'string' && description.trim() !== '') {
                             const amountCell = rowData[1] ?? rowData[2];
                             if (amountCell !== null && amountCell !== undefined && String(amountCell).trim() !== '' && Number(amountCell) > 0) {
                                const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                                if (!isNaN(amount) && amount > 0) {
                                    const date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                                    if (isValid(date)) {
                                        allTransactions.push({
                                            description: description.trim(),
                                            amount: amount,
                                            date: date,
                                            categoryId: "Einnahmen"
                                        });
                                    }
                                }
                             }
                        }
                    }
                }
            });

            if (allTransactions.length === 0) {
              throw new Error("Keine gültigen Transaktionen zum Importieren gefunden. Bitte überprüfen Sie die Datei.");
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
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
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
        throw new Error("Keine Transaktionen nach der Kategoriezuordnung übrig. Bitte stellen Sie sicher, dass alle Kategorien zugeordnet sind.");
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
