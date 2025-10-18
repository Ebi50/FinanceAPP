"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { categories as initialCategories } from "@/lib/data";
import { Edit, PlusCircle, Trash } from "lucide-react";
import type { Category } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCategories = localStorage.getItem('userCategories');
      if (storedCategories) {
        // We need to re-assign the icon components as they are not stored in JSON
        const parsedCategories = JSON.parse(storedCategories);
        const categoriesWithIcons = parsedCategories.map((cat: Category) => {
            const initialCat = initialCategories.find(ic => ic.name.toLowerCase() === cat.name.toLowerCase() || ic.id === cat.id);
            return { ...cat, icon: initialCat?.icon || initialCategories[0].icon };
        });
        setCategories(categoriesWithIcons);
      } else {
        setCategories(initialCategories);
        localStorage.setItem('userCategories', JSON.stringify(initialCategories));
      }
    } catch (error) {
      console.error("Failed to parse categories from localStorage", error);
      setCategories(initialCategories);
    }
  }, []);

  const updateCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    // When saving to localStorage, we strip out the icon component
    const categoriesToStore = newCategories.map(({ icon, ...rest }) => rest);
    localStorage.setItem('userCategories', JSON.stringify(categoriesToStore));
  };


  const handleAddClick = () => {
    setCurrentCategory(null);
    setCategoryName("");
    setOpen(true);
  };

  const handleEditClick = (category: Category) => {
    setCurrentCategory(category);
    setCategoryName(category.name);
    setOpen(true);
  };

  const handleDelete = (categoryId: string) => {
    const newCategories = categories.filter((c) => c.id !== categoryId);
    updateCategories(newCategories);
    toast({
      title: 'Kategorie gelöscht',
      description: 'Die Kategorie wurde erfolgreich entfernt.',
    });
  };

  const handleSave = () => {
    if (!categoryName.trim()) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Der Kategoriename darf nicht leer sein.",
        });
        return;
    }

    if (currentCategory) {
      // Edit
      const newCategories = categories.map((c) =>
          c.id === currentCategory.id ? { ...c, name: categoryName } : c
        );
      updateCategories(newCategories);
       toast({
        title: 'Kategorie aktualisiert',
        description: 'Die Änderungen wurden erfolgreich gespeichert.',
      });
    } else {
      // Add
      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        name: categoryName,
        icon: initialCategories[0].icon, // Default icon, can be made selectable later
      };
      updateCategories([...categories, newCategory]);
      toast({
        title: 'Kategorie hinzugefügt',
        description: `${categoryName} wurde erfolgreich erstellt.`,
      });
    }
    setOpen(false);
    setCategoryName("");
    setCurrentCategory(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-headline">Kategorien</CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Ausgabenkategorien.
              </CardDescription>
            </div>
            <Button onClick={handleAddClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Kategorie hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium flex items-center gap-3">
                    {category.icon && <category.icon className="h-5 w-5 text-muted-foreground" />}
                    {category.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(category)}
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Bearbeiten</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Löschen</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Sind Sie absolut sicher?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Diese Aktion kann nicht rückgängig gemacht werden.
                            Dadurch wird die Kategorie dauerhaft gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(category.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentCategory ? "Kategorie bearbeiten" : "Neue Kategorie hinzufügen"}
            </DialogTitle>
            <DialogDescription>
              Geben Sie der Kategorie einen Namen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
