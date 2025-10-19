// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createApp(): App {
  // Wenn bereits eine App initialisiert ist, geben wir sie zurück.
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // 1. Versuch: Service Account Key aus einer einzelnen Umgebungsvariable (best practice)
  // Das vollständige JSON wird als String in der ENV-Variable erwartet.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log("Initializing Firebase Admin SDK with FIREBASE_SERVICE_ACCOUNT_KEY...");
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e: any) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Error: ", e.message);
      // Fall through to try other methods...
    }
  }

  // 2. Versuch: Einzelne Umgebungsvariablen (für Vercel, Netlify etc.)
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Korrigiert Zeilenumbrüche, die in ENV-Variablen als '\\n' escaped werden.
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    console.log("Initializing Firebase Admin SDK with individual environment variables...");
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  // 3. Fallback: Application Default Credentials (funktioniert nur in Google Cloud-Umgebungen)
  console.warn(
    "Initializing Firebase Admin with Application Default Credentials. " +
    "This is expected to work only in Google Cloud environments (like Cloud Run or Cloud Functions)."
  );
  return initializeApp();
}

const app = createApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
