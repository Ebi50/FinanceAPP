// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  // Wenn bereits eine App initialisiert ist, geben wir sie zurück.
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Prüfen, ob die Service-Account-Daten als Umgebungsvariable vorhanden sind.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      // Direkter Versuch, das JSON zu parsen.
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      // Korrektur für das private_key Format, falls nötig.
      // Dies ist der robusteste Teil, der Probleme mit \n löst.
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      // Initialisieren mit den geparsten Credentials.
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (e: any) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
        // Wenn das Parsen fehlschlägt, versuchen wir den Fallback.
    }
  }

  // Fallback für Umgebungen, die ADC (Application Default Credentials) unterstützen (z.B. Google Cloud Run).
  // In der Firebase App Hosting Umgebung sollte dies der Standardweg sein, wenn keine Variable gesetzt ist.
  console.log("Initializing Firebase Admin SDK with Application Default Credentials.");
  return initializeApp();
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
