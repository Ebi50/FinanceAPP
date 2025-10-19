// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

function createAdminApp(): App {
  if (getApps().length) return getApps()[0];

  if (!saJson) {
    // In einer Umgebung ohne explizite Credentials (z.B. GCP-Dienste wie Cloud Run/Functions)
    // versucht das Admin SDK, sich über Application Default Credentials zu authentifizieren.
    // Lokal oder in anderen Umgebungen wird dies fehlschlagen, wenn saJson nicht gesetzt ist.
    console.log("Initializing Firebase Admin SDK with Application Default Credentials.");
    return initializeApp();
  }

  // SA-JSON aus der Umgebungsvariable parsen
  try {
    const parsed = JSON.parse(saJson);
    // Das private_key Feld enthält oft \n als String-Literale, die in echte Zeilenumbrüche umgewandelt werden müssen.
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return initializeApp({ credential: cert(parsed) });
  } catch (e: any) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Check if the environment variable is set correctly and is a valid JSON.", e);
      // Fallback, der wahrscheinlich fehlschlagen wird, aber einen Absturz verhindert.
      return initializeApp();
  }
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
