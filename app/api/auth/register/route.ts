import { NextResponse } from "next/server";
import { getDb, createId, addAudit, ensureSchema } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";
import { hashPassword, randomSalt } from "@/lib/passwords";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "firma";
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const fullName = text(body.full_name);
    const email = text(body.email).toLowerCase();
    const password = text(body.password, 300);
    const orgName = text(body.organization_name) || `${fullName} Çalışma Alanı`;
    if (!fullName || !email || !password) return NextResponse.json({ error: "Ad soyad, e-posta ve parola gereklidir." }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Parola en az 6 karakter olmalıdır." }, { status: 400 });
    const existing = await getDb().prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });

    const userId = createId("usr");
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    await getDb().prepare("INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, fullName, email, hash, salt).run();

    const orgId = createId("org");
    await getDb().prepare("INSERT INTO organizations (id, name, slug, sector) VALUES (?, ?, ?, ?)")
      .bind(orgId, orgName, `${slugify(orgName)}-${orgId.slice(-4)}`, "Genel").run();
    await getDb().prepare("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)")
      .bind(createId("mem"), orgId, userId, "owner").run();
    await addAudit(userId, "create", "organization", orgId, `${orgName} çalışma alanı oluşturuldu.`, orgId);

    const sessionId = await createSession(userId, request);
    const response = NextResponse.json({ ok: true, organizationId: orgId });
    response.headers.set("Set-Cookie", sessionCookie(sessionId));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt oluşturulamadı." }, { status: 400 });
  }
}
