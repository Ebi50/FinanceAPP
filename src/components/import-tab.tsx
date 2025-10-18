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
import { format, isValid, parse } from "date-fns";
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
        return {
          Datum: isValid(dateObject) ? format(dateObject, "yyyy-MM-dd") : "Ungültiges Datum",
          Beschreibung: t.description,
          Kategorie: category || "Unbekannt",
          Betrag: t.amount, // Now exporting the amount as is (positive or negative)
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd. mmm' });
            
            let allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach((sheetName, monthIndex) => {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];

                const fileYearMatch = file.name.match(/\d{4}/);
                const fileYear = fileYearMatch ? parseInt(fileYearMatch[0], 10) : new Date().getFullYear();

                const parseDate = (value: string | number | Date | null): Date => {
                    const defaultDate = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                    if (value instanceof Date && isValid(value)) {
                        return value;
                    }
                    if (typeof value === 'string') {
                        try {
                            const parsedDate = parse(value, 'dd. MMM', new Date(fileYear, monthIndex, 1));
                            if (isValid(parsedDate)) return parsedDate;
                        } catch {
                            // ignore parse errors, will use it as description
                        }
                    }
                    return defaultDate;
                };

                const parseDescription = (value: string | number | Date | null): string => {
                    if (typeof value === 'string') return value.trim();
                    if (value instanceof Date && isValid(value)) {
                        return format(value, 'dd. MMM', {locale: de});
                    }
                    return '';
                };

                // 1. Oberer Block
                const upperBlockHeaderRow = json[2]; // Zeile 3
                if (upperBlockHeaderRow) {
                    for (let col = 0; col < 10; col += 2) { // Spalten A-J
                        const categoryName = upperBlockHeaderRow[col] as string;
                        if (categoryName && typeof categoryName === 'string') {
                            allDetectedCategories.add(categoryName);
                            for (let rowIdx = 3; rowIdx < 27; rowIdx++) { // Zeilen 4-27
                                const row = json[rowIdx];
                                if (!row) continue;
                                const descOrDateCell = row[col];
                                const amountCell = row[col + 1];

                                if (typeof descOrDateCell === 'string' && descOrDateCell.toLowerCase().includes('summe')) break;
                                if (descOrDateCell === null && amountCell === null) continue;

                                const amount = typeof amountCell === 'number' ? amountCell : 0;
                                if (amount === 0) continue;

                                const date = parseDate(descOrDateCell);
                                const description = (typeof descOrDateCell === 'string' && !(descOrDateCell.match(/^\d{1,2}\. \w{3}$/))) ? parseDescription(descOrDateCell) : categoryName;

                                allTransactions.push({ description, amount, date, categoryId: categoryName });
                            }
                        }
                    }
                }
                
                // 2. Unterer Block
                const lowerBlockHeaderRow = json[29]; // Zeile 30
                if (lowerBlockHeaderRow) {
                    for (let col = 0; col < 14; col += 2) { // Spalten A-N
                        const categoryName = lowerBlockHeaderRow[col] as string;
                        if (categoryName && typeof categoryName === 'string') {
                            allDetectedCategories.add(categoryName);
                            for (let rowIdx = 30; rowIdx < 54; rowIdx++) { // Zeilen 31-54
                                const row = json[rowIdx];
                                if (!row) continue;
                                const descOrDateCell = row[col];
                                let amountCell = row[col + 1];

                                if (typeof descOrDateCell === 'string' && descOrDateCell.toLowerCase().includes('summe')) break;
                                if (descOrDateCell === null && amountCell === null) continue;
                                
                                let amount = 0;
                                if (categoryName.toLowerCase().includes('kv')) {
                                    const amount1 = row[col + 1] as number;
                                    const amount2 = row[col + 2] as number;
                                    if(typeof amount1 === 'number') amount += amount1;
                                    if(typeof amount2 === 'number') amount += amount2;
                                } else {
                                    if(typeof amountCell === 'number') amount = amountCell;
                                }

                                if (amount === 0) continue;

                                const date = parseDate(descOrDateCell);
                                const description = (typeof descOrDeteCell === 'string' && !(descOrDateCell.match(/^\d{1,2}\. \w{3}$/))) ? parseDescription(descOrDateCell) : categoryName;

                                allTransactions.push({ description, amount, date, categoryId: categoryName });
                            }
                             if(categoryName.toLowerCase().includes('kv')) col += 2; // Special jump for KV
                        }
                    }
                }

                // 3. Sonderdatenblöcke
                // Ab Zeile 58, Spalten A und C
                for (let rowIdx = 57; rowIdx < json.length; rowIdx++) { // Start ab Zeile 58
                    const row = json[rowIdx];
                    if (!row) continue;
                    const description = row[0] as string;
                    const amount = row[2] as number;
                    if (description && typeof description === 'string' && typeof amount === 'number') {
                         allDetectedCategories.add("Sonderausgaben/Einnahmen");
                         const date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                         allTransactions.push({ description, amount, date, categoryId: "Sonderausgaben/Einnahmen" });
                    }
                }

                // Ab Zeile 61, Spalten F und H
                for (let rowIdx = 60; rowIdx < json.length; rowIdx++) { // Start ab Zeile 61
                    const row = json[rowIdx];
                    if (!row) continue;
                    const valF = row[5] as number;
                    const valH = row[7] as number;

                    if ((typeof row[5] === 'string' && row[5].toLowerCase().includes('summe')) || (typeof row[7] === 'string' && row[7].toLowerCase().includes('summe'))) break;
                    
                    const date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                    if (typeof valF === 'number' && valF !== 0) {
                         allDetectedCategories.add("Sonderwerte F");
                         allTransactions.push({ description: "Sonderwert Spalte F", amount: valF, date, categoryId: "Sonderwerte F" });
                    }
                    if (typeof valH === 'number' && valH !== 0) {
                        allDetectedCategories.add("Sonderwerte H");
                        allTransactions.push({ description: "Sonderwert Spalte H", amount: valH, date, categoryId: "Sonderwerte H" });
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

          // Per new instructions, negative values are kept as-is within their category.
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
