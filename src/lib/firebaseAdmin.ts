// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Falls der private key in der .env-Datei escaped wurde (z.B. in Vercel), wird dies korrigiert.
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Bevorzugt die expliziten Umgebungsvariablen
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Fallback für Umgebungen, die Application Default Credentials (ADC) bereitstellen (z.B. Google Cloud Functions)
  // Dieser Zweig wird lokal oder auf vielen anderen Hosting-Plattformen fehlschlagen, wenn die obigen ENV-Vars nicht gesetzt sind.
  return initializeApp();
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
