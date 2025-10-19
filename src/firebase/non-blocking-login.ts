'use client';
import {
  Auth, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from 'firebase-admin';
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

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch(error => {
      // This will be caught by the onAuthStateChanged listener's error handler in many cases,
      // but logging here can be useful for debugging forms.
      // A toast notification is shown in the login form component.
      console.error("Email sign-in failed:", error.code);
  });
}
