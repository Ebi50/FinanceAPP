
// lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Best Practice: Use a single environment variable with the full JSON content.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      // This is the most robust way to parse the service account key,
      // handling cases where it might be wrapped in quotes or have escaped characters.
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      return initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (error: any) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error.message);
      // Add a more descriptive error message to help debugging.
      throw new Error(
        "Failed to initialize Firebase Admin SDK. The FIREBASE_SERVICE_ACCOUNT_KEY is not a valid JSON string. " +
        "Please ensure you copy the entire content of the service account JSON file into the .env variable without any extra wrapping quotes."
      );
    }
  }
  
  // This fallback should ideally not be reached in a production environment
  // where the service account key is properly set.
  console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Initializing Firebase Admin SDK with Application Default Credentials. This is not recommended for production outside of Google Cloud environments.");
  return initializeApp();
}

const app = createAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
