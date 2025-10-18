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
            
            const fileYearMatch = file.name.match(/\d{4}/);
            const fileYear = fileYearMatch ? parseInt(fileYearMatch[0], 10) : new Date().getFullYear();

            const monthMap: {[key: string]: number} = { 'jan': 0, 'feb': 1, 'mär': 2, 'apr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dez': 11 };
            const mainCategories = ['lebensmittel', 'körperpflege', 'kleidung', 'haushalt', 'auto', 'garten', 'zeitschr./bücher', 'freize./geschenke', 'radsport', 'telefon/büro', 'kinder', 'kv'];
            
            const allTransactions: MappedTransaction[] = [];
            const allDetectedCategories = new Set<string>();

            workbook.SheetNames.forEach(sheetName => {
                const monthStr = sheetName.toLowerCase().slice(0, 3);
                const monthIndex = monthMap[monthStr];

                if (monthIndex === undefined) return;

                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) return;

                const sheetJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as RawRow[];
                if (sheetJson.length < 2) return;
                
                // Process main expense blocks
                let startRow = 0;
                while (startRow < sheetJson.length) {
                    let categoryRowIndex = -1;
                    for (let i = startRow; i < sheetJson.length; i++) {
                        if (sheetJson[i].some(cell => typeof cell === 'string' && mainCategories.some(mc => String(cell).toLowerCase().startsWith(mc)))) {
                            categoryRowIndex = i;
                            break;
                        }
                    }

                    if (categoryRowIndex === -1) break; // No more main category blocks

                    const dataHeaderRowIndex = categoryRowIndex + 1;
                    if (dataHeaderRowIndex >= sheetJson.length) break;

                    const categoryRow = sheetJson[categoryRowIndex];
                    const dataHeaderRow = sheetJson[dataHeaderRowIndex];
                    
                    const filledCategories: (string | null)[] = [];
                    let lastCategory: string | null = null;
                    categoryRow.forEach(cell => {
                        if (typeof cell === 'string' && cell.trim() !== '') {
                            lastCategory = cell.trim().replace(/\s+\d+$/, '');
                        }
                        filledCategories.push(lastCategory);
                    });

                    filledCategories.forEach(cat => { if (cat) allDetectedCategories.add(cat); });
                    
                    for (let r = dataHeaderRowIndex + 1; r < sheetJson.length; r++) {
                        const rowData = sheetJson[r];
                        if (!rowData || !rowData.some(cell => cell !== null && cell !== '') || String(rowData[0]).toLowerCase().startsWith('summe')) {
                            startRow = r + 1;
                            break;
                        }
                        
                        for (let c = 0; c < dataHeaderRow.length; c++) {
                            const header = String(dataHeaderRow[c]).toLowerCase();
                            if (header === 'datum') {
                                const categoryName = filledCategories[c];
                                const dateCell = rowData[c];
                                const amountCell = rowData[c + 1]; // Assuming amount is always next to date

                                if (!categoryName || !dateCell || amountCell === null || String(amountCell).trim() === '') continue;
                                
                                let date: Date | null = null;
                                if (dateCell instanceof Date) {
                                   date = new Date(Date.UTC(fileYear, monthIndex, dateCell.getUTCDate()));
                                } else {
                                    const dayMatch = String(dateCell).match(/(\d{1,2})/);
                                    if(dayMatch) {
                                       date = new Date(fileYear, monthIndex, parseInt(dayMatch[1], 10));
                                    }
                                }

                                if (!date) continue;

                                const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                                if (!isNaN(amount) && amount > 0) {
                                    allTransactions.push({
                                        description: categoryName,
                                        amount: Math.abs(amount),
                                        date,
                                        categoryId: categoryName
                                    });
                                }
                            }
                        }
                        if (r === sheetJson.length - 1) startRow = sheetJson.length;
                    }
                }
                
                // Process special items like "Rate Haus"
                for (let r = 0; r < sheetJson.length; r++) {
                    const rowData = sheetJson[r];
                    if (rowData && typeof rowData[0] === 'string' && String(rowData[0]).toLowerCase().includes('rate haus')) {
                        const amountCell = sheetJson[r + 1]?.[1];
                        if (amountCell) {
                             const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                             if (!isNaN(amount) && amount > 0) {
                                allTransactions.push({
                                    description: "Rate Haus",
                                    amount: Math.abs(amount),
                                    date: new Date(fileYear, monthIndex, 15), // Use mid-month as placeholder
                                    categoryId: "Haushalt"
                                });
                                allDetectedCategories.add("Haushalt");
                             }
                        }
                    }
                }

                // Process Einnahmen
                let einnahmenRowIndex = -1;
                for (let r = 0; r < sheetJson.length; r++) {
                    const rowData = sheetJson[r];
                    if (rowData && typeof rowData[0] === 'string' && String(rowData[0]).toLowerCase().startsWith('einnahmen')) {
                        einnahmenRowIndex = r;
                        break;
                    }
                }

                if (einnahmenRowIndex !== -1) {
                    for (let r = einnahmenRowIndex + 1; r < sheetJson.length; r++) {
                        const rowData = sheetJson[r];
                        const description = rowData?.[0];
                        const amountCell = rowData?.[1];

                        if (!description || typeof description !== 'string' || description.toLowerCase().startsWith('sonstige') || description.toLowerCase().startsWith('summe')) {
                           if (!description || String(description).trim() === '') break;
                           if (typeof description === 'string' && (description.toLowerCase().startsWith('summe'))) break;
                           continue;
                        }
                        
                        if (amountCell !== null && String(amountCell).trim() !== '' && Number(amountCell) > 0) {
                            const amount = typeof amountCell === 'number' ? amountCell : parseFloat(String(amountCell).replace('.', '').replace(',', '.'));
                             if (!isNaN(amount) && amount > 0) {
                                 allTransactions.push({
                                     description: description,
                                     amount: amount,
                                     date: new Date(fileYear, monthIndex, 15), // Use mid-month
                                     categoryId: "Einnahmen"
                                 });
                                 allDetectedCategories.add("Einnahmen");
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
