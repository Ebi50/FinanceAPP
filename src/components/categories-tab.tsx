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

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [open, setOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

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
    setCategories(categories.filter((c) => c.id !== categoryId));
  };

  const handleSave = () => {
    if (currentCategory) {
      // Edit
      setCategories(
        categories.map((c) =>
          c.id === currentCategory.id ? { ...c, name: categoryName } : c
        )
      );
    } else {
      // Add
      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        name: categoryName,
        icon: initialCategories[0].icon, // Default icon
      };
      setCategories([...categories, newCategory]);
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
                    <category.icon className="h-5 w-5 text-muted-foreground" />
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
