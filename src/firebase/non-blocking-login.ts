'use client';
import {
  Auth, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { setDocumentNonBlocking } from './non-blocking-updates';


/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch(error => {
    console.error("Anonymous sign-in failed:", error);
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, firstName: string, lastName: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(userCredential => {
      const user = userCredential.user;
      const db = getFirestore();
      const userDocRef = doc(db, "users", user.uid);
      
      // Update profile display name
      updateProfile(user, {
        displayName: `${firstName} ${lastName}`.trim()
      });
      
      // Set user document in Firestore
      setDocumentNonBlocking(userDocRef, {
        firstName,
        lastName,
        email,
      }, { merge: true });

    })
    .catch(error => {
        console.error("Email sign-up failed:", error);
    });
}
