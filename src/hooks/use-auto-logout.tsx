'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useCallback, useRef } from 'react';
import { useUser, useSupabase } from '@/lib/supabase';

const useAutoLogout = () => {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(() => {
    supabase.auth.signOut().then(() => {
      router.push('/login');
    });
  }, [supabase, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const timeout = user?.autoLogoutTimeout;
    if (timeout && timeout > 0) {
      const ms = timeout * 60 * 1000;
      timerRef.current = setTimeout(logout, ms);
    }
  }, [logout, user?.autoLogoutTimeout]);

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
  usePointerEventsFix();
  return <>{children}</>;
};

/**
 * Global safety net for Radix UI's pointer-events management.
 * Radix sets body { pointer-events: none } when dialogs/sheets are open,
 * but sometimes fails to restore it (nested overlays, focus conflicts).
 * This detects the stale lock and force-resets it.
 */
function usePointerEventsFix() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents !== 'none') return;

      // Give Radix time to finish its work, then check if any dialog is actually open
      setTimeout(() => {
        if (document.body.style.pointerEvents !== 'none') return;

        const openDialogs = document.querySelectorAll(
          '[role="dialog"][data-state="open"]'
        );
        if (openDialogs.length === 0) {
          document.body.style.pointerEvents = '';
        }
      }, 500);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, []);
}

export default useAutoLogout;
