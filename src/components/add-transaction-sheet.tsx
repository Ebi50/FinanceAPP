'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { categories } from '@/lib/data';
import {
  Calendar as CalendarIcon,
  Loader2,
  PlusCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { suggestExpenseCategory } from '@/ai/flows/suggest-expense-category';
import type { Transaction } from '@/lib/types';

const transactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(2, "Beschreibung ist erforderlich."),
  amounts: z.array(z.object({ value: z.coerce.number({invalid_type_error: 'Ungültiger Betrag'}).positive('Betrag muss positiv sein.') })).min(1, 'Mindestens ein Betrag ist erforderlich.'),
  categoryId: z.string().min(1, 'Kategorie ist erforderlich.'),
  date: z.date({ required_error: 'Datum ist erforderlich.' }),
  isRecurring: z.boolean().default(false),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;


function SubmitButton() {
  const { pending } = { pending: false };
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        'Speichern'
      )}
    </Button>
  );
}

interface AddTransactionSheetProps {
  children: React.ReactNode;
  onTransactionAdded: (transaction: Transaction) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  transaction?: Transaction | null;
}

export function AddTransactionSheet({
  children,
  onTransactionAdded,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  transaction,
}: AddTransactionSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const isEditing = !!transaction;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: transaction?.id || undefined,
      description: transaction?.description || '',
      amounts: transaction ? [{ value: transaction.amount }] : [{ value: undefined }],
      categoryId: transaction?.categoryId || '',
      date: transaction?.date || new Date(),
      isRecurring: false, // This can be enhanced later
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "amounts"
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: transaction?.id || undefined,
        description: transaction?.description || '',
        amounts: transaction ? [{ value: transaction.amount }] : [{ value: 0 }],
        categoryId: transaction?.categoryId || '',
        date: transaction?.date ? new Date(transaction.date) : new Date(),
        isRecurring: false,
      });
      setSuggestion(null);
    }
  }, [open, transaction, form]);


  const handleSuggestion = async () => {
    const description = form.getValues('description');
    if (!description || description.length < 5) return;
    setIsSuggesting(true);
    setSuggestion(null);
    try {
      const result = await suggestExpenseCategory({
        transactionDescription: description,
      });
      const suggestedCategory = categories.find(
        (c) => c.name.toLowerCase() === result.category.toLowerCase()
      );
      if (suggestedCategory) {
        form.setValue('categoryId', suggestedCategory.id);
        setSuggestion(suggestedCategory.name);
      }
    } catch (error) {
      console.error('Failed to get suggestion:', error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const onSubmit = (data: TransactionFormValues) => {
    const totalAmount = data.amounts.reduce((sum, current) => sum + Number(current.value), 0);
    const newTransaction: Transaction = {
      id: data.id || `txn-${Date.now()}`,
      description: data.description,
      amount: totalAmount,
      categoryId: data.categoryId,
      date: data.date,
    };
    onTransactionAdded(newTransaction);
    if (!isEditing) {
      form.reset({
        description: '',
        amounts: [{value: 0}],
        categoryId: '',
        date: new Date(),
        isRecurring: false
      });
    }
    setOpen(false);
  };
  
  const amountsValue = form.watch("amounts");
  const totalAmount = amountsValue.reduce((sum, current) => sum + Number(current.value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">{isEditing ? 'Transaktion bearbeiten' : 'Neue Transaktion'}</SheetTitle>
          <SheetDescription>
             {isEditing ? 'Aktualisieren Sie die Details dieser Transaktion.' : 'Fügen Sie eine neue Ausgabe hinzu. Klicken Sie auf Speichern, wenn Sie fertig sind.'}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 overflow-y-auto pr-4 -mr-6 pl-1 -ml-1">
            <div className="grid gap-4 py-4">
              
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  placeholder="z.B. Wocheneinkauf"
                  {...form.register(`description`)}
                  className="text-base"
                />
                 {form.formState.errors.description && <p className="text-sm text-destructive mt-1">{form.formState.errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Beträge</Label>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...form.register(`amounts.${index}.value`, { valueAsNumber: true })}
                      className="text-right text-base"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                 {form.formState.errors.amounts && <p className="text-sm text-destructive mt-1">{form.formState.errors.amounts.root?.message}</p>}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ value: 0 })}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Betrag hinzufügen
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Kategorie</Label>
                <div className="flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSuggestion}
                    disabled={isSuggesting}
                    aria-label="Kategorie vorschlagen"
                  >
                    {isSuggesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-accent" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.categoryId.message}
                  </p>
                )}
                {suggestion && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Vorschlag: <span className="text-primary">{suggestion}</span>
                  </p>
                )}
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
                          variant={'outline'}
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, 'PPP', { locale: de })
                          ) : (
                            <span>Datum auswählen</span>
                          )}
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
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <Checkbox
                      id="isRecurring"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
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
