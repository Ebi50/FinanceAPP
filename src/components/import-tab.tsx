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
import { format, isValid, parse, getYear } from "date-fns";
import { de } from "date-fns/locale";
import { parseISO } from "date-fns";


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
        const dateObject = typeof t.date === 'string' ? parseISO(t.date) : t.date;
        const category = categoryIdMap.get(t.category_id);
        return {
          Datum: isValid(dateObject) ? format(dateObject, "yyyy-MM-dd") : "Ungültiges Datum",
          Beschreibung: t.description,
          Kategorie: category || "Unbekannt",
          Betrag: t.amount,
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd.MM' });
            
            let allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            const currentSelectedYearOnPage = getYear(new Date()); // Fallback to current year

            const monthShortNameToIndex: { [key: string]: number } = {
                'jan': 0, 'feb': 1, 'mär': 2, 'apr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11
            };

            workbook.SheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[][];
                if (!json || json.length === 0) return;
                
                const sheetMonthShortName = sheetName.substring(0, 3).toLowerCase();
                const monthIndex = monthShortNameToIndex[sheetMonthShortName];

                if (monthIndex === undefined) {
                    console.warn(`Konnte den Monat für das Tabellenblatt "${sheetName}" nicht bestimmen. Überspringe...`);
                    return;
                }
                
                let yearForSheet = currentSelectedYearOnPage;
                const fileYearMatch = file.name.match(/\d{4}/);
                if (fileYearMatch) {
                    yearForSheet = parseInt(fileYearMatch[0], 10);
                }


                const parseDate = (value: string | number | Date | null): Date => {
                    if (value instanceof Date && isValid(value)) {
                        // If date is valid and year is not 1899 or 1900, use it.
                        const year = getYear(value);
                        if (year > 1900) {
                            return value;
                        }
                    }
                    
                    if (typeof value === 'string') {
                         // Try parsing dd.MM.yyyy or dd.MM.yy
                        const parsedDate = parse(value, 'dd.MM.yyyy', new Date());
                        if (isValid(parsedDate)) return parsedDate;
                        const parsedDateShort = parse(value, 'dd.MM.yy', new Date());
                        if (isValid(parsedDateShort)) return parsedDateShort;

                        const parts = value.toLowerCase().replace('.', '').split(' ');
                        if (parts.length === 2) {
                            const day = parseInt(parts[0], 10);
                            const monthAbbr = parts[1].substring(0, 3);
                            const cellMonthIndex = monthShortNameToIndex[monthAbbr];
                            if (!isNaN(day) && cellMonthIndex !== undefined) {
                                return new Date(Date.UTC(yearForSheet, cellMonthIndex, day, 12, 0, 0));
                            }
                        }
                    }
                    // Fallback to sheet month and determined year
                    return new Date(Date.UTC(yearForSheet, monthIndex, 15, 12, 0, 0));
                };

                const isSumRow = (row: RawRow) => row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('summe'));

                // Oberer Block
                const upperBlockHeaderRow = json[2] || [];
                for (let col = 0; col < 10; col += 2) { // A-J
                    const categoryName = upperBlockHeaderRow[col] as string;
                    if (categoryName && typeof categoryName === 'string') {
                        allDetectedCategories.add(categoryName);
                        for (let rowIdx = 3; rowIdx < 28; rowIdx++) {
                            const row = json[rowIdx];
                            if (!row || isSumRow(row)) break;

                            const descOrDateCell = row[col];
                            let amountCell = row[col+1];
                            
                            // Sonderfall "KV"
                            if (categoryName.toLowerCase().includes('kv')) {
                                const amount1 = row[col + 1] as number;
                                const amount2 = row[col + 2] as number;
                                amountCell = (typeof amount1 === 'number' ? amount1 : 0) + (typeof amount2 === 'number' ? amount2 : 0);
                            }
                            
                            const amount = typeof amountCell === 'number' ? amountCell : 0;
                            if (amount === 0) continue;
                            
                            const date = parseDate(descOrDateCell);
                            const description = (typeof descOrDateCell === 'string' && !/^\d{1,2}/.test(descOrDateCell)) ? descOrDateCell : categoryName;
                            
                            allTransactions.push({ description, amount, date, category_id: categoryName, user_id: '' });

                            if(categoryName.toLowerCase().includes('kv')) col+=2;
                        }
                    }
                }
                
                // Unterer Block
                const lowerBlockHeaderRow = json[29] || [];
                for (let col = 0; col < 14; col += 2) { // A-N
                    const categoryName = lowerBlockHeaderRow[col] as string;
                    if (categoryName && typeof categoryName === 'string') {
                        allDetectedCategories.add(categoryName);
                        for (let rowIdx = 30; rowIdx < 55; rowIdx++) {
                            const row = json[rowIdx];
                            if (!row || isSumRow(row)) break;

                            const descOrDateCell = row[col];
                            const amountCell = row[col+1];
                            const amount = typeof amountCell === 'number' ? amountCell : 0;

                            if (amount === 0) continue;
                            
                            const date = parseDate(descOrDateCell);
                            const description = (typeof descOrDateCell === 'string' && !/^\d{1,2}/.test(descOrDateCell)) ? descOrDateCell : categoryName;
                            
                            allTransactions.push({ description, amount, date, category_id: categoryName, user_id: '' });
                        }
                    }
                }

                // Sonderdatenblöcke
                // Ab Zeile 58
                const sonderausgabenCategory = "Sonderausgaben";
                allDetectedCategories.add(sonderausgabenCategory);
                for (let rowIdx = 57; rowIdx < json.length; rowIdx++) {
                    const row = json[rowIdx];
                    if (!row || !row[0] || (typeof row[0] === 'string' && row[0].toLowerCase().includes('summe'))) break;
                    const description = row[0] as string;
                    const amount = row[2] as number;
                    if (description && typeof amount === 'number' && amount !== 0) {
                        const date = new Date(Date.UTC(yearForSheet, monthIndex, 15, 12, 0, 0));
                        allTransactions.push({ description, amount, date, categoryId: sonderausgabenCategory, userId: '' });
                    }
                }
                
                // Ab Zeile 61
                const sonderwerteFCategory = "Sonderwerte F";
                const sonderwerteHCategory = "Sonderwerte H";
                allDetectedCategories.add(sonderwerteFCategory);
                allDetectedCategories.add(sonderwerteHCategory);
                 for (let rowIdx = 60; rowIdx < json.length; rowIdx++) {
                    const row = json[rowIdx];
                    if (!row || (typeof row[5] === 'string' && row[5].toLowerCase().includes('summe'))) break;
                    
                    const descF = row[5] as string; 
                    const valF = row[5] as number; 
                    const valH = row[7] as number;
                    
                    const date = new Date(Date.UTC(yearForSheet, monthIndex, 15, 12, 0, 0));

                    if (typeof valF === 'number' && valF !== 0) {
                        allTransactions.push({ description: "Sonderwert Spalte F", amount: valF, date, categoryId: sonderwerteFCategory, userId: '' });
                    }
                    if (typeof valH === 'number' && valH !== 0) {
                        const description = (typeof descF === 'string' && isNaN(parseFloat(descF))) ? descF : "Sonderwert Spalte H";
                        allTransactions.push({ description, amount: valH, date, categoryId: sonderwerteHCategory, userId: '' });
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
            setAllParsedTransactions(allTransactions as MappedTransaction[]);
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
          const excelCategoryName = t.category_id; 
          const mappedAppCategoryId = headerMapping[excelCategoryName];
          
          if (!mappedAppCategoryId) return null;

          return { ...t, category_id: mappedAppCategoryId };
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
