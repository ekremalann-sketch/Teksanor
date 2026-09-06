import { env } from "cloudflare:workers";
import { getDb } from "./db";
export async function tokenDigest(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,"0")).join("");}
export async function ensureAccountTokens(){await getDb().prepare(`CREATE TABLE IF NOT EXISTS account_tokens(
 token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL,email TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT
)`).run();}
export async function sendAccountLink(user:{id:string;email:string},purpose:"reset"|"verify") {
  const config=env as unknown as {RESEND_API_KEY?:string;MAIL_FROM?:string;APP_ORIGIN?:string};
  if(!config.RESEND_API_KEY||!config.MAIL_FROM||!config.APP_ORIGIN)throw new Error("E-posta hizmeti yapılandırılmadı.");
  const origin=new URL(config.APP_ORIGIN);if(origin.protocol!=="https:")throw new Error("Güvenli uygulama adresi gerekli.");
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
  await ensureAccountTokens();
  const hash=await tokenDigest(token);
  await getDb().prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES(?,?,?,?,datetime('now','+20 minutes'))").bind(hash,user.id,purpose,user.email).run();
  const url=new URL("/hesap-kurtarma",origin);url.hash=new URLSearchParams({token,mode:purpose}).toString();
  const result=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${config.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:config.MAIL_FROM,to:[user.email],subject:purpose==="reset"?"Teksanor parola yenileme":"Teksanor e-posta doğrulama",text:`İşleminizi tamamlamak için 20 dakika içinde bu bağlantıyı açın: ${url}\nBu işlemi siz istemediyseniz bağlantıyı kullanmayın.`})});
  if(!result.ok){await getDb().prepare("DELETE FROM account_tokens WHERE token_hash=?").bind(hash).run();throw new Error("E-posta gönderilemedi.");}
}
