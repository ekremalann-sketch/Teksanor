// Oturum ve kullanıcı yönetimi (çerez tabanlı, D1 destekli).
import { getDb, ensureSchema, createId } from "@/lib/db";

export const SESSION_COOKIE = "teksanor_session";
const SESSION_TTL_DAYS = 7;

export type CurrentUser = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  mfa_enabled: number;
};

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  await ensureSchema();
  const cookies = parseCookies(request);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;
  const db = getDb();
  const session = await db.prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .bind(sessionId).first<{ user_id: string; expires_at: string }>();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return null;
  }
  const user = await db.prepare("SELECT id, full_name, email, status, mfa_enabled FROM users WHERE id = ?")
    .bind(session.user_id).first<CurrentUser>();
  if (!user || user.status !== "active") return null;
  return user;
}

export async function createSession(userId: string, request?: Request): Promise<string> {
  await ensureSchema();
  const id = createId("sess");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await getDb().prepare(
    "INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)",
  ).bind(
    id, userId, expires,
    request?.headers.get("cf-connecting-ip") || null,
    request?.headers.get("user-agent")?.slice(0, 200) || null,
  ).run();
  return id;
}

export async function destroySession(sessionId: string): Promise<void> {
  await getDb().prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function sessionCookie(sessionId: string): string {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
