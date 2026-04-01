'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useCallback, useRef } from 'react';
import { useUser, useSupabase, useRow } from '@/lib/supabase';

const useAutoLogout = () => {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: userProfile } = useRow<{ auto_logout_timeout?: number }>({
    table: 'profiles',
    id: user?.id,
  });

  const logout = useCallback(() => {
    supabase.auth.signOut().then(() => {
      router.push('/login');
    });
  }, [supabase, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const timeout = (userProfile as any)?.auto_logout_timeout;
    if (timeout && timeout > 0) {
      const ms = timeout * 60 * 1000;
      timerRef.current = setTimeout(logout, ms);
    }
  }, [logout, userProfile]);

  useEffect(() => {
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resetTimer();
      }
    };

    if (user) {
      activityEvents.forEach(event => {
        window.addEventListener(event, handleActivity);
      });
      document.addEventListener('visibilitychange', handleVisibilityChange);
      resetTimer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, resetTimer]);

  return null;
};

export const AutoLogoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAutoLogout();
  return <>{children}</>;
};

export default useAutoLogout;
