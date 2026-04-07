'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Category } from '@/lib/types';
import { useUser, useTable } from '@/lib/supabase';

interface CategoriesContextValue {
  categories: Category[] | null;
  isLoading: boolean;
}

const CategoriesContext = createContext<CategoriesContextValue>({ categories: null, isLoading: true });

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { data: categories, isLoading } = useTable<Category>({
    table: 'expense_categories',
    filter: user ? [{ column: 'user_id', value: user.id }] : undefined,
    enabled: !!user,
  });

  const value = useMemo(() => ({ categories, isLoading }), [categories, isLoading]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
