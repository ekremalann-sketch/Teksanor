import { env } from "cloudflare:workers";
import { getDb, ensureSchema, createId, addAudit, DEFAULT_ORGANIZATION_ID } from "./db";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  active: number;
  mfa_enabled: number;
  /** 1 = kullanıcı MFA kurulumunu geçerli bir erteleme süresi içinde ertelemiş. */
  mfa_deferred?: number;
};

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeTextEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

function clientIp(request: Request) {
  return (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
}

export const RATE_LIMIT_MESSAGE = "Çok fazla deneme yapıldı. Güvenliğiniz için 15 dakika sonra tekrar deneyin.";
export class RateLimitError extends Error {
  readonly status = 429;
  constructor() { super(RATE_LIMIT_MESSAGE); }
}

export async function enforceAuthRateLimit(request: Request, action: "login" | "register" | "mfa" | "recovery", identity = "") {
  await ensureSchema();
  const database = getDb();
  const forwarded = clientIp(request);

  // auth_attempts.action CHECK yalnız login/register kabul eder; MFA ve kurtarma ayrı parmak izi önekiyle "login" olarak saklanır.
  const scope = action === "mfa" ? "mfa:" : action === "recovery" ? "recovery:" : "";
  const fingerprint = await sha256(scope + (identity ? `account:${identity.trim().toLowerCase()}` : `ip:${forwarded}`));
  const storedAction = action === "register" ? "register" : "login";
  // MFA kodları ve kurtarma ayrı kovada sayılır: yanlış parola denemeleri doğrulama/kurtarma adımını kilitlemez.
  const limit = action === "login" ? 15 : action === "mfa" ? 20 : action === "recovery" ? 20 : 8;
  const recent = await database.prepare(`SELECT COUNT(*) AS count FROM auth_attempts
    WHERE fingerprint_hash = ? AND action = ? AND created_at > datetime('now', '-15 minutes')`)
    .bind(fingerprint, storedAction).first<{ count: number }>();
  if ((recent?.count ?? 0) >= limit) throw new RateLimitError();
  await database.prepare("INSERT INTO auth_attempts (id, fingerprint_hash, action) VALUES (?, ?, ?)")
    .bind(createId("attempt"), fingerprint, storedAction).run();
  if (Math.random() < 0.02) await database.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')").run();
}

/**
 * Giriş kovaları yalnız BAŞARISIZ denemeleri sayar:
 *  - IP başına 60 başarısız / 15 dk (aynı NAT arkasındaki saha ekibi sabah girişinde kilitlenmesin),
 *  - hesap başına 10 başarısız / 15 dk (IP değiştirerek parola denemesi yapılamasın).
 * Başarılı giriş IP kovasını tüketmez; hesabın başarısız sayacını sıfırlar.
 */
export const LOGIN_IP_FAILURE_LIMIT = 60;
export const LOGIN_ACCOUNT_FAILURE_LIMIT = 10;
async function loginFingerprints(request: Request, username: string) {
  return {
    ip: await sha256(`login-fail:ip:${clientIp(request)}`),
    account: await sha256(`login-fail:account:${username.trim().toLowerCase()}`),
  };
}
export async function checkLoginRateLimit(request: Request, username: string) {
  await ensureSchema();
  const { ip, account } = await loginFingerprints(request, username);
  const count = (fingerprint: string) => getDb().prepare(`SELECT COUNT(*) AS count FROM auth_attempts
    WHERE fingerprint_hash = ? AND action = 'login' AND created_at > datetime('now', '-15 minutes')`).bind(fingerprint).first<{ count: number }>();
  const [byIp, byAccount] = await Promise.all([count(ip), count(account)]);
  if ((byIp?.count ?? 0) >= LOGIN_IP_FAILURE_LIMIT || (byAccount?.count ?? 0) >= LOGIN_ACCOUNT_FAILURE_LIMIT) throw new RateLimitError();
}
export async function recordLoginFailure(request: Request, username: string) {
  const { ip, account } = await loginFingerprints(request, username);
  const database = getDb();
  await database.batch([
    database.prepare("INSERT INTO auth_attempts (id, fingerprint_hash, action) VALUES (?, ?, 'login')").bind(createId("attempt"), ip),
    database.prepare("INSERT INTO auth_attempts (id, fingerprint_hash, action) VALUES (?, ?, 'login')").bind(createId("attempt"), account),
  ]);
  if (Math.random() < 0.02) await database.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')").run();
}
export async function clearLoginFailures(username: string) {
  const account = await sha256(`login-fail:account:${username.trim().toLowerCase()}`);
  await getDb().prepare("DELETE FROM auth_attempts WHERE fingerprint_hash = ? AND action = 'login'").bind(account).run();
}

export async function hashPassword(password: string, salt = randomHex(16)) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100_000, hash: "SHA-256" },
    material,
    256,
  );
  return { hash: toHex(bits), salt };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < hash.length; index += 1) diff |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function getCurrentUser(request: Request): Promise<AppUser | null> {
  await ensureSchema();
  const token = readCookie(request, "teksanor_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const database = getDb();
  const user = await database
    .prepare(`SELECT u.id, u.username, u.email, u.full_name, u.role, u.active, COALESCE(sec.mfa_enabled, 0) AS mfa_enabled,
      CASE WHEN sec.mfa_deferred_until IS NOT NULL AND datetime(sec.mfa_deferred_until) > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS mfa_deferred
      FROM sessions s JOIN users u ON u.id = s.user_id
      LEFT JOIN user_security sec ON sec.user_id = u.id
      WHERE s.token_hash = ? AND datetime(s.expires_at) > CURRENT_TIMESTAMP AND u.active = 1
      AND datetime(s.created_at) > datetime('now', '-12 hours')
      AND datetime(COALESCE((SELECT last_seen_at FROM session_activity WHERE token_hash = s.token_hash),s.created_at)) > datetime('now','-30 minutes')`)
    .bind(tokenHash)
    .first<AppUser>();
  // Arka plan yoklamaları (ör. 60 sn'lik dikkat şeridi) oturumu canlı tutmaz: gözetimsiz açık sekme 30 dk boşta kalınca oturum kapanır.
  // Başlık yalnız etkinliği tazelememeyi seçer; erişim kontrolünü gevşetmez (sahte başlık yalnız kendi oturumunu kısaltır).
  const background = request.headers.get("x-teksanor-background") === "1";
  if (user && !background) await database.prepare(`INSERT INTO session_activity(token_hash,last_seen_at) VALUES(?,CURRENT_TIMESTAMP)
    ON CONFLICT(token_hash) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP WHERE datetime(session_activity.last_seen_at) < datetime('now','-1 minute')`).bind(tokenHash).run();
  return user;
}

export async function createSession(userId: string) {
  const database = getDb();
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  await database
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, expires)
    .run();
  return token;
}

