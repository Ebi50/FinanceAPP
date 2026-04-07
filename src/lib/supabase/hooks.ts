'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './provider';

export type WithId<T> = T & { id: string };

export interface UseTableResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
  setData: React.Dispatch<React.SetStateAction<WithId<T>[] | null>>;
  refetch: () => void;
}

export interface UseRowResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseTableOptions {
  table: string;
  select?: string;
  filter?: { column: string; value: any }[];
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  /** Additional tables to watch for realtime changes (triggers a refetch) */
  realtimeTables?: string[];
}

interface UseRowOptions {
  table: string;
  id: string | null | undefined;
  select?: string;
}

export function useTable<T = any>(options: UseTableOptions): UseTableResult<T> {
  const { table, select = '*', filter, orderBy, enabled = true, realtimeTables } = options;
  const supabase = useSupabase();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterKey = filter ? JSON.stringify(filter) : '';
  const orderKey = orderBy ? JSON.stringify(orderBy) : '';
  const realtimeKey = realtimeTables ? realtimeTables.join(',') : '';

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setIsLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all rows. Supabase max_rows is 1000, so we paginate in chunks of 1000.
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;

      while (true) {
        let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);

        if (filter) {
          for (const f of filter) {
            query = query.eq(f.column, f.value);
          }
        }

        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
        }

        const { data: rows, error: fetchError } = await query;

        if (fetchError) {
          setError(new Error(fetchError.message));
          setData(null);
          setIsLoading(false);
          return;
        }

        const fetched = rows?.length ?? 0;
        allRows = allRows.concat(rows || []);

        if (fetched < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      console.log(`[useTable] ${table}: loaded ${allRows.length} rows`);
      setData(allRows as WithId<T>[]);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [supabase, table, select, filterKey, orderKey, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: debounced refetch on any change to watched tables
  useEffect(() => {
    if (!enabled) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`table-${table}-${Math.random().toString(36).slice(2)}`);

    const debouncedRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchData();
      }, 500);
    };

    // Subscribe to main table
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      debouncedRefetch
    );

    // Subscribe to additional related tables
    if (realtimeTables) {
      for (const relatedTable of realtimeTables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: relatedTable },
          debouncedRefetch
        );
      }
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, table, enabled, fetchData, realtimeKey]);

  return { data, isLoading, error, setData, refetch: fetchData };
}

export function useRow<T = any>(options: UseRowOptions): UseRowResult<T> {
  const { table, id, select = '*' } = options;
  const supabase = useSupabase();

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchRow = useCallback(async () => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: row, error: fetchError } = await supabase
      .from(table)
      .select(select)
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        setData(null);
      } else {
        setError(new Error(fetchError.message));
      }
    } else {
      setData(row as WithId<T>);
    }
    setIsLoading(false);
  }, [supabase, table, id, select]);

  useEffect(() => {
    fetchRow();
  }, [fetchRow]);

  // Realtime: refetch on change
  useEffect(() => {
    if (!id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`row-${table}-${id}-${Math.random().toString(36).slice(2)}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `id=eq.${id}` },
      () => {
        fetchRow();
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, table, id, fetchRow]);

  return { data, isLoading, error };
}
