// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ADMIN_EMAIL = "eberhard.janzen@freenet.de";

async function verifyAdmin(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  if (!authz.startsWith("Bearer ")) {
    return { ok: false, res: NextResponse.json({ error: "No token" }, { status: 401 }) };
  }
  const idToken = authz.slice(7);

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (decoded.email === ADMIN_EMAIL) {
      if ((decoded as any).role !== "admin") {
        // This is an async operation, but we don't need to wait for it.
        // The claim will be available on the next token refresh.
        adminAuth.setCustomUserClaims(decoded.uid, { role: "admin" }).catch(e => console.error("Error setting custom claim:", e));
      }
      return { ok: true, decoded };
    }

    if ((decoded as any).role === "admin") return { ok: true, decoded };

    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } catch(e: any) {
    console.error("Token verification failed:", e.message);
    // Log the error but return a generic message to the client.
    return { ok: false, res: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

export async function GET(req: NextRequest) {
  const vr = await verifyAdmin(req);
  if (!vr.ok) return vr.res!;

  try {
    const list = await adminAuth.listUsers();
    const users = list.users.map(u => ({
      id: u.uid,
      email: u.email,
      role: (u.customClaims as any)?.role ?? "user",
    }));

    const profSnap = await adminDb.collection("users").get();
    const profMap = new Map(profSnap.docs.map(d => [d.id, d.data()]));

    const out = users.map(u => ({
      ...u,
      firstName: profMap.get(u.id)?.firstName ?? "",
      lastName:  profMap.get(u.id)?.lastName  ?? "",
    }));

    return NextResponse.json(out);
  } catch(error: any) {
      console.error("Error in GET /api/users:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    const vr = await verifyAdmin(req);
    if (!vr.ok) return vr.res!;

    try {
        const { email, password, firstName, lastName, role } = await req.json();

        if (!email || !password || !firstName || !lastName || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        await adminAuth.setCustomUserClaims(userRecord.uid, { role });
        
        await adminDb.collection('users').doc(userRecord.uid).set({
            firstName,
            lastName,
            email,
            role,
        }, { merge: true });

        const finalUser = {
            id: userRecord.uid,
            email,
            firstName,
            lastName,
            role,
        };
        
        return NextResponse.json(finalUser, { status: 201 });

    } catch (error: any) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const vr = await verifyAdmin(req);
    if (!vr.ok) return vr.res!;

    try {
        const { id, firstName, lastName, role, email } = await req.json();

        if (!id || !firstName || !lastName || !role || !email) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        
        await adminAuth.updateUser(id, {
            displayName: `${firstName} ${lastName}`,
        });

        await adminAuth.setCustomUserClaims(id, { role });

        await adminDb.collection('users').doc(id).set({
            firstName,
            lastName,
            role,
        }, { merge: true });

        const updatedUser = {
            id,
            email,
            firstName,
            lastName,
            role,
        };

        return NextResponse.json(updatedUser, { status: 200 });

    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const vr = await verifyAdmin(req);
    if (!vr.ok) return vr.res!;

    try {
        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }
        
        await adminAuth.deleteUser(id);
        
        await adminDb.collection('users').doc(id).delete();

        return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });

    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
