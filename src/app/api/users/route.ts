import { NextResponse, type NextRequest } from 'next/server';
import * as admin from 'firebase-admin';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

export const runtime = "nodejs"; // Erzwinge die Node.js-Laufzeitumgebung

// --- Sichere Initialisierung des Admin SDKs ---
// Diese Funktion stellt sicher, dass die Admin-App nur einmal initialisiert wird.
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Dieser Block wird ausgeführt, wenn die App in einer Umgebung wie Firebase App Hosting läuft,
  // wo die Credentials automatisch über Umgebungsvariablen bereitgestellt werden.
  try {
    return admin.initializeApp();
  } catch (error) {
    console.error("Firebase Admin initialization failed with default credentials:", error);
    // Fallback für lokale Entwicklung, falls die Standard-Initialisierung fehlschlägt
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountString) {
      try {
        const serviceAccount = JSON.parse(serviceAccountString);
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (parseError) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", parseError);
      }
    }
  }

  // Wenn keine Initialisierungsmethode erfolgreich war, wird null zurückgegeben.
  // Die API-Routen-Handler müssen dies überprüfen.
  return null;
}


const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; response?: NextResponse; decodedToken?: admin.auth.DecodedIdToken }> {
    const adminApp = initializeAdminApp();
    if (!adminApp) {
        return { isAdmin: false, response: NextResponse.json({ error: 'Admin SDK not initialized. Service account key might be missing or invalid.' }, { status: 500 }) };
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return { isAdmin: false, response: NextResponse.json({ error: 'No authorization token provided.' }, { status: 401 }) };
    }
    const idToken = authorization.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (decodedToken.email === ADMIN_EMAIL) {
            if (decodedToken.role !== 'admin') {
                await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' });
            }
            return { isAdmin: true, decodedToken };
        }

        if (decodedToken.role === 'admin') {
            return { isAdmin: true, decodedToken };
        }

        return { isAdmin: false, response: NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 }) };
    } catch (error) {
        console.error("Token verification failed:", error);
        return { isAdmin: false, response: NextResponse.json({ error: 'Token verification failed. Please sign in again.' }, { status: 401 }) };
    }
}


export async function GET(request: NextRequest) {
    try {
        const { isAdmin, response } = await verifyAdmin(request);
        if (!isAdmin) {
            return response || NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 });
        }

        const adminApp = initializeAdminApp();
        if (!adminApp) {
            return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
        }

        const listUsersResult = await admin.auth().listUsers();
        const allUsers = listUsersResult.users.map(user => ({
            id: user.uid,
            email: user.email,
            role: user.customClaims?.role || 'user',
        }));
        
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
    } catch (error: any) {
        console.error("Error in GET /api/users:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while fetching users.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { isAdmin, response } = await verifyAdmin(request);
        if (!isAdmin) {
            return response || NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 });
        }

        const adminApp = initializeAdminApp();
        if (!adminApp) {
        return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
        }

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
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.'}, { status: 409 });
        }
        return NextResponse.json({ error: error.message || 'Internal server error while creating user.' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { isAdmin, response } = await verifyAdmin(request);
        if (!isAdmin) {
            return response || NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 });
        }

        const adminApp = initializeAdminApp();
        if (!adminApp) {
            return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
        }
        
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
    try {
        const { isAdmin, response } = await verifyAdmin(request);
        if (!isAdmin) {
            return response || NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 });
        }
        
        const adminApp = initializeAdminApp();
        if (!adminApp) {
            return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
        }

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

export async function PATCH(request: NextRequest) {
    try {
        const { isAdmin, response, decodedToken } = await verifyAdmin(request);
        if (!isAdmin || !decodedToken) {
            return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminApp = initializeAdminApp();
        if (!adminApp) {
            return NextResponse.json({ error: 'Admin SDK not initialized.' }, { status: 500 });
        }

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