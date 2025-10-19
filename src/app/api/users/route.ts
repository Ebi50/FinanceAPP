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

    // Sofortzugang via E-Mail
    if (decoded.email === ADMIN_EMAIL) {
      // Optional: Claim setzen; Token-Refresh im Client nötig
      if ((decoded as any).role !== "admin") {
        await adminAuth.setCustomUserClaims(decoded.uid, { role: "admin" });
      }
      return { ok: true, decoded };
    }

    if ((decoded as any).role === "admin") return { ok: true, decoded };

    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

export async function GET(req: NextRequest) {
  const vr = await verifyAdmin(req);
  if (!vr.ok) return vr.res!;

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
}
