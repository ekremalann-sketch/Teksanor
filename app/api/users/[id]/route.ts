import { NextResponse } from "next/server";
import { confirmRecentPassword, enforceAuthRateLimit, getCurrentUser, hashPassword, RATE_LIMIT_MESSAGE } from "@/lib/auth";
import { auditStatement, getDb, createId } from "@/lib/db";
import { requireOrganization, canManageOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

const noStore = { "Cache-Control": "private, no-store" };
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // gitleaks:allow -- parola üretim alfabesi, kimlik bilgisi değil

/** Okunması kolay, tek seferlik geçici parola: 3 × 4 karakter (≈ 69 bit). */
function createTemporaryPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request); if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let organization;
  try { ({ organization } = await requireOrganization(request, user)); }
  catch { return NextResponse.json({ error: "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, organization)) return NextResponse.json({ error: "Firma sahibi veya firma yöneticisi yetkisi gerekli." }, { status: 403 });
  const { id } = await context.params;
  let body: { active?: boolean; action?: string; password?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 }); }
  const db = getDb();

  // Hassas işlem: son 5 dk içinde parola doğrulanmamışsa yöneticinin kendi parolası istenir (oturum çalınsa bile tek başına yetmez).
  if (body.password) {
    try { await enforceAuthRateLimit(request, "login", `stepup:${user.id}`); }
    catch { return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 }); }
  }
  if (!await confirmRecentPassword(request, user.id, body.password)) {
    return NextResponse.json({ error: "Bu işlem için kendi Teksanor parolanızı yeniden girin.", passwordRequired: true }, { status: 403 });
  }

  if (body.action === "reset-password") {
    const target = await db.prepare(`SELECT u.id, u.full_name, u.role AS platform_role, m.role AS membership_role
      FROM organization_members m JOIN users u ON u.id = m.user_id
      WHERE m.organization_id = ? AND m.user_id = ? AND m.active = 1 AND u.active = 1`).bind(organization.id, id)
      .first<{ id: string; full_name: string; platform_role: string; membership_role: string }>();
    if (!target) return NextResponse.json({ error: "Aktif üye bulunamadı." }, { status: 404 });
    if (target.platform_role === "admin") return NextResponse.json({ error: "Platform yöneticisi hesabının parolası bu ekrandan sıfırlanamaz." }, { status: 403 });
    if (target.membership_role === "owner" && target.id !== user.id) return NextResponse.json({ error: "Firma sahibinin parolasını yalnız kendisi değiştirebilir." }, { status: 403 });
    if (target.membership_role === "admin" && target.id !== user.id && organization.membership_role !== "owner") {
      return NextResponse.json({ error: "Başka bir firma yöneticisinin parolasını yalnız firma sahibi sıfırlayabilir." }, { status: 403 });
    }
    // Hesap birden çok firmada kullanılıyorsa, yalnız o firmaların hepsinde yönetici olan kişi sıfırlayabilir (firmalar arası hesap ele geçirme önlenir).
    const foreign = await db.prepare(`SELECT 1 FROM organization_members t WHERE t.user_id = ? AND t.active = 1 AND t.organization_id <> ?
      AND NOT EXISTS (SELECT 1 FROM organization_members me WHERE me.organization_id = t.organization_id AND me.user_id = ? AND me.active = 1 AND me.role IN ('owner','admin')) LIMIT 1`)
      .bind(target.id, organization.id, user.id).first();
    if (foreign) return NextResponse.json({ error: "Bu hesap başka bir firmada da kullanılıyor; parolayı kişinin kendisi “Parolamı unuttum” ile yenilemeli." }, { status: 403 });
    const temporaryPassword = createTemporaryPassword();
    const credentials = await hashPassword(temporaryPassword);
    await db.batch([
      db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(credentials.hash, credentials.salt, target.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id),
      db.prepare("DELETE FROM mfa_challenges WHERE user_id = ?").bind(target.id),
      auditStatement(user.id, "member.password_reset", "user", target.id, `${target.full_name} için geçici parola atandı; açık oturumları kapatıldı. (Parola kaydedilmez.)`, organization.id),
    ]);

    // Geçici parola yalnız bu yanıtta döner; sunucuda yalnız özeti tutulur ve günlüklere yazılmaz.
    return NextResponse.json({ ok: true, temporaryPassword }, { headers: noStore });
  }

  if (id === user.id) return NextResponse.json({ error: "Kendi erişiminizi bu ekrandan değiştiremezsiniz." }, { status: 409 });
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "Aktiflik durumu gerekli." }, { status: 400 });
  try {
    const result = await db.batch([
      db.prepare(`UPDATE organization_members SET active=? WHERE organization_id=? AND user_id=? AND (role <> 'owner' OR ?='owner') AND
        (?=1 OR role NOT IN ('owner','admin') OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=? AND m.user_id<>? AND m.active=1 AND m.role IN ('owner','admin')))`)
        .bind(Number(body.active), organization.id, id, organization.membership_role, Number(body.active), organization.id, id),
      // Yalnız erişim kapatılınca oturumlar silinir (açmada gereksiz çıkış yaptırılmaz).
      db.prepare("DELETE FROM sessions WHERE user_id=? AND ?=0 AND EXISTS(SELECT 1 FROM organization_members WHERE user_id=? AND organization_id=? AND active=0)").bind(id, Number(body.active), id, organization.id),
      db.prepare(`INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id,details,organization_id)
        SELECT ?,?,?,'user',?,?,? WHERE EXISTS(SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND active=?)`)
        .bind(createId("audit"), user.id, body.active ? "member.activate" : "member.deactivate", id, body.active ? "Üyelik erişimi açıldı." : "Üyelik erişimi kapatıldı; oturumlar iptal edildi.", organization.id, organization.id, id, Number(body.active)),
    ]);
    if (!(result[0] as { meta?: { changes?: number } }).meta?.changes) return NextResponse.json({ error: "Üye bulunamadı, firma sahibi veya son yönetici erişimi korunuyor." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Üye erişimi değiştirilemedi." }, { status: 500 }); }
}
