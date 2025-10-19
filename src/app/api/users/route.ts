import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin-config';

// Initialize Firebase Admin SDK
const adminApp = initAdmin();
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

async function verifyAdmin(request: Request): Promise<string | null> {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
            if (userDoc.exists && userDoc.data()?.role === 'admin') {
                return decodedToken.uid;
            }
        } catch (error) {
            console.error("Error verifying token or admin role:", error);
            return null;
        }
    }
    return null;
}

// GET all users (Admin only)
export async function GET(request: Request) {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const usersSnapshot = await adminDb.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST a new user (Admin only)
export async function POST(request: Request) {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { email, firstName, lastName, role } = await request.json();
        
        // This just creates the user document. The user must still register via Firebase Auth client.
        const newUserRef = adminDb.collection('users').doc();
        const newUserProfile = { email, firstName, lastName, role, id: newUserRef.id };
        await newUserRef.set(newUserProfile);
        
        return NextResponse.json(newUserProfile, { status: 201 });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


// PUT (update) a user (Admin only)
export async function PUT(request: Request) {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id, ...userData } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        await adminDb.collection('users').doc(id).update(userData);
        const updatedUser = await adminDb.collection('users').doc(id).get();
        return NextResponse.json({ id: updatedUser.id, ...updatedUser.data() });
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


// DELETE a user (Admin only)
export async function DELETE(request: Request) {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        await adminDb.collection('users').doc(id).delete();
        // Note: This does not delete the user from Firebase Auth. A more complex setup is needed for that.
        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
