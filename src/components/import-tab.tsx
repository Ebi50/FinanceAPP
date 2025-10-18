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
      const date = t.date.toDate ? t.date.toDate() : t.date;
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
            
            let allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach(sheetName => {
                const monthStr = sheetName.toLowerCase().slice(0, 3);
                const monthIndex = monthMap[monthStr];

                if (monthIndex === undefined) return;

                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];
                
                if (rawJson.length < 1) return;
                
                const processBlock = (startRow: number, startCol: number) => {
                    const headerCell = rawJson[startRow]?.[startCol];
                    if (typeof headerCell !== 'string' || !headerCell.trim()) {
                        return;
                    }

                    const categoryName = headerCell.trim();
                    allDetectedCategories.add(categoryName);
                    
                    let isKV = categoryName.toLowerCase().includes('kv');

                    for (let rowIdx = startRow + 1; rowIdx < rawJson.length; rowIdx++) {
                        const rowData = rawJson[rowIdx];
                        if (!rowData) continue;
                        
                        const descOrDateCell = rowData[startCol];
                        
                        if (descOrDateCell === null && rowData[startCol+1] === null) {
                            break; 
                        }

                        if (typeof descOrDateCell === 'string' && descOrDateCell.toLowerCase().includes('summe')) {
                            break;
                        }
                        
                        let amount = 0;
                        if (isKV) {
                            const amountEbi = rowData[startCol + 1];
                            const amountTimo = rowData[startCol + 2];
                            if (typeof amountEbi === 'number') amount += amountEbi;
                            if (typeof amountTimo === 'number') amount += amountTimo;
                        } else {
                            const amountCell = rowData[startCol + 1];
                            if (typeof amountCell === 'number') amount = amountCell;
                        }
                        
                        if (amount === 0) continue;
                        
                        let date: Date;
                        let description: string;
                        
                        if (descOrDateCell instanceof Date && isValid(descOrDateCell)) {
                            date = new Date(Date.UTC(fileYear, monthIndex, descOrDateCell.getUTCDate(), 12, 0, 0));
                            description = categoryName;
                        } else if (typeof descOrDateCell === 'string' && descOrDateCell.trim()) {
                            const dayMatch = descOrDateCell.match(/^(\d{1,2})/);
                            if (dayMatch) {
                               const day = parseInt(dayMatch[1], 10);
                               date = new Date(Date.UTC(fileYear, monthIndex, day, 12, 0, 0));
                               description = descOrDateCell.substring(dayMatch[0].length).trim() || categoryName;
                            } else {
                                description = descOrDateCell.trim();
                                date = new Date(Date.UTC(fileYear, monthIndex, 15, 12, 0, 0));
                            }
                        } else {
                            continue;
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
                }
                
                // Phase 1: Horizontale Blöcke (oben)
                for (let col = 0; col < 11; col += 2) {
                    processBlock(0, col);
                }

                // Phase 2: Vertikale Blöcke (Mitte)
                for (let row = 29; row < rawJson.length; row++) {
                    const headerCell = rawJson[row]?.[0];
                    if (typeof headerCell === 'string' && headerCell.trim() && !headerCell.toLowerCase().includes('summe')) {
                         processBlock(row, 0);
                    }
                }
                
                // Phase 3: Einnahmen
                const einnahmenRowIndex = rawJson.findIndex(row => typeof row?.[0] === 'string' && row[0].toLowerCase().startsWith('einnahmen'));
                if (einnahmenRowIndex !== -1) {
                    processBlock(einnahmenRowIndex, 0);
                }
            });

            if (allTransactions.length === 0) {
              toast({
                variant: "destructive",
                title: "Keine Transaktionen gefunden",
                description: "Die Datei konnte nicht verarbeitet werden oder enthält keine gültigen Transaktionen. Bitte überprüfen Sie das Format.",
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
