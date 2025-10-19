'use server';

import { NextResponse, NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdmin } from '@/firebase/admin-config';

// Initialize Firebase Admin SDK right away at the module level.
initAdmin();

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; response?: NextResponse; decodedToken?: admin.auth.DecodedIdToken }> {
    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization?.startsWith('Bearer ')) {
            return { isAdmin: false, response: NextResponse.json({ error: 'No authorization token provided.' }, { status: 401 }) };
        }

        const idToken = authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        if (decodedToken.role === 'admin') {
            return { isAdmin: true, decodedToken };
        }

        if (decodedToken.email === ADMIN_EMAIL) {
            // User is the special admin, but might not have the claim yet.
            // Set the custom claim in the background for future requests.
            await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'admin' });
            return { isAdmin: true, decodedToken };
        }

        return { isAdmin: false, response: NextResponse.json({ error: 'User is not an administrator.' }, { status: 403 }) };

    } catch (error) {
        console.error("Admin verification failed:", error);
        return { isAdmin: false, response: NextResponse.json({ error: 'Token verification failed.' }, { status: 401 }) };
    }
}


export async function GET(request: NextRequest) {
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
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
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
    }

    try {
        const { email, firstName, lastName, role } = await request.json();
        
        const userRecord = await admin.auth().createUser({ email });
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        
        const newUserProfile = { email, firstName, lastName, role, id: userRecord.uid };
        await admin.firestore().collection('users').doc(userRecord.uid).set(newUserProfile);
        
        return NextResponse.json(newUserProfile, { status: 201 });

    } catch (error: any) {
        console.error("Error creating user:", error);
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

        if (userData.role) {
            await admin.auth().setCustomUserClaims(id, { role: userData.role });
        }

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