export function sessionCookie(token: string) {
  return `teksanor_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`;
}

export function clearSessionCookie() {
  return "teksanor_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function ensureDefaultAdminAccounts() {
  await ensureSchema();
  const database = getDb();
  const count = await database.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    const secrets = env as unknown as { ADMIN1_PASSWORD?: string; ADMIN2_PASSWORD?: string };
    const admin1Password = secrets.ADMIN1_PASSWORD ?? "";
    const admin2Password = secrets.ADMIN2_PASSWORD ?? "";
    if (admin1Password.length < 10 || admin2Password.length < 10) throw new Error("Portal giriş bilgileri hazır değil.");

    const admin1Id = createId("user");
    const admin2Id = createId("user");
    const admin1Credentials = await hashPassword(admin1Password);
    const admin2Credentials = await hashPassword(admin2Password);
    await database.batch([
      database.prepare("INSERT OR IGNORE INTO users (id, username, email, full_name, password_hash, password_salt, role) VALUES (?, 'admin1', 'admin1@internal.teksanor', 'Portal Kullanıcısı 1', ?, ?, 'admin')")
        .bind(admin1Id, admin1Credentials.hash, admin1Credentials.salt),
      database.prepare("INSERT OR IGNORE INTO users (id, username, email, full_name, password_hash, password_salt, role) VALUES (?, 'admin2', 'admin2@internal.teksanor', 'Portal Kullanıcısı 2', ?, ?, 'admin')")
        .bind(admin2Id, admin2Credentials.hash, admin2Credentials.salt),
    ]);
    await addAudit(admin1Id, "bootstrap_portal_users", "user", admin1Id, "İlk portal hesapları oluşturuldu.", DEFAULT_ORGANIZATION_ID);
  }
  const admins = await database.prepare("SELECT id FROM users WHERE username IN ('admin1', 'admin2')").all<{ id: string }>();
  await database.batch(admins.results.map((admin) => database.prepare(`INSERT OR IGNORE INTO organization_members
    (organization_id, user_id, role) VALUES (?, ?, 'owner')`).bind(DEFAULT_ORGANIZATION_ID, admin.id)));
}

