import { env } from "cloudflare:workers";
import { getDb, createId } from "./db";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const encoder = new TextEncoder();

function randomBytes(size = 20) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base32Encode(bytes: Uint8Array) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return new Uint8Array(bytes);
}

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const encoded = (env as unknown as { MFA_ENCRYPTION_KEY?: string }).MFA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MFA şifreleme anahtarı yapılandırılmadı.");
  const raw = fromBase64Url(encoded);
  if (raw.length !== 32) throw new Error("MFA şifreleme anahtarı geçersiz.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(secret)));
  return `v1.${base64Url(iv)}.${base64Url(ciphertext)}`;
}

export async function decryptTotpSecret(value: string) {
  if (!value.startsWith("v1.")) throw new Error("MFA anahtarı güvenli biçimde saklanmamış.");
  const [, iv, ciphertext] = value.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await encryptionKey(), fromBase64Url(ciphertext));
  return new TextDecoder().decode(plain);
}

async function totpAt(secret: string, counter: number) {
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(4, counter, false);
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = result[result.length - 1] & 0x0f;
  const number = ((result[offset] & 0x7f) << 24)
    | ((result[offset + 1] & 0xff) << 16)
    | ((result[offset + 2] & 0xff) << 8)
    | (result[offset + 3] & 0xff);
  return String(number % 1_000_000).padStart(6, "0");
}

export function createTotpSecret() {
  return base32Encode(randomBytes());
}

export function createOtpAuthUri(secret: string, username: string) {
  const label = encodeURIComponent(`Teksanor:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Teksanor&algorithm=SHA1&digits=6&period=30`;
}

export async function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 30_000);
  for (const drift of [-1, 0, 1]) {
    if (await totpAt(secret, counter + drift) === normalized) return true;
  }
  return false;
}

export async function beginMfaChallenge(userId: string) {
  const token = base32Encode(randomBytes(32));
  const tokenHash = await digest(token);
  await getDb().prepare(`INSERT INTO mfa_challenges (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, datetime('now', '+5 minutes'))`)
    .bind(createId("mfa"), userId, tokenHash).run();
  return token;
}

export async function consumeMfaChallenge(token: string, code: string) {
  const tokenHash = await digest(token);
  const db = getDb();
  const challenge = await db.prepare(`UPDATE mfa_challenges SET attempts=attempts+1
    WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP AND attempts<5 RETURNING id,user_id`)
    .bind(tokenHash).first<{id:string;user_id:string}>();
  if (!challenge) return null;
  const security=await db.prepare(`SELECT s.totp_secret,s.last_totp_counter FROM user_security s JOIN users u ON u.id=s.user_id
    WHERE s.user_id=? AND s.mfa_enabled=1 AND u.active=1`).bind(challenge.user_id).first<{totp_secret:string;last_totp_counter:number}>();
  if(!security || !/^\d{6}$/.test(code)) return null;
  const secret=await decryptTotpSecret(security.totp_secret);
  const counter=Math.floor(Date.now()/30000);
  let match=-1;
  for(const drift of [-1,0,1]) if(counter+drift>security.last_totp_counter && await totpAt(secret,counter+drift)===code) match=counter+drift;
  if(match<0)return null;
  const accepted=await db.prepare("UPDATE user_security SET last_totp_counter=? WHERE user_id=? AND last_totp_counter<? RETURNING user_id")
    .bind(match,challenge.user_id,match).first();
  if(!accepted)return null;
  const consumed=await db.prepare("UPDATE mfa_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL RETURNING user_id").bind(challenge.id).first<{user_id:string}>();
  return consumed?.user_id ?? null;
}
