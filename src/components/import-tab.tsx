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
  onImport: (transactions: MappedTransaction[]) => void;
  categories: Category[];
}

export function ImportTab({ transactions, onImport, categories }: ImportTabProps) {
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
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            const yearMatch = file.name.match(/\d{4}/);
            const fileYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

            const monthMap: {[key: string]: number} = { 'jan': 0, 'feb': 1, 'mär': 2, 'apr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11 };

            const allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach(sheetName => {
                const monthStr = sheetName.toLowerCase().slice(0, 3);
                const monthIndex = monthMap[monthStr];

                if (monthIndex === undefined) {
                    console.log(`Skipping sheet: ${sheetName}`);
                    return; 
                }

                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];

                if (sheetJson.length < 2) {
                   console.log(`Sheet ${sheetName} is too small, skipping.`);
                   return;
                };

                let categoryRowIndex = -1;
                let dataHeaderRowIndex = -1;
                let categoryRow: RawRow | null = null;
                let dataHeaderRow: RawRow | null = null;

                for (let i = 0; i < sheetJson.length; i++) {
                    const row = sheetJson[i];
                    if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('garten 6') || cell.toLowerCase().includes('lebensmittel 1')))) {
                        categoryRowIndex = i;
                        categoryRow = row;
                        if (sheetJson[i + 1] && sheetJson[i+1].some(cell => typeof cell === 'string' && cell.toLowerCase() === 'datum')) {
                            dataHeaderRowIndex = i + 1;
                            dataHeaderRow = sheetJson[i+1];
                            break;
                        }
                    }
                }
                
                if (!categoryRow || !dataHeaderRow || dataHeaderRowIndex === -1) {
                  console.log(`Could not find header rows in sheet: ${sheetName}`);
                  return;
                }

                const filledCategories: (string | null)[] = [];
                let lastCategory: string | null = null;
                for(const cell of categoryRow) {
                    const cellStr = cell ? String(cell).trim() : null;
                    if(cellStr && isNaN(parseInt(cellStr.slice(-1)))) {
                        lastCategory = cellStr.trim();
                    } else if (cellStr) {
                         lastCategory = cellStr.replace(/\s\d+$/, '').trim();
                    }
                    if(lastCategory) allDetectedCategories.add(lastCategory);
                    filledCategories.push(lastCategory);
                }
                
                const dataColIndices: { [key: number]: { category: string | null, date: number, amount: number, desc: number } } = {};
                for(let c = 0; c < dataHeaderRow.length; c++) {
                    const header = String(dataHeaderRow[c]).toLowerCase();
                    if(header === 'datum' && filledCategories[c]) {
                        const categoryName = filledCategories[c]!;
                        dataColIndices[c] = {
                            category: categoryName,
                            date: c,
                            amount: c + 1,
                            desc: c 
                        };
                    }
                }

                for(let r = dataHeaderRowIndex + 1; r < sheetJson.length; r++) {
                    const rowData = sheetJson[r];
                    if(!rowData || !rowData.some(c => c !== null) || String(rowData[0]).toLowerCase().startsWith('summe')) break;

                    Object.values(dataColIndices).forEach(indices => {
                        const dateCell = rowData[indices.date];
                        const amountCell = rowData[indices.amount];

                        if (amountCell === null || String(amountCell).trim() === '') return;
                        
                        let date: Date | null = null;
                        if(dateCell instanceof Date) {
                           date = dateCell;
                           date.setFullYear(fileYear);
                        } else if (dateCell) {
                           const dayMatch = String(dateCell).match(/(\d{1,2})\./);
                           if(dayMatch) {
                               const day = parseInt(dayMatch[1], 10);
                               date = new Date(fileYear, monthIndex, day);
                           }
                        }

                        if(!date) return;
                        
                        const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                        const description = rowData[indices.desc] && String(rowData[indices.date]).toLowerCase() !== 'datum' ? String(rowData[indices.desc]) : indices.category;
                        
                        if(!isNaN(amount) && amount > 0) {
                            allTransactions.push({
                                description: description || "Unbekannte Transaktion",
                                amount: Math.abs(amount),
                                date,
                                categoryId: indices.category || '' // Temporarily store category name
                            });
                        }
                    });
                }
            });

            if (allTransactions.length === 0) {
              throw new Error("Keine gültigen Transaktionen zum Importieren gefunden.");
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
      const transactionsWithMappedCategory = allParsedTransactions.map(t => {
        const mappedCatId = headerMapping[t.categoryId]; // t.categoryId is still the name here
        if (!mappedCatId) return null; // Skip if category is not mapped
        return { ...t, categoryId: mappedCatId };
      }).filter((t): t is MappedTransaction => t !== null);

      if (transactionsWithMappedCategory.length === 0) {
        throw new Error("Keine Transaktionen nach der Kategoriezuordnung übrig.");
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

    