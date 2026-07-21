import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const current = await getCurrentUser(request);
  if (!current) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, current); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(current, context.organization)) return NextResponse.json({ error: "Şirket yöneticisi yetkisi gerekli." }, { status: 403 });
  const body = (await request.json()) as { username?: string; fullName?: string; password?: string; role?: string };
  const username = body.username?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || !body.fullName || !body.password || body.password.length < 10 || body.password.length > 128) {
    return NextResponse.json({ error: "3-32 karakterli kullanıcı adı, görünen ad ve en az 10 karakterli parola gereklidir." }, { status: 400 });
  }
  const id = createId("user");
  const credentials = await hashPassword(body.password);
  try {
    await getDb().batch([
      getDb().prepare("INSERT INTO users (id, username, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?, 'user')")
        .bind(id, username, `${username}@users.teksanor.internal`, body.fullName.trim(), credentials.hash, credentials.salt),
      getDb().prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)")
        .bind(context.organization.id, id, body.role === "admin" ? "admin" : "member"),
    ]);
    await addAudit(current.id, "create", "user", id, `${body.fullName} kullanıcısı oluşturuldu.`, context.organization.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bu kullanıcı adı zaten kayıtlı olabilir." }, { status: 409 });
  }
}
