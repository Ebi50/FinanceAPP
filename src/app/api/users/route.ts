import { NextResponse, NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdmin } from '@/firebase/admin-config';

// Initialize Firebase Admin SDK right away at the module level.
initAdmin();

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean, error?: string }> {
    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization?.startsWith('Bearer ')) {
            return { isAdmin: false, error: 'No authorization token provided.' };
        }

        const idToken = authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // First, check for the 'admin' role directly on the token.
        if (decodedToken.role === 'admin') {
            return { isAdmin: true };
        }

        // If the role isn't present, check if it's the special admin user.
        if (decodedToken.email === ADMIN_EMAIL) {
            // The user is the special admin. Set the custom claim for future requests.
            // This is done in the background and won't block the current request.
            admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' }).catch(console.error);
            // CRUCIALLY, allow the current request to proceed as an admin immediately.
            return { isAdmin: true };
        }

        // If neither condition is met, the user is not an admin.
        return { isAdmin: false, error: 'User is not an administrator.' };

    } catch (error) {
        console.error("Admin verification failed:", error);
        // In case of any error (e.g., invalid token), deny access.
        return { isAdmin: false, error: 'Token verification failed.' };
    }
}


export async function GET(request: NextRequest) {
    const { isAdmin, error } = await verifyAdmin(request);
    if (!isAdmin) {
        // Provide the specific reason for failure
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 });
    }

    try {
        const usersSnapshot = await admin.firestore().collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Internal server error while fetching users.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { isAdmin, error } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 });
    }

    try {
        const { email, firstName, lastName, role } = await request.json();
        
        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({ email });

        // Set custom claims (like role)
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        
        // Create user profile in Firestore
        const newUserProfile = { email, firstName, lastName, role, id: userRecord.uid };
        await admin.firestore().collection('users').doc(userRecord.uid).set(newUserProfile);
        
        return NextResponse.json(newUserProfile, { status: 201 });

    } catch (error: any) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while creating user.' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { isAdmin, error } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 });
    }
    
    try {
        const { id, ...userData } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Update custom claims if role is changed
        if (userData.role) {
            await admin.auth().setCustomUserClaims(id, { role: userData.role });
        }

        // Update Firestore document
        await admin.firestore().collection('users').doc(id).update(userData);
        
        const updatedUserDoc = await admin.firestore().collection('users').doc(id).get();
        const updatedUser = { id: updatedUserDoc.id, ...updatedUserDoc.data() };
        return NextResponse.json(updatedUser);

    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while updating user.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { isAdmin, error } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        // Delete from Auth first
        await admin.auth().deleteUser(id);
        
        // Then delete from Firestore
        await admin.firestore().collection('users').doc(id).delete();
        
        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while deleting user.' }, { status: 500 });
    }
}