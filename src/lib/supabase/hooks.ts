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
}

interface UseRowOptions {
  table: string;
  id: string | null | undefined;
  select?: string;
}

export function useTable<T = any>(options: UseTableOptions): UseTableResult<T> {
  const { table, select = '*', filter, orderBy, enabled = true } = options;
  const supabase = useSupabase();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const filterKey = filter ? JSON.stringify(filter) : '';
  const orderKey = orderBy ? JSON.stringify(orderBy) : '';

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Supabase has a default limit of 1000 rows.
    // We fetch in pages to get ALL data.
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
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

      allRows = allRows.concat(rows || []);
      hasMore = (rows?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    setData(allRows as WithId<T>[]);
    setIsLoading(false);
  }, [supabase, table, select, filterKey, orderKey, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: refetch on any change to the table
  useEffect(() => {
    if (!enabled) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`table-${table}-${Math.random().toString(36).slice(2)}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        // Simply refetch all data on any change
        fetchData();
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
  }, [supabase, table, enabled, fetchData]);

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
