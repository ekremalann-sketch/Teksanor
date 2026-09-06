import {env} from "cloudflare:workers";
import {NextResponse} from "next/server";
import {getDb} from "@/lib/db";
declare const __TEKSANOR_COMMIT__:string;
export async function GET(){
 try{
  const db=getDb();await db.prepare("SELECT 1 AS ok").first();
  const required=["users","sessions","organization_member_access","work_orders","service_jobs","service_approvals","agent_chats"];
  for(const name of required)if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first())throw new Error("schema");
  const bucket=(env as unknown as {UPLOADS?:{head:(key:string)=>Promise<unknown>}}).UPLOADS;
  if(!bucket)throw new Error("storage");await bucket.head("__teksanor_health_probe__");
  return NextResponse.json({ok:true,version:__TEKSANOR_COMMIT__,checkedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,message:"Servis bağımlılıkları hazır değil."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
