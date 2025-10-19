import { NextResponse, type NextRequest } from "next/server";
export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ADMIN_EMAIL = "eberhard.janzen@freenet.de";

async function verifyAdmin(req: NextRequest): Promise<{ ok: boolean; res?: NextResponse; decoded?: any }> {
  const authz = req.headers.get("authorization") ?? "";
  if (!authz.startsWith("Bearer ")) {
    return { ok: false, res: NextResponse.json({ error: "No token" }, { status: 401 }) };
  }
  const idToken = authz.slice(7);

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Admin über E-Mail (Sofortzugang)
    if (decoded.email === ADMIN_EMAIL) {
      // optional: Claim setzen (wirkt erst nach Token-Refresh)
      if ((decoded as any).role !== "admin") {
        await adminAuth.setCustomUserClaims(decoded.uid, { role: "admin" });
      }
      return { ok: true, decoded };
    }

    // oder über Custom Claim
    if ((decoded as any).role === "admin") return { ok: true, decoded };

    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } catch (e: any) {
    console.error("Token verification failed:", e.message);
    return { ok: false, res: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

export async function GET(req: NextRequest) {
    try {
        const vr = await verifyAdmin(req);
        if (!vr.ok) return vr.res!;

        // Nutzer holen
        const list = await adminAuth.listUsers();
        const authUsers = list.users.map(u => ({
            id: u.uid,
            email: u.email,
            role: (u.customClaims as any)?.role ?? "user",
        }));

        // Profile joinen
        const snap = await adminDb.collection("users").get();
        const profiles = new Map(snap.docs.map(d => [d.id, d.data()]));
        const out = authUsers.map(u => ({
            ...u,
            firstName: (profiles.get(u.id)?.firstName) ?? "",
            lastName: (profiles.get(u.id)?.lastName) ?? "",
        }));
        return NextResponse.json(out);

    } catch (error: any) {
        console.error("Error in GET /api/users:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while fetching users.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const vr = await verifyAdmin(req);
        if (!vr.ok) return vr.res!;

        const { email, password, firstName, lastName, role } = await req.json();

        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }
        
        const userRecord = await adminAuth.createUser({ email, password });
        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
        
        const newUserProfile = { email, firstName, lastName, role, id: userRecord.uid };
        await adminDb.collection('users').doc(userRecord.uid).set(newUserProfile);
        
        return NextResponse.json(newUserProfile, { status: 201 });
    } catch (error: any) {
        console.error("Error creating user:", error);
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.'}, { status: 409 });
        }
        return NextResponse.json({ error: error.message || 'Internal server error while creating user.' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const vr = await verifyAdmin(req);
        if (!vr.ok) return vr.res!;
        
        const { id, ...userData } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const updateData: { [key: string]: any } = {};
        if (userData.firstName !== undefined) updateData.firstName = userData.firstName;
        if (userData.lastName !== undefined) updateData.lastName = userData.lastName;
        
        if (Object.keys(updateData).length > 0) {
            await adminDb.collection('users').doc(id).update(updateData);
        }

        if (userData.role) {
            await adminAuth.setCustomUserClaims(id, { role: userData.role });
        }
        
        const userDocAfterUpdate = await adminDb.collection('users').doc(id).get();
        const authUserAfterUpdate = await adminAuth.getUser(id);

        const updatedUser = { 
            id: userDocAfterUpdate.id, 
            ...userDocAfterUpdate.data(),
            role: authUserAfterUpdate.customClaims?.role || 'user'
        };
        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while updating user.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const vr = await verifyAdmin(req);
        if (!vr.ok) return vr.res!;
        
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        await adminAuth.deleteUser(id);
        await adminDb.collection('users').doc(id).delete();
        
        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || 'Internal server error while deleting user.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const vr = await verifyAdmin(req);
        if (!vr.ok) return vr.res!;

        const { userId, newPassword } = await req.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'User ID and new password are required.' }, { status: 400 });
        }
        
        await adminAuth.updateUser(userId, {
            password: newPassword
        });

        return NextResponse.json({ message: "Password updated successfully for user " + userId });
    } catch (error: any) {
         console.error("Error updating password by admin:", error);
         return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 });
    }
}