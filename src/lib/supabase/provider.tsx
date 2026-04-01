'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { getSupabaseBrowserClient } from './client';
import type { User, SupabaseClient } from '@supabase/supabase-js';

export type AppUser = User & {
  firstName?: string;
  lastName?: string;
  budget?: number;
  autoLogoutTimeout?: number;
  photoURL?: string;
  displayName?: string;
};

interface SupabaseContextState {
  supabase: SupabaseClient;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

const SupabaseContext = createContext<SupabaseContextState | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  const loadProfile = useCallback(async (authUser: User) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
    }

    const combinedUser: AppUser = {
      ...authUser,
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      budget: profile?.budget ?? 2000,
      autoLogoutTimeout: profile?.auto_logout_timeout ?? 0,
      photoURL: profile?.photo_url || authUser.user_metadata?.avatar_url || '',
      displayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || authUser.email || '',
    };

    setUser(combinedUser);
    setIsUserLoading(false);
  }, [supabase]);

  useEffect(() => {
    // Initial session check
    supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
      if (error || !authUser) {
        setUser(null);
        setIsUserLoading(false);
        if (error) setUserError(error);
        return;
      }
      loadProfile(authUser);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setIsUserLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          loadProfile(session.user);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  // Subscribe to profile changes in realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`profile-${user.id}-${Math.random().toString(36).slice(2)}`);

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const profile = payload.new as any;
          setUser(prev => prev ? {
            ...prev,
            firstName: profile.first_name || prev.firstName,
            lastName: profile.last_name || prev.lastName,
            budget: profile.budget ?? prev.budget,
            autoLogoutTimeout: profile.auto_logout_timeout ?? prev.autoLogoutTimeout,
            photoURL: profile.photo_url || prev.photoURL,
            displayName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || prev.displayName,
          } : null);
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id]);

  const contextValue = useMemo(
    () => ({ supabase, user, isUserLoading, userError }),
    [supabase, user, isUserLoading, userError]
  );

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context.supabase;
}

export function useUser(): { user: AppUser | null; isUserLoading: boolean; userError: Error | null } {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useUser must be used within a SupabaseProvider');
  }
  return {
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
}
