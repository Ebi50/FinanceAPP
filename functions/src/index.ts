'use strict';

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

// A white-listed admin email that can be used for the first admin user.
const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

/**
 * Checks if the calling user has admin privileges.
 * Throws an HttpsError if the user is not authenticated or not an admin.
 * Sets the 'admin' custom claim if the user is the designated primary admin.
 * @param context - The context of the callable function.
 */
async function verifyAdmin(context: any) {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const userEmail = context.auth.token.email || '';
  let isAdmin = context.auth.token.role === 'admin';

  // Fallback for the primary admin email if the custom claim is not yet set
  if (!isAdmin && userEmail === ADMIN_EMAIL) {
    // Set custom claim for future requests to make them faster
    await admin.auth().setCustomUserClaims(context.auth.uid, { role: 'admin' });
    isAdmin = true;
  }

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'The function must be called by an admin.');
  }
}

export const listUsers = onCall(async (request) => {
  await verifyAdmin(request);
  try {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new HttpsError('internal', 'Internal server error');
  }
});

export const createUser = onCall(async (request) => {
  await verifyAdmin(request);
  try {
    const db = admin.firestore();
    const { email, firstName, lastName, role } = request.data;
    const newUserRef = db.collection('users').doc();
    const newUserProfile = { email, firstName, lastName, role, id: newUserRef.id };
    await newUserRef.set(newUserProfile);
    return newUserProfile;
  } catch (error) {
    console.error("Error creating user:", error);
    throw new HttpsError('internal', 'Internal server error');
  }
});

export const updateUser = onCall(async (request) => {
  await verifyAdmin(request);
  try {
    const db = admin.firestore();
    const { id, ...userData } = request.data;
    if (!id) {
      throw new HttpsError('invalid-argument', 'User ID is required');
    }
    await db.collection('users').doc(id).update(userData);
    const updatedUserDoc = await db.collection('users').doc(id).get();
    const updatedUser = { id: updatedUserDoc.id, ...updatedUserDoc.data() };
    return updatedUser;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new HttpsError('internal', 'Internal server error');
  }
});

export const deleteUser = onCall(async (request) => {
  await verifyAdmin(request);
  try {
    const db = admin.firestore();
    const { id } = request.data;
    if (!id) {
      throw new HttpsError('invalid-argument', 'User ID is required');
    }
    await db.collection('users').doc(id).delete();
    // Also delete the user from Firebase Auth
    try {
        await admin.auth().deleteUser(id);
    } catch(authError: any) {
        // If user doesn't exist in auth, it's not a critical failure here.
        console.warn(`Could not delete user from Auth (they might not exist): ${authError.message}`);
    }
    return { message: 'User deleted successfully' };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new HttpsError('internal', 'Internal server error');
  }
});
