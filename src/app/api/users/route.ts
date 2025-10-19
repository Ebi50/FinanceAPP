import { NextResponse, NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdmin } from '@/firebase/admin-config';

// Initialize Firebase Admin SDK right away at the module level.
initAdmin();

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean }> {
    try {
        const authorization = request.headers.get('Authorization');
        if (authorization?.startsWith('Bearer ')) {
            const idToken = authorization.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            
            // Direct role check
            if (decodedToken.role === 'admin') {
                return { isAdmin: true };
            }
            
            // Fallback for the special admin email
            if (decodedToken.email === ADMIN_EMAIL) {
                 // If the special admin logs in but doesn't have the claim yet, set it.
                 if (decodedToken.role !== 'admin') {
                    await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' });
                 }
                 // Crucially, return true for the current request as well.
                 return { isAdmin: true };
            }
        }
        // If no token or conditions are met, they are not an admin.
        return { isAdmin: false };
    } catch(error) {
        console.error("Admin verification failed:", error);
        // In case of any error (e.g., invalid token), deny access.
        return { isAdmin: false };
    }
}


export async function GET(request: NextRequest) {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const usersSnapshot = await admin.firestore().collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
        
        return NextResponse.json(newUserProfile);

    } catch (error: any) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        // Delete from Firestore
        await admin.firestore().collection('users').doc(id).delete();
        
        // Delete from Firebase Auth
        await admin.auth().deleteUser(id);
        
        return NextResponse.json({ message: 'User deleted successfully' });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
