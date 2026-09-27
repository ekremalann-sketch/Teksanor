import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,addAudit} from "@/lib/db";
import {ensureServiceColumns,serviceJob} from "@/lib/service";
import {rejectCrossSiteMutation} from "@/lib/security";
import {ChecklistError,missingRequired,parseAnswers,parseTemplateItems,STARTER_TEMPLATES,type ChecklistItem} from "@/lib/checklist";

// Saha kontrol listeleri:
// - Şablonu yönetici oluşturur/arşivler (yoksa sektörde yaygın başlangıç şablonları önerilir).
// - Şablonu işe yönetici veya işe atanmış çalışan ekler; maddeler o an kopyalanır.
// - Cevapları atanmış çalışan veya yönetici kaydeder (sürüm kontrollü).
// - Müşteri işi onayladıktan sonra form değiştirilemez.
const LOCKED=["accepted","collected","cancelled"];
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});

export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}

async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return json({error:"Oturum gerekli."},401);
 let organization;
 try{({organization}=await requireOrganization(request,user));}catch(e){return json({error:e instanceof Error?e.message:"Erişim reddedildi."},403);}
 try{
  await ensureServiceColumns();
  const db=getDb();const access=await getMemberAccess(user,organization);
  const manage=["owner","company_admin","ceo","manager"].includes(access.profile);
  const canWrite=access.editModules.includes("work-orders");
  const templates=async()=>(await db.prepare("SELECT id,name,items,created_at FROM service_checklist_templates WHERE organization_id=? AND active=1 ORDER BY name").bind(organization.id).all<{id:string;name:string;items:string}>()).results.map(t=>({...t,items:JSON.parse(t.items) as ChecklistItem[]}));
  const jobLists=async(jobId:string)=>(await db.prepare("SELECT id,template_id,name,items,answers,version,completed_at,updated_at FROM service_job_checklists WHERE job_id=? AND organization_id=? ORDER BY name").bind(jobId,organization.id).all<Record<string,string|number|null>>()).results.map(c=>{const items=JSON.parse(String(c.items)) as ChecklistItem[];const answers=JSON.parse(String(c.answers));return {...c,items,answers,missing:missingRequired(items,answers)};});
  // İşe erişim: yönetici her işi, çalışan yalnız kendisine atanan işi görür (servis masasıyla aynı kural).
  const jobFor=async(id:string)=>{const job=await serviceJob(id,organization.id);if(!job||(!manage&&job.assigned_user_id!==user.id))return null;return job;};

  if(request.method==="GET"){
   const jobId=new URL(request.url).searchParams.get("jobId");
   if(jobId){const job=await jobFor(jobId);if(!job)return json({error:"Servis kaydı bulunamadı."},404);return json({templates:await templates(),checklists:await jobLists(jobId),locked:LOCKED.includes(String(job.stage)),manage,canWrite});}
   return json({templates:await templates(),starters:manage?STARTER_TEMPLATES:[],manage,canWrite});
  }

  const b=await request.json() as Record<string,unknown>;
  if(b.action==="template.create"){
   if(!manage)return json({error:"Form şablonunu yönetici oluşturur."},403);
   const name=String(b.name??"").trim().slice(0,120);if(name.length<2)throw new ChecklistError("Şablon adı yazın.");
   const items=parseTemplateItems(b.items);const id=createId("chk");
   await db.prepare("INSERT INTO service_checklist_templates(id,organization_id,name,items,created_by) VALUES(?,?,?,?,?)").bind(id,organization.id,name,JSON.stringify(items),user.id).run();
   await addAudit(user.id,"create","checklist_template",id,`Form şablonu: ${name} (${items.length} madde)`,organization.id);
   return json({ok:true,id,templates:await templates()},201);
  }
  if(b.action==="template.archive"){
   if(!manage)return json({error:"Form şablonunu yönetici arşivler."},403);
   const r=await db.prepare("UPDATE service_checklist_templates SET active=0 WHERE id=? AND organization_id=? AND active=1").bind(String(b.id??""),organization.id).run();
   if(!r.meta?.changes)return json({error:"Şablon bulunamadı."},404);
   await addAudit(user.id,"archive","checklist_template",String(b.id),"Form şablonu arşivlendi.",organization.id);
   return json({ok:true,templates:await templates()});
  }

  const jobId=String(b.jobId??"");const job=await jobFor(jobId);
  if(!job)return json({error:"Servis kaydı bulunamadı."},404);
  if(!canWrite&&!manage)return json({error:"Bu işte form doldurma yetkiniz yok."},403);
  if(LOCKED.includes(String(job.stage)))return json({error:"Müşteri onayından sonra form değiştirilemez."},409);

  if(b.action==="attach"){
   const t=await db.prepare("SELECT id,name,items FROM service_checklist_templates WHERE id=? AND organization_id=? AND active=1").bind(String(b.templateId??""),organization.id).first<{id:string;name:string;items:string}>();
   if(!t)return json({error:"Şablon bulunamadı."},404);
   // Aynı şablon aynı işe iki kez eklenmez (benzersiz kısıt); çift tıklama tek form bırakır.
   await db.prepare("INSERT OR IGNORE INTO service_job_checklists(id,organization_id,job_id,template_id,name,items,updated_by) VALUES(?,?,?,?,?,?,?)").bind(createId("jchk"),organization.id,jobId,t.id,t.name,t.items,user.id).run();
   return json({ok:true,checklists:await jobLists(jobId)},201);
  }
  if(b.action==="answer"){
   const row=await db.prepare("SELECT id,items,version FROM service_job_checklists WHERE id=? AND job_id=? AND organization_id=?").bind(String(b.id??""),jobId,organization.id).first<{id:string;items:string;version:number}>();
   if(!row)return json({error:"Form bulunamadı."},404);
   const items=JSON.parse(row.items) as ChecklistItem[];const answers=parseAnswers(items,b.answers);
   const done=missingRequired(items,answers).length===0;
   const updated=await db.prepare(`UPDATE service_job_checklists SET answers=?,version=version+1,completed_at=CASE WHEN ? THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_by=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM service_jobs s WHERE s.id=? AND s.stage NOT IN ('accepted','collected','cancelled')) RETURNING version`).bind(JSON.stringify(answers),done?1:0,user.id,row.id,Number(b.version),jobId).first();
   if(!updated)return json({error:"Form başka bir işlemle güncellendi veya iş kilitlendi. Yenileyin."},409);
   await addAudit(user.id,"update","job_checklist",row.id,done?"Kontrol listesi tamamlandı.":"Kontrol listesi kaydedildi.",organization.id);
   return json({ok:true,checklists:await jobLists(jobId)});
  }
  return json({error:"Geçersiz işlem."},400);
 }catch(e){return json({error:e instanceof Error?e.message:"Form işlemi tamamlanamadı."},e instanceof ChecklistError||e instanceof SyntaxError?400:500);}
}
