'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useFirestore } from '@/firebase';

const useAutoLogout = () => {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const userProfileQuery = useMemoFirebase(() =>
    user ? doc(firestore, 'users', user.uid) : null,
    [firestore, user]
  );
  const { data: userProfile } = useDoc<{ autoLogoutTimeout?: number }>(userProfileQuery);

  const logout = useCallback(() => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/login');
      });
    }
  }, [auth, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (userProfile?.autoLogoutTimeout && userProfile.autoLogoutTimeout > 0) {
      const timeout = userProfile.autoLogoutTimeout * 60 * 1000; // convert minutes to ms
      timerRef.current = setTimeout(logout, timeout);
    }
  }, [logout, userProfile?.autoLogoutTimeout]);

  useEffect(() => {
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // This is a proxy for lid close. If the page is hidden, we start the timer.
        // If the user comes back, the timer will be reset by other activity.
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

  return null; // This hook does not render anything
};

export const AutoLogoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAutoLogout();
  return <>{children}</>;
};

export default useAutoLogout;
