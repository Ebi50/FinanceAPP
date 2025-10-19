'use server';

import { NextResponse, NextRequest } from 'next/server';
import * as admin from 'firebase-admin';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let serviceAccount: admin.ServiceAccount;
if (serviceAccountString) {
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.', error);
    // We don't throw here, to allow the app to run in environments without server-side admin logic.
    // The functions below will fail gracefully if the admin app is not initialized.
  }
} else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set or empty.');
}


function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  if (serviceAccount) {
     return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
  }
  return null;
}


const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; response?: NextResponse; decodedToken?: admin.auth.DecodedIdToken }> {
    const adminApp = initializeAdminApp();
    if (!adminApp) {
        return { isAdmin: false, response: NextResponse.json({ error: 'Admin SDK not initialized. Service account key might be missing.' }, { status: 500 }) };
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return { isAdmin: false, response: NextResponse.json({ error: 'No authorization token provided.' }, { status: 401 }) };
    }
    const idToken = authorization.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (decodedToken.email === ADMIN_EMAIL) {
            // This is the special admin user. Ensure their custom claim is set for future requests.
            if (decodedToken.role !== 'admin') {
                await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' });
            }
            return { isAdmin: true, decodedToken };
        }

        // For any other user, just check if they have the role.
        if (decodedToken.role === 'admin') {
            return { isAdmin: true, decodedToken };
        }

        // If neither condition is met, they are not an admin.
        return { isAdmin: false, response: NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 }) };
    } catch (error) {
        console.error("Token verification failed:", error);
        // This catch block is crucial. It handles expired tokens, malformed tokens, etc.
        return { isAdmin: false, response: NextResponse.json({ error: 'Token verification failed. Please sign in again.' }, { status: 401 }) };
    }
}


export async function GET(request: NextRequest) {
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin || !response) {
        // if verifyAdmin returns a response, it means verification failed.
        return response;
    }

    const adminApp = initializeAdminApp();
     if (!adminApp) {
        return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
    }

    try {
        const listUsersResult = await admin.auth().listUsers();
        const allUsers = listUsersResult.users.map(user => ({
            id: user.uid,
            email: user.email,
            role: user.customClaims?.role || 'user',
        }));
        
        // Fetch profiles from Firestore to get names
        const userProfiles = await admin.firestore().collection('users').get();
        const profilesMap = new Map(userProfiles.docs.map(doc => [doc.id, doc.data()]));

        const usersWithDetails = allUsers.map(user => {
            const profile = profilesMap.get(user.id);
            return {
                ...user,
                firstName: profile?.firstName || '',
                lastName: profile?.lastName || '',
            };
        });

        return NextResponse.json(usersWithDetails);

    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Internal server error while fetching users.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
    }

    try {
        const { email, password, firstName, lastName, role } = await request.json();

        if (!password) {
             return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }
        
        const userRecord = await admin.auth().createUser({ email, password });
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        
        const newUserProfile = { email, firstName, lastName, role, id: userRecord.uid };
        await admin.firestore().collection('users').doc(userRecord.uid).set(newUserProfile);
        
        return NextResponse.json(newUserProfile, { status: 201 });

    } catch (error: any) {
        console.error("Error creating user:", error);
        // Provide more specific error messages
        if (error.code === 'auth/email-already-exists') {
             return NextResponse.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.'}, { status: 409 });
        }
        return NextResponse.json({ error: error.message || 'Internal server error while creating user.' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
    }
    
    try {
        const { id, ...userData } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const updateData: { [key: string]: any } = {};
        if (userData.firstName) updateData.firstName = userData.firstName;
        if (userData.lastName) updateData.lastName = userData.lastName;
        
        if (Object.keys(updateData).length > 0) {
            await admin.firestore().collection('users').doc(id).update(updateData);
        }

        if (userData.role) {
            await admin.auth().setCustomUserClaims(id, { role: userData.role });
        }
        
        const updatedUserDoc = await admin.firestore().collection('users').doc(id).get();
        const updatedAuthUser = await admin.auth().getUser(id);

        const updatedUser = { 
            id: updatedUserDoc.id, 
            ...updatedUserDoc.data(),
            role: updatedAuthUser.customClaims?.role || 'user'
        };
        return NextResponse.json(updatedUser);

    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while updating user.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        await admin.auth().deleteUser(id);
        await admin.firestore().collection('users').doc(id).delete();
        
        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while deleting user.' }, { status: 500 });
    }
}

// This endpoint is no longer needed on the backend as password changes are handled securely on the client with re-authentication.
// However, I'm keeping a PATCH handler here as a placeholder to avoid breaking any assumptions,
// but it now correctly requires admin privileges to change another user's password if that flow were to be built.
export async function PATCH(request: NextRequest) {
    const { isAdmin, response, decodedToken } = await verifyAdmin(request);
    if (!isAdmin || !decodedToken) {
        return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // This is a privileged operation. An admin can change a user's password.
        const { userId, newPassword } = await request.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'User ID and new password are required.' }, { status: 400 });
        }
        
        await admin.auth().updateUser(userId, {
            password: newPassword
        });

        return NextResponse.json({ message: "Password updated successfully for user " + userId });
        
    } catch (error: any) {
         console.error("Error updating password by admin:", error);
         return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 });
    }
}
