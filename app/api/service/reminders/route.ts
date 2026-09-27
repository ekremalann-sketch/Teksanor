import {env} from "cloudflare:workers";
import {NextResponse} from "next/server";
import {getDb,ensureSchema} from "@/lib/db";
import {getMemberAccess} from "@/lib/access";
import {listOrganizations} from "@/lib/tenancy";
import {createDueNotifications} from "@/lib/reminders";
import {runRule} from "@/lib/automation-rules";
import {tokenDigest} from "@/lib/account-tokens";
import type {AppUser} from "@/lib/auth";
export async function POST(request:Request){
 const secret=(env as unknown as {APP_CRON_TOKEN?:string}).APP_CRON_TOKEN;const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(!secret||secret.length<32||await tokenDigest(secret)!==await tokenDigest(token))return NextResponse.json({error:"Yetkisiz."},{status:401});
 await ensureSchema();const db=getDb();const users=await db.prepare("SELECT u.id,u.username,u.email,u.full_name,u.role,u.active,0 AS mfa_enabled FROM users u WHERE u.active=1").all<AppUser>();
 let checked=0;for(const user of users.results){for(const org of await listOrganizations(user)){await createDueNotifications(org.id,user.id,await getMemberAccess(user,org));checked++;}}
 // Etkin "zamanlanmış" otomasyon kuralları: kural başına günde bir kez. Bildirim kuralı oluşturan
 // kişiye gider ve onun güncel modül yetkisiyle hesaplanır; yetkisini kaybetmişse kural atlanır.
 let rulesRun=0;const rules=await db.prepare("SELECT r.id,r.name,r.action_type,r.trigger_config,r.organization_id,r.created_by FROM automation_rules r JOIN organizations o ON o.id=r.organization_id WHERE r.is_active=1 AND r.trigger_type='schedule' AND o.active=1").all<{id:string;name:string;action_type:string;trigger_config:string|null;organization_id:string;created_by:string|null}>();
 for(const rule of rules.results){
  const owner=users.results.find(u=>u.id===rule.created_by);if(!owner)continue;
  const org=(await listOrganizations(owner)).find(o=>o.id===rule.organization_id);if(!org)continue;
  const r=await runRule({organizationId:org.id,rule,userId:owner.id,access:await getMemberAccess(owner,org),source:"schedule"});if(r.status!=="skipped")rulesRun++;
 }
 return NextResponse.json({ok:true,checked,rulesRun});
}
