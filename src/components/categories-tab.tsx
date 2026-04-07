"use client";

import { useState } from "react";
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
import { Edit, PlusCircle, Trash } from "lucide-react";
import type { Category } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useUser, useSupabase } from '@/lib/supabase';
import { useCategories } from '@/lib/categories-context';


export function CategoriesTab() {
  const { user } = useUser();
  const supabase = useSupabase();

  const { categories, isLoading: categoriesLoading } = useCategories();

  const [open, setOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const { toast } = useToast();

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

  const handleDelete = async (categoryId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      console.error('Error deleting category:', error);
      return;
    }
    toast({
      title: 'Kategorie gelöscht',
      description: 'Die Kategorie wurde erfolgreich entfernt.',
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!categoryName.trim()) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Der Kategoriename darf nicht leer sein.",
        });
        return;
    }

    if (currentCategory) {
      const { error } = await supabase
        .from('expense_categories')
        .update({ name: categoryName })
        .eq('id', currentCategory.id);

      if (error) {
        console.error('Error updating category:', error);
        return;
      }
      toast({
        title: 'Kategorie aktualisiert',
        description: 'Die Änderungen wurden erfolgreich gespeichert.',
      });
    } else {
      const { error } = await supabase
        .from('expense_categories')
        .insert({ name: categoryName, user_id: user.id });

      if (error) {
        console.error('Error adding category:', error);
        return;
      }
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
              {categoriesLoading && <TableRow><TableCell colSpan={2}>Lade Kategorien...</TableCell></TableRow>}
              {!categoriesLoading && categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
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