export async function loginWithUsername(input: { username: string; password: string }) {
  await ensureSchema();
  const database = getDb();
  const username = normalizeUsername(input.username);

  const user = await database
    .prepare(`SELECT u.*, COALESCE(sec.mfa_enabled, 0) AS mfa_enabled FROM users u LEFT JOIN user_security sec ON sec.user_id = u.id WHERE u.username = ?`)
    .bind(username)
    .first<AppUser & { password_hash: string; password_salt: string }>();
  if (!user || !user.active) {
    throw new Error("Kullanıcı adı veya parola hatalı.");
  }
  let passwordValid = await verifyPassword(input.password, user.password_salt, user.password_hash);
  // Bootstrap yöneticileri için kontrollü kurtarma: Cloudflare secret değiştirildiğinde
  // yeni değer ilk başarılı girişte D1'e aktarılır ve eski oturumlar kapatılır.
  if (!passwordValid && (username === "admin1" || username === "admin2")) {
    const secrets = env as unknown as { ADMIN1_PASSWORD?: string; ADMIN2_PASSWORD?: string };
    const recoveryPassword = username === "admin1" ? secrets.ADMIN1_PASSWORD : secrets.ADMIN2_PASSWORD;
    const recoveryDigest = recoveryPassword ? await sha256(recoveryPassword) : null;
    const used = await database.prepare("SELECT value FROM app_metadata WHERE key = ?").bind(`bootstrap_recovery_used:${user.id}`).first<{ value: string }>();
    if (recoveryPassword && recoveryDigest !== used?.value && recoveryPassword.length >= 10 && constantTimeTextEqual(input.password, recoveryPassword)) {
      const credentials = await hashPassword(input.password);
      await database.batch([
        database.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
          .bind(credentials.hash, credentials.salt, user.id),
        database.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
        database.prepare("DELETE FROM mfa_challenges WHERE user_id = ?").bind(user.id),
        database.prepare("INSERT INTO app_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(`bootstrap_recovery_used:${user.id}`, recoveryDigest),
      ]);
      await addAudit(user.id, "bootstrap_password_rotated", "user", user.id, "Yönetici parolası runtime secret ile yenilendi; iki aşamalı doğrulama korundu.");
      passwordValid = true;
    }
  }
  if (!passwordValid) throw new Error("Kullanıcı adı veya parola hatalı.");
  await addAudit(user.id, "login_password_ok", "session", null);
  return user;
}

function deviceLabel(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Tarayıcı";
  const os = /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "bilinmeyen sistem";
  return `${browser} / ${os}`;
}

/**
 * Oturum açıldığında denetim kaydı yazar. Cihaz özeti (tarayıcı + sistem + IP özeti) daha önce görülmemişse
 * ayrıca "new_device_login" kaydı düşer. Ham IP veya tam user-agent saklanmaz; yalnız kısa özet.
 */
export async function auditNewLogin(request: Request, userId: string, method: "password" | "mfa" | "recovery_code") {
  try {
    const label = deviceLabel(request.headers.get("user-agent") ?? "");
    const deviceHash = (await sha256(`${label}|${clientIp(request)}`)).slice(0, 16);
    const seen = await getDb().prepare("SELECT 1 FROM audit_logs WHERE user_id = ? AND action IN ('login','new_device_login') AND details LIKE ? AND created_at > datetime('now','-90 days') LIMIT 1")
      .bind(userId, `%cihaz:${deviceHash}%`).first();
    await addAudit(userId, seen ? "login" : "new_device_login", "session", null, `Oturum açıldı (${method === "password" ? "parola" : method === "mfa" ? "parola + doğrulama kodu" : "parola + kurtarma kodu"}); ${label}; cihaz:${deviceHash}`);
  } catch { /* denetim kaydı yazılamasa da giriş engellenmez */ }
}

// Password proof is bound to one opaque session, expires after five minutes,
// and never substitutes for the required TOTP enrollment or challenge.
async function passwordProofTable(){
 await getDb().prepare("CREATE TABLE IF NOT EXISTS session_password_proofs(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
export async function recordSessionPasswordProof(token:string,userId:string){
 await passwordProofTable();
 await getDb().prepare("INSERT INTO session_password_proofs(token_hash,user_id) VALUES(?,?) ON CONFLICT(token_hash) DO UPDATE SET user_id=excluded.user_id,verified_at=CURRENT_TIMESTAMP").bind(await sha256(token),userId).run();
}
/**
 * Hassas işlemler (üye erişimi, rol, parola sıfırlama) için yakın zamanlı parola kanıtı:
 * son 5 dk içinde bu oturumda parola doğrulanmışsa geçer; değilse istekteki parola doğrulanır ve kanıt tazelenir.
 */
export async function confirmRecentPassword(request:Request,userId:string,password?:string|null){
 if(await hasRecentPasswordProof(request,userId))return true;
 if(!password)return false;
 const stored=await getDb().prepare("SELECT password_hash,password_salt FROM users WHERE id=? AND active=1").bind(userId).first<{password_hash:string;password_salt:string}>();
 if(!stored||!await verifyPassword(password,stored.password_salt,stored.password_hash))return false;
 const token=readCookie(request,"teksanor_session");if(token)await recordSessionPasswordProof(token,userId);
 return true;
}
export async function hasRecentPasswordProof(request:Request,userId:string){
 const token=readCookie(request,"teksanor_session");if(!token)return false;
 await passwordProofTable();
 return !!await getDb().prepare("SELECT 1 FROM session_password_proofs WHERE token_hash=? AND user_id=? AND verified_at>datetime('now','-5 minutes')").bind(await sha256(token),userId).first();
}
