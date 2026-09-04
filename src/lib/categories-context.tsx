'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Category } from '@/lib/types';
import { useUser } from '@/lib/auth-provider';
import { useCategoryList } from '@/lib/api-hooks';

interface CategoriesContextValue {
  categories: Category[] | null;
  isLoading: boolean;
  refetch: () => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: null,
  isLoading: true,
  refetch: () => {},
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { data: categories, isLoading, refetch } = useCategoryList(!!user);

  const value = useMemo(() => ({ categories, isLoading, refetch }), [categories, isLoading, refetch]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
