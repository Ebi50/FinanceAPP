import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
}

const parsedServiceAccount = JSON.parse(serviceAccount);

export function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  return admin.initializeApp({
    credential: admin.credential.cert(parsedServiceAccount),
    // Add your databaseURL here if you have one
    // databaseURL: "https://<your-project-id>.firebaseio.com"
  });
}
