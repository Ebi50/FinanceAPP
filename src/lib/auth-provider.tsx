'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import type { AppUser } from '@/lib/types';

export type { AppUser };

interface AuthContextValue {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
  /** Reloads the profile — call it after anything that changes profile data. */
  refreshUser: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const { user: current } = await api.me();
      setUser(current);
      setUserError(null);
    } catch (err) {
      setUser(null);
      setUserError(err as Error);
    } finally {
      setIsUserLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isUserLoading, userError, refreshUser, setUser, signOut }),
    [user, isUserLoading, userError, refreshUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser() {
  const { user, isUserLoading, userError } = useAuth();
  return { user, isUserLoading, userError };
}
