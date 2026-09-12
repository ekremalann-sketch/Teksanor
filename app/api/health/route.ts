import {env} from "cloudflare:workers";
import {NextResponse} from "next/server";
import {ensureSchema,getDb} from "@/lib/db";

declare const __TEKSANOR_COMMIT__:string;

type Dependency="database"|"schema"|"storage";

export async function GET(){
 let dependency:Dependency="database";
 try{
  const db=getDb();
  await db.prepare("SELECT 1 AS ok").first();

  dependency="schema";
  await ensureSchema();
  const required=["users","sessions","organization_member_access","work_orders","service_jobs","service_approvals","agent_chats"];
  for(const name of required){
   if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first()){
    throw new Error(`Eksik tablo: ${name}`);
   }
  }

  dependency="storage";
  const bucket=(env as unknown as {UPLOADS?:{head:(key:string)=>Promise<unknown>}}).UPLOADS;
  if(bucket)await bucket.head("__teksanor_health_probe__");

  return NextResponse.json(
   {ok:true,version:__TEKSANOR_COMMIT__,checkedAt:new Date().toISOString(),capabilities:{storage:bucket?"available":"disabled"},warnings:bucket?[]:["Dosya yükleme kapalı: UPLOADS bağlantısı yapılandırılmadı."]},
   {headers:{"Cache-Control":"no-store"}},
  );
 }catch(error){
  console.error("Teksanor health check failed",{
   dependency,
   message:error instanceof Error?error.message:"Bilinmeyen hata",
  });
  return NextResponse.json(
   {ok:false,version:__TEKSANOR_COMMIT__,checkedAt:new Date().toISOString(),code:"DEPENDENCY_NOT_READY",dependency,message:"Servis bağımlılıkları hazır değil."},
   {status:503,headers:{"Cache-Control":"no-store"}},
  );
 }
}
