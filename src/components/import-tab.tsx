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
import { format, isValid, getYear } from "date-fns";

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
                
                if (rawJson.length < 2) return;
                
                // Process upper part (rows 1-28 approx), columns A-J
                const upperPart = rawJson.slice(0, 28).map(row => row.slice(0, 10)); // Use columns A-J

                for (let r = 0; r < upperPart.length; r++) {
                    const firstCell = upperPart[r][0];
                    if (typeof firstCell === 'string' && firstCell.match(/^[a-zA-ZäöüÄÖÜß\.\/\s]+ \d+$/)) {
                        const categoryName = firstCell.replace(/\s+\d+$/, '').trim();
                        allDetectedCategories.add(categoryName);

                        let currentRow = r + 2; 
                        while(currentRow < upperPart.length) {
                            const rowData = upperPart[currentRow];
                            if (!rowData || !rowData.some(c => c !== null && c !== '')) {
                                break;
                            }
                            const cell1 = rowData[0];
                            if (typeof cell1 === 'string' && cell1.toLowerCase().includes('summe')) {
                                break;
                            }

                            let description = '';
                            let date: Date | null = null;
                            
                            const dayString = String(cell1);
                            // Matches "1. Dez" or similar date formats
                            if (dayString.match(/^\d{1,2}\.\s[A-Za-z]{3}/)) {
                                const dayMatch = dayString.match(/^(\d{1,2})/);
                                if (dayMatch) {
                                    const day = parseInt(dayMatch[1], 10);
                                    date = new Date(Date.UTC(fileYear, monthIndex, day, 12, 0, 0));
                                }
                                description = categoryName; // Use category name as description if date is present
                            } else if (cell1 instanceof Date && isValid(cell1)) {
                                date = new Date(Date.UTC(fileYear, monthIndex, cell1.getUTCDate(), 12, 0, 0));
                                description = categoryName;
                            } else if (typeof cell1 === 'string' && cell1.trim() !== '') {
                                description = cell1.trim();
                                date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0)); // Default to 15th if description is text
                            }
                            
                            if (date && isValid(date)) {
                                const columnsToProcess = categoryName.toLowerCase() === 'auto' ? [1] : (categoryName.toLowerCase() === 'kv' ? [1, 2] : [1]);
                                
                                for (const colIndex of columnsToProcess) {
                                    const amountCell = rowData[colIndex];
                                    if (amountCell !== null && amountCell !== undefined && String(amountCell).trim() !== '') {
                                        const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                                        if (!isNaN(amount) && amount !== 0) {
                                            if (amount < 0) { 
                                                allTransactions.push({
                                                    description: `${description} Erstattung`,
                                                    amount: Math.abs(amount),
                                                    date,
                                                    categoryId: 'Einnahmen'
                                                });
                                                allDetectedCategories.add('Einnahmen');
                                            } else {
                                                allTransactions.push({
                                                    description,
                                                    amount,
                                                    date,
                                                    categoryId: categoryName
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            currentRow++;
                        }
                        r = currentRow -1; 
                    }
                }
                
                const einnahmenRowIndex = rawJson.findIndex(row => typeof row[0] === 'string' && row[0].toLowerCase().startsWith('einnahmen'));

                if (einnahmenRowIndex !== -1) {
                    allDetectedCategories.add("Einnahmen");
                    // Process lower part, columns A-N
                    const lowerPart = rawJson.slice(einnahmenRowIndex).map(row => row.slice(0, 14)); // Use columns A-N
                    
                    for (let r = 1; r < lowerPart.length; r++) { // Start from 1 to skip header
                        const rowData = lowerPart[r];
                        if (!rowData || !rowData.some(cell => cell !== null && cell !== '')) break;
                        
                        const description = rowData[0];
                        if (typeof description === 'string' && description.toLowerCase().startsWith('summe')) break;
                        
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
          // Here, t.categoryId is still the original category name from Excel (e.g., "Lebensmittel")
          const mappedCatId = headerMapping[t.categoryId]; 
          if (!mappedCatId) return null; // Skip if category is not mapped
          return { ...t, categoryId: mappedCatId }; // Replace original name with the mapped ID
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
