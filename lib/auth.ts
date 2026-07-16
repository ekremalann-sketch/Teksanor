import { env } from "cloudflare:workers";
import { getDb, ensureSchema, createId, addAudit, DEFAULT_ORGANIZATION_ID } from "./db";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  active: number;
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

export async function enforceAuthRateLimit(request: Request, action: "login" | "register") {
  await ensureSchema();
  const database = getDb();
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const agent = request.headers.get("user-agent") || "unknown";
  const fingerprint = await sha256(`${forwarded.trim()}|${agent.slice(0, 180)}`);
  const limit = action === "login" ? 15 : 8;
  const recent = await database.prepare(`SELECT COUNT(*) AS count FROM auth_attempts
    WHERE fingerprint_hash = ? AND action = ? AND created_at > datetime('now', '-15 minutes')`)
    .bind(fingerprint, action).first<{ count: number }>();
  if ((recent?.count ?? 0) >= limit) throw new Error("Çok fazla deneme yapıldı. Güvenliğiniz için 15 dakika sonra tekrar deneyin.");
  await database.prepare("INSERT INTO auth_attempts (id, fingerprint_hash, action) VALUES (?, ?, ?)")
    .bind(createId("attempt"), fingerprint, action).run();
  if (Math.random() < 0.02) await database.prepare("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')").run();
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
  return database
    .prepare(`SELECT u.id, u.username, u.email, u.full_name, u.role, u.active
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.active = 1`)
    .bind(tokenHash)
    .first<AppUser>();
}

export async function createSession(userId: string) {
  const database = getDb();
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  await database
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, expires)
    .run();
  return token;
}

export function sessionCookie(token: string) {
  return `teksanor_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`;
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
    if (admin1Password.length !== 6 || admin2Password.length !== 6) throw new Error("Portal giriş bilgileri hazır değil.");

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
    .prepare("SELECT id, username, email, full_name, role, active, password_hash, password_salt FROM users WHERE username = ?")
    .bind(username)
    .first<AppUser & { password_hash: string; password_salt: string }>();
  if (!user || !user.active || !(await verifyPassword(input.password, user.password_salt, user.password_hash))) {
    throw new Error("Kullanıcı adı veya parola hatalı.");
  }
  await addAudit(user.id, "login", "session", null);
  return user;
}
