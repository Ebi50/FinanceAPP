'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, Transaction } from '@/lib/types';

export interface UseCollectionResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
  setData: React.Dispatch<React.SetStateAction<T[] | null>>;
  refetch: () => void;
}

/** Refetch on focus is the replacement for the dropped realtime subscriptions. */
const FOCUS_REFETCH_INTERVAL = 30_000;

/**
 * Loads a collection from the API. `key` identifies the request — passing null
 * disables the hook (used while the user is still unknown).
 */
export function useCollection<T>(
  key: string | null,
  loader: () => Promise<T[]>,
  options: { refetchOnFocus?: boolean } = {}
): UseCollectionResult<T> {
  const { refetchOnFocus = false } = options;

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!key) {
      setData(null);
      setIsLoading(false);
      return;
    }
    // Guard against overlapping fetches (focus event during initial load).
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const rows = await loaderRef.current();
      setError(null);
      // Heavy re-renders (thousands of transactions) must not block the UI.
      startTransition(() => {
        setData(rows);
      });
    } catch (err) {
      console.error('[api-hooks]', key, err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [key]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!key || !refetchOnFocus) return;

    let lastRefetch = Date.now();
    const maybeRefetch = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefetch < FOCUS_REFETCH_INTERVAL) return;
      lastRefetch = Date.now();
      refetch();
    };

    window.addEventListener('focus', maybeRefetch);
    document.addEventListener('visibilitychange', maybeRefetch);
    return () => {
      window.removeEventListener('focus', maybeRefetch);
      document.removeEventListener('visibilitychange', maybeRefetch);
    };
  }, [key, refetchOnFocus, refetch]);

  return { data, isLoading, error, setData, refetch };
}

export function useTransactions(year: number, enabled: boolean) {
  return useCollection<Transaction>(
    enabled ? `transactions:${year}` : null,
    () => api.transactions(year),
    { refetchOnFocus: true }
  );
}

export function useCategoryList(enabled: boolean) {
  return useCollection<Category>(enabled ? 'categories' : null, () => api.categories(), {
    refetchOnFocus: true,
  });
}

export function useTransactionYears(enabled: boolean) {
  return useCollection<number>(enabled ? 'transaction-years' : null, () => api.transactionYears());
}
