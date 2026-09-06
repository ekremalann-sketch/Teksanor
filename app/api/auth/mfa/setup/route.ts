import { NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, enforceAuthRateLimit, createSession, sessionCookie } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { createOtpAuthUri, createTotpSecret, encryptTotpSecret, decryptTotpSecret, verifyTotp } from "@/lib/mfa";
import { rejectCrossSiteMutation } from "@/lib/security";
export async function GET(request: Request) {
  const user=await getCurrentUser(request);
  return user?NextResponse.json({enabled:!!user.mfa_enabled}):NextResponse.json({error:"Oturum gerekli."},{status:401});
}
export async function POST(request: Request) {
  const rejected=rejectCrossSiteMutation(request);if(rejected)return rejected;
  const user=await getCurrentUser(request);
  if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
  try {
    await enforceAuthRateLimit(request,"login",`mfa-setup:${user.id}`);
    const body=await request.json() as {action?:string;password?:string;code?:string};
    if(user.mfa_enabled)return NextResponse.json({error:"İki aşamalı doğrulama zaten etkin."},{status:409});
    const db=getDb();
    if(body.action==="start"){
      const stored=await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first<{password_hash:string;password_salt:string}>();
      if(!stored||!body.password||!await verifyPassword(body.password,stored.password_salt,stored.password_hash))return NextResponse.json({error:"Mevcut parolanızı doğrulayın."},{status:403});
      const secret=createTotpSecret();const encrypted=await encryptTotpSecret(secret);
      await db.prepare(`INSERT INTO user_security(user_id,mfa_setup_secret,mfa_setup_expires_at) VALUES (?,?,datetime('now','+10 minutes'))
        ON CONFLICT(user_id) DO UPDATE SET mfa_setup_secret=excluded.mfa_setup_secret,mfa_setup_expires_at=excluded.mfa_setup_expires_at`).bind(user.id,encrypted).run();
      return NextResponse.json({secret,otpAuthUri:createOtpAuthUri(secret,user.username)},{headers:{"Cache-Control":"no-store"}});
    }
    const security=await db.prepare("SELECT mfa_setup_secret FROM user_security WHERE user_id=? AND mfa_enabled=0 AND mfa_setup_expires_at>CURRENT_TIMESTAMP").bind(user.id).first<{mfa_setup_secret:string}>();
    if(!security||!body.code||!await verifyTotp(await decryptTotpSecret(security.mfa_setup_secret),body.code))return NextResponse.json({error:"Kod geçersiz veya kurulum süresi doldu."},{status:400});
    await db.batch([
      db.prepare("UPDATE user_security SET totp_secret=mfa_setup_secret,mfa_setup_secret=NULL,mfa_enabled=1,mfa_setup_expires_at=NULL WHERE user_id=?").bind(user.id),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
    ]);
    const token=await createSession(user.id);
    await addAudit(user.id,"enable_mfa","user_security",user.id);
    return NextResponse.json({ok:true},{headers:{"Set-Cookie":sessionCookie(token)}});
  }catch{return NextResponse.json({error:"Kurulum tamamlanamadı. MFA yapılandırmasını ve deneme sınırını kontrol edin."},{status:503});}
}
