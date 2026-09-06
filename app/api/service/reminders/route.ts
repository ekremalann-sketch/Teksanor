import {env} from "cloudflare:workers";
import {NextResponse} from "next/server";
import {getDb,ensureSchema} from "@/lib/db";
import {getMemberAccess} from "@/lib/access";
import {listOrganizations} from "@/lib/tenancy";
import {createDueNotifications} from "@/lib/reminders";
import {tokenDigest} from "@/lib/account-tokens";
import type {AppUser} from "@/lib/auth";
export async function POST(request:Request){
 const secret=(env as unknown as {APP_CRON_TOKEN?:string}).APP_CRON_TOKEN;const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(!secret||secret.length<32||await tokenDigest(secret)!==await tokenDigest(token))return NextResponse.json({error:"Yetkisiz."},{status:401});
 await ensureSchema();const db=getDb();const users=await db.prepare("SELECT u.id,u.username,u.email,u.full_name,u.role,u.active,0 AS mfa_enabled FROM users u WHERE u.active=1").all<AppUser>();
 let checked=0;for(const user of users.results){for(const org of await listOrganizations(user)){await createDueNotifications(org.id,user.id,await getMemberAccess(user,org));checked++;}}
 return NextResponse.json({ok:true,checked});
}
