// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Best Practice: Use a single environment variable with the full JSON content.
  // This is the most robust method, especially for hosting environments.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (error: any) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error.message);
      throw new Error("Failed to initialize Firebase Admin SDK. Make sure FIREBASE_SERVICE_ACCOUNT_KEY is a valid JSON string.");
    }
  }

  // Fallback for environments that provide Application Default Credentials (ADC), e.g., Google Cloud Functions.
  // This will fail in environments like Vercel or local if the above variable is not set.
  console.warn("Initializing Firebase Admin SDK with Application Default Credentials. This is not recommended for production outside of Google Cloud environments.");
  return initializeApp();
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
