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
import {
  Calendar as CalendarIcon,
  Loader2,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Transaction, Category, TransactionItem } from '@/lib/types';
import { useUser, useSupabase, useTable } from '@/lib/supabase';

const transactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  amounts: z.array(z.object({
      value: z.coerce.number({invalid_type_error: 'Ungültiger Betrag'}).refine(val => val !== 0, { message: 'Betrag darf nicht Null sein.' }),
      description: z.string().optional(),
    })).min(1, 'Mindestens ein Betrag ist erforderlich.'),
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
  children?: React.ReactNode;
  onTransactionAdded: (transaction: Omit<Transaction, 'id' | 'date'> & { id?: string; date: Date; items: TransactionItem[] }) => void;
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

  const { user } = useUser();
  const { data: categories, isLoading: categoriesLoading } = useTable<Category>({
    table: 'expense_categories',
    enabled: !!user,
  });

  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      id: undefined,
      description: '',
      amounts: [{ value: '' as any, description: '' }],
      categoryId: '',
      date: new Date(),
      isRecurring: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "amounts"
  });

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [categories]);

  useEffect(() => {
    if (open) {
      let defaultValues: Partial<TransactionFormValues>;

      if (transaction) {
          const transactionDate = typeof transaction.date === 'string'
            ? parseISO(transaction.date)
            : transaction.date instanceof Date
              ? transaction.date
              : new Date();

          const amounts = transaction.items && transaction.items.length > 0
              ? transaction.items.map(item => ({ value: item.value || '' as any, description: item.description || '' }))
              : [{ value: transaction.amount || '' as any, description: '' }];

          defaultValues = {
              id: transaction.id,
              description: transaction.description || '',
              amounts: amounts,
              categoryId: transaction.category_id || '',
              date: isValid(transactionDate) ? transactionDate : new Date(),
              isRecurring: transaction.is_recurring || false,
          };
      } else {
        defaultValues = {
          id: undefined,
          description: '',
          amounts: [{ value: '' as any, description: '' }],
          categoryId: '',
          date: new Date(),
          isRecurring: false,
        };
      }

      form.reset(defaultValues as TransactionFormValues);
    }
  }, [open, transaction, form]);

  const onSubmit = (data: TransactionFormValues) => {
    const totalAmount = Math.round(data.amounts.reduce((sum, current) => sum + Number(current.value), 0) * 100) / 100;

    if (!data.date || !isValid(data.date)) {
        form.setError('date', { type: 'manual', message: 'Ungültiges Datum.' });
        return;
    }

    const mainDescription = data.description || '';

    const newTransaction: Omit<Transaction, 'id' | 'date'> & { id?: string, date: Date, items: TransactionItem[] } = {
      id: data.id,
      description: mainDescription,
      amount: totalAmount,
      category_id: data.categoryId,
      date: data.date,
      is_recurring: data.isRecurring,
      items: data.amounts.map(a => ({ value: Number(a.value), description: a.description })),
    };
    onTransactionAdded(newTransaction);
    setOpen(false);
  };

  const amountsValue = form.watch("amounts");
  const totalAmount = amountsValue.reduce((sum, current) => sum + Number(current.value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">{!!transaction ? 'Transaktion bearbeiten' : 'Neue Transaktion'}</SheetTitle>
          <SheetDescription>
             {!!transaction ? 'Aktualisieren Sie die Details dieser Transaktion.' : 'Fügen Sie eine neue Ausgabe hinzu. Klicken Sie auf Speichern, wenn Sie fertig sind.'}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto pr-6 pl-1 -mr-6 -ml-1">
            <div className="grid gap-4 py-4">

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung (Gesamt)</Label>
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
                  <div key={field.id} className="grid gap-2 border-l-2 pl-4 ml-[-2px]">
                     <div className="flex items-center gap-2">
                        <Controller
                            control={form.control}
                            name={`amounts.${index}.value`}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    placeholder="0,00"
                                    className="text-right text-base w-1/2"
                                    value={field.value === 0 ? '' : field.value || ''}
                                    onChange={e => field.onChange(e.target.valueAsNumber || '')}
                                />
                            )}
                        />
                        <Controller
                            control={form.control}
                            name={`amounts.${index}.description`}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder="Beschreibung (optional)"
                                    className="text-base"
                                />
                            )}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {form.formState.errors.amounts?.[index]?.value && <p className="text-sm text-destructive mt-1">{form.formState.errors.amounts[index]?.value?.message}</p>}
                  </div>
                ))}
                 {form.formState.errors.amounts?.root && <p className="text-sm text-destructive mt-1">{form.formState.errors.amounts.root.message}</p>}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' as any, description: '' })}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Position hinzufügen
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
                          {categoriesLoading ? (
                             <SelectItem value="loading" disabled>Lade...</SelectItem>
                          ) : (
                            sortedCategories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {form.formState.errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.categoryId.message}
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
                          {field.value && isValid(field.value) ? (
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
                 {form.formState.errors.date && <p className="text-sm text-destructive mt-1">{form.formState.errors.date.message}</p>}
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
