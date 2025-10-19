// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// 1) Primary: Service Account aus ENV (empfohlen)
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY; // vollständiges JSON als String
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Falls PRIVATE_KEY in ENV Zeilenumbrüche escaped hat:
if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n");

function createApp(): App {
  if (getApps().length) return getApps()[0];

  // a) Komplettes SA-JSON vorhanden
  if (saJson) {
    try {
        const sa = JSON.parse(saJson);
        return initializeApp({ credential: cert(sa) });
    } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // b) Einzelwerte vorhanden
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  // c) Fallback: ADC (nur in GCP-Umgebungen sinnvoll)
  console.warn("Initializing Firebase Admin with default credentials. This is only expected to work in GCP environments.");
  return initializeApp(); // funktioniert in Cloud Functions/Run
}

const app = createApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
