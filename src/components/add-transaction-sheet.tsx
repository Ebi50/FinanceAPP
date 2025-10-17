// This component uses useFormState and useFormStatus, which are hooks from React.
// They are part of the React library and do not require a separate installation.
"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { categories } from "@/lib/data";
import { Calendar as CalendarIcon, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import React, { useState, useEffect, use } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { suggestExpenseCategory } from "@/ai/flows/suggest-expense-category";

const transactionSchema = z.object({
  items: z.array(z.object({
    description: z.string().min(2, "Beschreibung ist erforderlich."),
    amount: z.coerce.number().positive("Betrag muss positiv sein."),
  })).min(1, "Mindestens ein Artikel ist erforderlich."),
  categoryId: z.string().min(1, "Kategorie ist erforderlich."),
  date: z.date({ required_error: "Datum ist erforderlich." }),
  isRecurring: z.boolean().default(false),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

function SubmitButton() {
    // Note: useFormStatus is a new hook in React Canary. 
    // It's used here to show a loading state on the submit button.
    // Ensure you are using a compatible version of React.
    const { pending } = { pending: false }; // useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Speichern"}
        </Button>
    );
}


export function AddTransactionSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      items: [{ description: "", amount: 0 }],
      date: new Date(),
      isRecurring: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const totalAmount = watchItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  
  const handleSuggestion = async () => {
    const firstDescription = form.getValues("items.0.description");
    if (!firstDescription || firstDescription.length < 5) return;
    setIsSuggesting(true);
    setSuggestion(null);
    try {
        const result = await suggestExpenseCategory({ transactionDescription: firstDescription });
        const suggestedCategory = categories.find(c => c.name.toLowerCase() === result.category.toLowerCase());
        if (suggestedCategory) {
            form.setValue('categoryId', suggestedCategory.id);
            setSuggestion(suggestedCategory.name);
        }
    } catch (error) {
        console.error("Failed to get suggestion:", error);
    } finally {
        setIsSuggesting(false);
    }
  }

  const onSubmit = (data: TransactionFormValues) => {
    console.log(data);
    // Here you would typically call a server action to save the data
    form.reset();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">Neue Transaktion</SheetTitle>
          <SheetDescription>
            Fügen Sie eine neue Ausgabe hinzu. Klicken Sie auf Speichern, wenn Sie fertig sind.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto pr-4 -mr-6 pl-1 -ml-1">
            <div className="grid gap-4 py-4">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 items-start border-b pb-4">
                  <div className="col-span-4">
                    <Label htmlFor={`items.${index}.description`} className="sr-only">Beschreibung</Label>
                    <Textarea
                      id={`items.${index}.description`}
                      placeholder={`Artikel ${index + 1} Beschreibung`}
                      {...form.register(`items.${index}.description`)}
                      className="text-base"
                    />
                     {form.formState.errors.items?.[index]?.description && <p className="text-sm text-destructive mt-1">{form.formState.errors.items?.[index]?.description?.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor={`items.${index}.amount`} className="sr-only">Betrag</Label>
                    <Input
                      id={`items.${index}.amount`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...form.register(`items.${index}.amount`)}
                      className="text-right text-base"
                    />
                     {form.formState.errors.items?.[index]?.amount && <p className="text-sm text-destructive mt-1">{form.formState.errors.items?.[index]?.amount?.message}</p>}
                  </div>
                   {fields.length > 1 && (
                    <div className="col-span-6 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => append({ description: "", amount: 0 })}>
                Artikel hinzufügen
              </Button>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Kategorie</Label>
                 <div className="flex items-center gap-2">
                    <Controller
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategorie auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        <div className="flex items-center gap-2">
                                            <cat.icon className="h-4 w-4" />
                                            {cat.name}
                                        </div>
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleSuggestion} disabled={isSuggesting} aria-label="Kategorie vorschlagen">
                        {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                    </Button>
                </div>
                 {form.formState.errors.categoryId && <p className="text-sm text-destructive mt-1">{form.formState.errors.categoryId.message}</p>}
                 {suggestion && <p className="text-sm text-muted-foreground mt-1">Vorschlag: <span className="text-primary">{suggestion}</span></p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Controller
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP", { locale: de }) : <span>Datum auswählen</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={de}
                            />
                        </PopoverContent>
                        </Popover>
                    )}
                />
                 {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                        <Checkbox id="isRecurring" checked={field.value} onCheckedChange={field.onChange} />
                    )}
                />
                <Label htmlFor="isRecurring">Wiederkehrende Transaktion</Label>
              </div>
            </div>
          </div>
          <SheetFooter className="pt-4 border-t">
            <div className="flex justify-between items-center w-full">
                <div className="text-lg font-bold">
                    Gesamt: {formatCurrency(totalAmount)}
                </div>
                <SubmitButton />
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
