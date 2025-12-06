'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

export function initializeFirebase() {
  const isInitialized = getApps().length > 0;
  const firebaseApp = isInitialized ? getApp() : initializeApp(firebaseConfig);
  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const functions = getFunctions(firebaseApp);
  const storage = getStorage(firebaseApp);

  if (USE_EMULATOR) {
    // This is a special exception to connect to the emulator
    // as App Hosting does not yet support connecting to the emulators.
    // In a production App Hosting environment, this block will be skipped.
    try {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
        connectFunctionsEmulator(functions, "127.0.0.1", 5001);
        connectStorageEmulator(storage, '127.0.0.1', 9199);
    } catch (e) {
      // Errors are expected if the emulators are not running.
    }
  }

  return {
    firebaseApp,
    auth,
    firestore,
    functions,
    storage,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';