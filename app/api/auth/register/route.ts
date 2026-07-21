import { NextResponse } from "next/server";
import { createSession, enforceAuthRateLimit, ensureDefaultAdminAccounts, hashPassword, sessionCookie } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "calisma-alani";
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    await ensureDefaultAdminAccounts();
    await enforceAuthRateLimit(request, "register");
    const body = (await request.json()) as {
      accountType?: string; companyName?: string; username?: string; email?: string; fullName?: string; password?: string;
    };
    const username = body.username?.trim().toLowerCase() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const kind = body.accountType === "personal" ? "personal" : "business";
    const organizationName = kind === "business" ? body.companyName?.trim() ?? "" : `${fullName} · Kişisel Alan`;
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return NextResponse.json({ error: "Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, tire veya alt çizgi kullanılabilir." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
    if (fullName.length < 2 || organizationName.length < 2) return NextResponse.json({ error: "Ad soyad ve firma/çalışma alanı adı gereklidir." }, { status: 400 });
    if (!body.password || body.password.length < 10 || body.password.length > 128) return NextResponse.json({ error: "Yeni hesap parolası en az 10 karakter olmalıdır." }, { status: 400 });

    const database = getDb();
    const userId = createId("user");
    const organizationId = createId("org");
    const slug = `${slugify(organizationName)}-${organizationId.slice(-6).toLowerCase()}`;
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const credentials = await hashPassword(body.password);
    await database.batch([
      database.prepare("INSERT INTO users (id, username, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?, 'user')")
        .bind(userId, username, email, fullName, credentials.hash, credentials.salt),
      database.prepare(`INSERT INTO organizations
        (id, name, slug, kind, plan, subscription_status, trial_ends_at, created_by)
        VALUES (?, ?, ?, ?, 'trial', 'trialing', ?, ?)`)
        .bind(organizationId, organizationName, slug, kind, trialEndsAt, userId),
      database.prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'owner')")
        .bind(organizationId, userId),
      database.prepare("INSERT INTO organization_profiles (organization_id, legal_name, email) VALUES (?, ?, ?)")
        .bind(organizationId, kind === "business" ? organizationName : null, email),
      database.prepare(`INSERT INTO organization_period_summaries
        (id, organization_id, period, sort_order) VALUES (?, ?, 'Başlangıç dönemi', 1)`)
        .bind(createId("summary"), organizationId),
    ]);
    await addAudit(userId, "register", "organization", organizationId, `${organizationName} çalışma alanı oluşturuldu.`, organizationId);
    const token = await createSession(userId);
    const response = NextResponse.json({
      user: { id: userId, username, fullName, role: "user" },
      organization: { id: organizationId, name: organizationName, kind, subscriptionStatus: "trialing", trialEndsAt },
    }, { status: 201 });
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    const message = error instanceof Error && /UNIQUE|constraint/i.test(error.message)
      ? "Bu kullanıcı adı veya e-posta zaten kullanılıyor."
      : error instanceof Error ? error.message : "Kayıt oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Çok fazla deneme") ? 429 : 409 });
  }
}
