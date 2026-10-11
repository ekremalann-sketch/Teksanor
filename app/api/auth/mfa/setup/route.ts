import { NextResponse } from "next/server";
import { hasRecentPasswordProof, getCurrentUser, verifyPassword, enforceAuthRateLimit, createSession, sessionCookie } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { createOtpAuthUri, createRecoveryCodes, createTotpSecret, encryptTotpSecret, decryptTotpSecret, hashRecoveryCodes, mfaKeyConfigured, mfaMode, MFA_DEFER_DAYS, verifyTotp, normalizeRecovery, looksLikeRecoveryCode } from "@/lib/mfa";
import { rejectCrossSiteMutation } from "@/lib/security";

const noStore = { "Cache-Control": "private, no-store" };

async function recoveryDigest(code: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`recovery:${normalizeRecovery(code)}`)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isManager(userId: string, role: string) {
  if (role === "admin") return true;
  return !!await getDb().prepare("SELECT 1 FROM organization_members WHERE user_id=? AND active=1 AND role IN ('owner','admin') LIMIT 1").bind(userId).first();
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401, headers: noStore });
  const security = await getDb().prepare("SELECT mfa_deferred_until, recovery_codes FROM user_security WHERE user_id=?").bind(user.id)
    .first<{ mfa_deferred_until: string | null; recovery_codes: string | null }>();
  let recoveryLeft = 0;
  try { recoveryLeft = security?.recovery_codes ? (JSON.parse(security.recovery_codes) as string[]).length : 0; } catch { recoveryLeft = 0; }
  const manager = await isManager(user.id, user.role);
  const keyConfigured = mfaKeyConfigured();
  const mode = mfaMode();
  // "required" modda yöneticiler için zorunlu (anahtar yoksa kilitlenme olmasın diye zorlanmaz); "optional" modda kimse zorlanmaz.
  const required = mode === "required" && manager && keyConfigured;
  const deferUsed = !!await getDb().prepare("SELECT 1 FROM audit_logs WHERE user_id=? AND action='defer_mfa' LIMIT 1").bind(user.id).first();
  return NextResponse.json({
    enabled: !!user.mfa_enabled,
    passwordConfirmed: await hasRecentPasswordProof(request, user.id),
    mode,
    required,
    passwordOnly: mode === "off",
    keyConfigured,
    deferred: !!user.mfa_deferred,
    deferredUntil: user.mfa_deferred ? security?.mfa_deferred_until ?? null : null,
    // Erteleme yalnız zorunlu modda ve hesap başına bir kez verilir; süre dolunca kurulum zorunlu olur.
    canDefer: required && !user.mfa_enabled && !user.mfa_deferred && !deferUsed,
    recoveryLeft,
}, { headers: noStore });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let body: { action?: string; password?: string; code?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 }); }
  try { await enforceAuthRateLimit(request, "mfa", `mfa-setup:${user.id}`); }
  catch { return NextResponse.json({ error: "Çok fazla deneme yapıldı. 15 dakika sonra yeniden deneyin." }, { status: 429 }); }
  const db = getDb();

  if (body.action === "defer") {
    const required = mfaMode() === "required" && mfaKeyConfigured() && await isManager(user.id, user.role);
    if (!required) return NextResponse.json({ error: "İki aşamalı doğrulama bu hesapta zorunlu değil; ertelemeye gerek yok." }, { status: 409 });
    if (user.mfa_enabled) return NextResponse.json({ error: "İki aşamalı doğrulama zaten etkin." }, { status: 409 });
    const used = await db.prepare("SELECT 1 FROM audit_logs WHERE user_id=? AND action='defer_mfa' LIMIT 1").bind(user.id).first();
    if (used) return NextResponse.json({ error: "Erteleme hakkı daha önce kullanıldı. Devam etmek için kurulumu tamamlayın." }, { status: 403 });
    await db.prepare(`INSERT INTO user_security(user_id,mfa_deferred_until) VALUES (?,datetime('now','+${MFA_DEFER_DAYS} days'))
      ON CONFLICT(user_id) DO UPDATE SET mfa_deferred_until=excluded.mfa_deferred_until`).bind(user.id).run();
    await addAudit(user.id, "defer_mfa", "user_security", user.id, `İki aşamalı doğrulama kurulumu ${MFA_DEFER_DAYS} gün ertelendi.`);
    return NextResponse.json({ ok: true, deferredDays: MFA_DEFER_DAYS }, { headers: noStore });
  }

  if (body.action === "disable") {
    // Yalnız isteğe bağlı/kapalı modda ya da zorunlu olmayan hesapta kapatılabilir. Parola + güncel kod (veya kurtarma kodu) ister.
    if (!user.mfa_enabled) return NextResponse.json({ error: "İki aşamalı doğrulama zaten kapalı." }, { status: 409 });
    if (mfaMode() === "required" && await isManager(user.id, user.role)) return NextResponse.json({ error: "Bu sunucuda yönetici hesapları için iki aşamalı doğrulama zorunludur; kapatılamaz." }, { status: 403 });
    const stored = await db.prepare("SELECT u.password_hash,u.password_salt,s.totp_secret,s.recovery_codes FROM users u JOIN user_security s ON s.user_id=u.id WHERE u.id=?").bind(user.id)
      .first<{ password_hash: string; password_salt: string; totp_secret: string | null; recovery_codes: string | null }>();
    const passwordOk = !!stored && !!body.password && await verifyPassword(body.password, stored.password_salt, stored.password_hash);
    let secondOk = false;
    const code = String(body.code ?? "");
    if (looksLikeRecoveryCode(code)) {
      try { secondOk = (JSON.parse(stored?.recovery_codes ?? "[]") as string[]).includes(await recoveryDigest(code)); } catch { secondOk = false; }
    } else {
      try { secondOk = !!stored?.totp_secret && await verifyTotp(await decryptTotpSecret(stored.totp_secret), code); } catch { secondOk = false; }
    }
    if (!passwordOk || !secondOk) return NextResponse.json({ error: "Kapatmak için parolanızı ve uygulamadaki güncel 6 haneli kodu (veya bir kurtarma kodunu) girin." }, { status: 403 });
    await db.batch([
      db.prepare("UPDATE user_security SET mfa_enabled=0,totp_secret=NULL,mfa_setup_secret=NULL,recovery_codes=NULL,last_totp_counter=-1 WHERE user_id=?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
      db.prepare("DELETE FROM mfa_challenges WHERE user_id=?").bind(user.id),
    ]);
    await addAudit(user.id, "disable_mfa", "user_security", user.id, "İki aşamalı doğrulama kullanıcı tarafından kapatıldı; tüm oturumlar kapatıldı.");
    const token = await createSession(user.id);
    return NextResponse.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": sessionCookie(token) } });
  }

  if (body.action === "recovery-codes") {
    // Etkin kullanıcı yeni kod seti üretir; eski kodlar geçersiz olur. Parola veya güncel TOTP ister.
    if (!user.mfa_enabled) return NextResponse.json({ error: "Önce iki aşamalı doğrulamayı etkinleştirin." }, { status: 409 });
    const stored = await db.prepare("SELECT u.password_hash,u.password_salt,s.totp_secret FROM users u JOIN user_security s ON s.user_id=u.id WHERE u.id=?").bind(user.id)
      .first<{ password_hash: string; password_salt: string; totp_secret: string | null }>();
    const passwordOk = !!stored && !!body.password && await verifyPassword(body.password, stored.password_salt, stored.password_hash);
    let codeOk = false;
    try { codeOk = !!stored?.totp_secret && !!body.code && await verifyTotp(await decryptTotpSecret(stored.totp_secret), body.code); } catch { codeOk = false; }
    if (!passwordOk && !codeOk) return NextResponse.json({ error: "Parolanızı veya uygulamadaki güncel 6 haneli kodu girin." }, { status: 403 });
    const codes = createRecoveryCodes();
    await db.prepare("UPDATE user_security SET recovery_codes=? WHERE user_id=?").bind(await hashRecoveryCodes(codes), user.id).run();
    await addAudit(user.id, "rotate_mfa_recovery_codes", "user_security", user.id);
    return NextResponse.json({ ok: true, recoveryCodes: codes }, { headers: noStore });
  }

  if (user.mfa_enabled) return NextResponse.json({ error: "İki aşamalı doğrulama zaten etkin." }, { status: 409 });
  if (!mfaKeyConfigured()) return NextResponse.json({ error: "Sunucuda MFA şifreleme anahtarı (MFA_ENCRYPTION_KEY) tanımlı değil. Kurulum şimdilik yapılamaz; güvenli erişim için sunucu ayarı düzeltilmelidir. Yöneticinize bildirin." }, { status: 503 });

  try {
    if (body.action === "start") {
      const stored = await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first<{ password_hash: string; password_salt: string }>();
      if (!await hasRecentPasswordProof(request, user.id) && (!stored || !body.password || !await verifyPassword(body.password, stored.password_salt, stored.password_hash))) {
        return NextResponse.json({ error: "Teksanor girişinde kullandığınız parola eşleşmedi. ChatGPT veya e-posta parolanızı kullanmayın." }, { status: 403 });
      }
      const secret = createTotpSecret(); const encrypted = await encryptTotpSecret(secret);
      await db.prepare(`INSERT INTO user_security(user_id,mfa_setup_secret,mfa_setup_expires_at) VALUES (?,?,datetime('now','+10 minutes'))
        ON CONFLICT(user_id) DO UPDATE SET mfa_setup_secret=excluded.mfa_setup_secret,mfa_setup_expires_at=excluded.mfa_setup_expires_at`).bind(user.id, encrypted).run();
      return NextResponse.json({ secret, otpAuthUri: createOtpAuthUri(secret, user.username) }, { headers: noStore });
    }
    const security = await db.prepare("SELECT mfa_setup_secret, mfa_setup_expires_at > CURRENT_TIMESTAMP AS fresh FROM user_security WHERE user_id=? AND mfa_enabled=0").bind(user.id)
      .first<{ mfa_setup_secret: string | null; fresh: number }>();
    if (!security?.mfa_setup_secret) return NextResponse.json({ error: "Önce “İki aşamalı doğrulamayı kur” düğmesiyle yeni anahtar oluşturun." }, { status: 400 });
    if (!security.fresh) return NextResponse.json({ error: "Kurulum anahtarının 10 dakikalık süresi doldu. “Yeni güvenli anahtar üret” ile tekrar başlayın; uygulamadaki eski Teksanor kaydını silin." }, { status: 400 });
    if (!body.code || !await verifyTotp(await decryptTotpSecret(security.mfa_setup_secret), body.code)) {
      return NextResponse.json({ error: "Kod eşleşmedi. Telefonun saatinin otomatik olduğundan emin olun ve uygulamadaki en güncel kodu girin." }, { status: 400 });
    }
    const codes = createRecoveryCodes();
    await db.batch([
      db.prepare("UPDATE user_security SET totp_secret=mfa_setup_secret,mfa_setup_secret=NULL,mfa_enabled=1,mfa_setup_expires_at=NULL,mfa_deferred_until=NULL,recovery_codes=?,last_totp_counter=-1 WHERE user_id=?").bind(await hashRecoveryCodes(codes), user.id),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
    ]);
    const token = await createSession(user.id);
    await addAudit(user.id, "enable_mfa", "user_security", user.id);
    // Kurtarma kodları yalnız bu yanıtta düz metin olarak döner; sunucuda özetleri tutulur.
    return NextResponse.json({ ok: true, recoveryCodes: codes }, { headers: { ...noStore, "Set-Cookie": sessionCookie(token) } });
  } catch {
    return NextResponse.json({ error: "Kurulum tamamlanamadı. Birkaç saniye sonra yeniden deneyin; sürerse yöneticinize bildirin." }, { status: 503 });
  }
}
