// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

function createAdminApp(): App {
  if (getApps().length) return getApps()[0];

  if (!saJson) {
    // GCP-Umgebung (Cloud Functions/Run) könnte ohne SA-JSON laufen
    console.log("Initializing Firebase Admin SDK with Application Default Credentials.");
    return initializeApp();
  }

  // SA-JSON aus ENV parsen + evtl. \n reparieren
  try {
    const parsed = JSON.parse(saJson);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return initializeApp({ credential: cert(parsed) });
  } catch (e: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Initializing with default credentials.", e);
    return initializeApp();
  }
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
