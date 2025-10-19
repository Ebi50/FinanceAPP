'use server';
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin-config';
import * as admin from 'firebase-admin';

async function verifyAdmin(request: Request): Promise<{adminUid: string | null, adminApp: admin.app.App | null}> {
    try {
        const adminApp = initAdmin();
        const adminDb = getFirestore(adminApp);
        const adminAuth = getAuth(adminApp);
        
        const authorization = request.headers.get('Authorization');
        if (authorization?.startsWith('Bearer ')) {
            const idToken = authorization.split('Bearer ')[1];
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
            if (userDoc.exists && userDoc.data()?.role === 'admin') {
                return { adminUid: decodedToken.uid, adminApp };
            }
        }
    } catch (error) {
        console.error("Error verifying token or admin role:", error);
        return { adminUid: null, adminApp: null };
    }
    return { adminUid: null, adminApp: null };
}

// GET all users (Admin only)
export async function GET(request: Request) {
    const { adminUid, adminApp } = await verifyAdmin(request);
    if (!adminUid || !adminApp) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const adminDb = getFirestore(adminApp);
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
    const { adminUid, adminApp } = await verifyAdmin(request);
    if (!adminUid || !adminApp) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const adminDb = getFirestore(adminApp);
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
    const { adminUid, adminApp } = await verifyAdmin(request);
    if (!adminUid || !adminApp) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const adminDb = getFirestore(adminApp);
        const { id, ...userData } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        await adminDb.collection('users').doc(id).update(userData);
        const updatedUserDoc = await adminDb.collection('users').doc(id).get();
        const updatedUser = { id: updatedUserDoc.id, ...updatedUserDoc.data() };
        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


// DELETE a user (Admin only)
export async function DELETE(request: Request) {
    const { adminUid, adminApp } = await verifyAdmin(request);
    if (!adminUid || !adminApp) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const adminDb = getFirestore(adminApp);
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
