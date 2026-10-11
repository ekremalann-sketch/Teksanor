import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {listOrganizations} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {homeFor} from "@/lib/role-navigation";
import {getDb} from "@/lib/db";
import {mfaEnrollmentEnforced,mfaMode} from "@/lib/mfa";
export async function GET(request:Request){
 const user=await getCurrentUser(request);
 if(!user)return NextResponse.json({authenticated:false},{headers:{"Cache-Control":"private, no-store"}});
 const manager=user.role==="admin"||!!await getDb().prepare("SELECT 1 FROM organization_members WHERE user_id=? AND active=1 AND role IN ('owner','admin') LIMIT 1").bind(user.id).first();
 const requested=new URL(request.url).searchParams.get("organizationId");const organizations=await listOrganizations(user);
 // Saklı firma artık erişilebilir değilse ilk üyeliğe düşülür; istemci gerçek firma kimliğini saklar.
 const org=organizations.find(o=>o.id===requested)||organizations[0];const homePath=org?homeFor(await getMemberAccess(user,org)):"/panel";
 return NextResponse.json({authenticated:true,homePath,organizationId:org?.id??null,mfaMode:mfaMode(),mfaEnrollmentRequired:mfaEnrollmentEnforced(user,manager)},{headers:{"Cache-Control":"private, no-store"}});
}
