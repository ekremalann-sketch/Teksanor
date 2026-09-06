import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentUser,enforceAuthRateLimit,hashPassword,verifyPassword } from "@/lib/auth";
import { getDb,ensureSchema,addAudit } from "@/lib/db";
import { ensureAccountTokens,sendAccountLink,tokenDigest } from "@/lib/account-tokens";
import { rejectCrossSiteMutation } from "@/lib/security";
export async function POST(request:Request){
 const rejected=rejectCrossSiteMutation(request);if(rejected)return rejected;
 try{
  await ensureSchema();await ensureAccountTokens();await enforceAuthRateLimit(request,"login");
  const b=await request.json() as Record<string,string>;const db=getDb();
  if(b.action==="request"){
   const config=env as unknown as {RESEND_API_KEY?:string;MAIL_FROM?:string;APP_ORIGIN?:string};
   if(!config.RESEND_API_KEY||!config.MAIL_FROM||!config.APP_ORIGIN)return NextResponse.json({error:"E-posta hizmeti henüz etkinleştirilmedi. Firma yöneticisine başvurun."},{status:503});
   const email=String(b.email||"").trim().toLowerCase();
   await enforceAuthRateLimit(request,"login",`recovery:${email}`);
   const user=await db.prepare(`SELECT u.id,u.email FROM users u JOIN user_security s ON s.user_id=u.id WHERE lower(u.email)=? AND u.active=1 AND s.email_verified_at IS NOT NULL`).bind(email).first<{id:string;email:string}>();
   if(user) await sendAccountLink(user,"reset");
   return NextResponse.json({ok:true,message:"Doğrulanmış bir hesap varsa yenileme bağlantısı gönderildi."});
  }
  if(b.action==="verify-request"){
   const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Önce giriş yapın."},{status:401});
   const stored=await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first<{password_hash:string;password_salt:string}>();
   if(!stored||!b.password||!await verifyPassword(b.password,stored.password_salt,stored.password_hash))return NextResponse.json({error:"Mevcut parolanızı doğrulayın."},{status:403});
   const email=String(b.email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return NextResponse.json({error:"Geçerli e-posta adresi girin."},{status:400});
   // Email is changed only after the new mailbox proves possession.
   await sendAccountLink({id:user.id,email},"verify");return NextResponse.json({ok:true,message:"Doğrulama bağlantısı gönderildi."});
  }
  if(!/^[a-f0-9]{64}$/.test(b.token||""))return NextResponse.json({error:"Bağlantı geçersiz."},{status:400});
  const purpose=b.action==="verify"?"verify":"reset";
  if(purpose==="reset"&&(!b.password||b.password.length<10||b.password.length>128))return NextResponse.json({error:"Parola 10–128 karakter olmalı."},{status:400});
  const hash=await tokenDigest(b.token);
  const token=await db.prepare(`SELECT t.user_id,t.email FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP AND u.active=1`).bind(hash,purpose).first<{user_id:string;email:string}>();
  if(!token)return NextResponse.json({error:"Bağlantı kullanılmış veya süresi dolmuş."},{status:400});
  if(purpose==="verify"){
   const current=await getCurrentUser(request);
   if(!current||current.id!==token.user_id)return NextResponse.json({error:"Bağlantının ait olduğu hesaba giriş yapın."},{status:403});
  }
  const credentials=purpose==="reset"?await hashPassword(b.password):null;
  const consumed=await db.prepare("UPDATE account_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING user_id").bind(hash).first();
  if(!consumed)return NextResponse.json({error:"Bağlantı artık geçerli değil."},{status:409});
  if(credentials)await db.batch([
   db.prepare("UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND email=?").bind(credentials.hash,credentials.salt,token.user_id,token.email),
   db.prepare("DELETE FROM sessions WHERE user_id=?").bind(token.user_id),
   db.prepare("DELETE FROM mfa_challenges WHERE user_id=?").bind(token.user_id),
   db.prepare("DELETE FROM account_tokens WHERE user_id=? AND purpose='reset'").bind(token.user_id),
  ]);
  else await db.batch([
   db.prepare("UPDATE users SET email=? WHERE id=?").bind(token.email,token.user_id),
   db.prepare("INSERT INTO user_security(user_id,email_verified_at) VALUES(?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET email_verified_at=CURRENT_TIMESTAMP").bind(token.user_id),
   db.prepare("DELETE FROM account_tokens WHERE user_id=?").bind(token.user_id),
  ]);
  await addAudit(token.user_id,purpose==="reset"?"password_reset":"email_verified","user",token.user_id);
  return NextResponse.json({ok:true,message:purpose==="reset"?"Parolanız yenilendi. İki aşamalı doğrulama açıksa girişte yine istenir.":"E-posta adresiniz doğrulandı."});
 }catch{return NextResponse.json({error:"İşlem tamamlanamadı. Bağlantıyı ve e-posta yapılandırmasını kontrol edin; çok sayıda denemede 15 dakika bekleyin."},{status:400});}
}
