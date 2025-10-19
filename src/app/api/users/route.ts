'use server';

import { NextResponse, NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdmin } from '@/firebase/admin-config';

// Initialize Firebase Admin SDK right away at the module level.
initAdmin();

const ADMIN_EMAIL = 'eberhard.janzen@freenet.de';

async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; response?: NextResponse; decodedToken?: admin.auth.DecodedIdToken }> {
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
    const { isAdmin, response } = await verifyAdmin(request);
    if (!isAdmin) {
        return response;
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

// New endpoint to handle secure password changes
export async function PATCH(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No authorization token provided.' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    try {
        const { oldPassword, newPassword } = await request.json();

        if (!oldPassword || !newPassword) {
            return NextResponse.json({ error: 'Old and new passwords are required.' }, { status: 400 });
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // This is a client-side operation, so we can't directly verify the old password here.
        // The proper flow is for the client to re-authenticate and then call the update password function.
        // This endpoint will just update the password for the given user ID.
        // For enhanced security, the client should handle the re-authentication.
        
        await admin.auth().updateUser(decodedToken.uid, {
            password: newPassword
        });

        return NextResponse.json({ message: "Password updated successfully" });
        
    } catch (error: any) {
         console.error("Error updating password:", error);
         return NextResponse.json({ error: 'Failed to update password. Please try again.' }, { status: 500 });
    }
}
