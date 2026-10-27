import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {getDb} from "@/lib/db";
import {requireOrganization,canManageOrganization} from "@/lib/tenancy";
import {recordRead} from "@/lib/read-audit";
import {rejectCrossSiteMutation} from "@/lib/security";
import {governanceList,governanceWrite,GovernanceError} from "@/lib/data-governance";
export const dynamic="force-dynamic";
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
async function handle(request:Request,write:boolean){try{
 if(write){const denied=rejectCrossSiteMutation(request);if(denied)return denied;}
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 const {organization}=await requireOrganization(request,user);if(!canManageOrganization(user,organization))return NextResponse.json({error:"Veri yönetimi için firma yöneticisi gerekli."},{status:403});
 const db=getDb();const resources=["agent_chats","customer_interactions","field_visits","employees","customers"];
 if(write){const body=await request.json();if(JSON.stringify(body).length>6000)throw new GovernanceError(413,"İstek çok büyük.");return NextResponse.json(await governanceWrite(db,organization.id,user.id,body,resources));}
 const offset=Math.max(0,Math.min(100000,Number(new URL(request.url).searchParams.get("offset"))||0));
 const data=await governanceList(db,organization.id,offset);await recordRead(user.id,organization.id,"data-governance:list");
 return NextResponse.json({...data,resources},{headers:{"Cache-Control":"private, no-store"}});
}catch(e){return NextResponse.json({error:e instanceof GovernanceError?e.message:"Veri yönetimi işlemi tamamlanamadı."},{status:e instanceof GovernanceError?e.status:403});}}
