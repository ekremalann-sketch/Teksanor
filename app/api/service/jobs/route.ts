import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,addAudit} from "@/lib/db";
import {cents,totals,validateTransition,serviceJob} from "@/lib/service";
import {tokenDigest} from "@/lib/account-tokens";
import {rejectCrossSiteMutation} from "@/lib/security";
const txt=(v:unknown,max=1000)=>String(v??"").trim().slice(0,max);
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}
async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 try{
  const {organization}=await requireOrganization(request,user);const access=await getMemberAccess(user,organization);const db=getDb();
  const manage=["owner","company_admin","ceo","manager"].includes(access.profile);const canWrite=access.editModules.includes("work-orders");
  if(request.method==="GET"){
   const jobs=await db.prepare(`SELECT w.title,w.description,w.customer_name,w.location,w.scheduled_date,w.order_number,w.assigned_to,s.*,a.asset_code,a.name AS asset_name
    FROM service_jobs s JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id
    LEFT JOIN assets a ON a.id=s.asset_id AND a.organization_id=s.organization_id
    WHERE s.organization_id=? AND (?=1 OR s.assigned_user_id=?) ORDER BY s.updated_at DESC LIMIT 200`).bind(organization.id,manage?1:0,user.id).all<Record<string,unknown>>();
   for(const j of jobs.results){if(manage)Object.assign(j,totals(j as never));else for(const key of ["labor_cents","parts_cents","travel_cents","paid_cents"])delete j[key];}
   const assets=access.viewModules.includes("assets")?await db.prepare("SELECT id,name,asset_code FROM assets WHERE organization_id=? ORDER BY name LIMIT 500").bind(organization.id).all():{results:[]};
   const members=manage?await db.prepare("SELECT u.id,u.full_name FROM users u JOIN organization_members m ON m.user_id=u.id WHERE m.organization_id=? AND m.active=1 AND u.active=1").bind(organization.id).all():{results:[]};
   return NextResponse.json({jobs:jobs.results,assets:assets.results,members:members.results,manage,canWrite,userId:user.id,organization:{id:organization.id,name:organization.name}});
  }
  const b=await request.json() as Record<string,unknown>;
  if(b.action==="create"){
   if(!manage)return NextResponse.json({error:"Yeni servis açmak için yönetici yetkisi gerekir."},{status:403});
   const title=txt(b.title,240);if(!title)throw new Error("İş başlığı gerekli.");
   const asset=txt(b.assetId,100)||null;const assigned=txt(b.assignedUserId,100)||user.id;
   if(asset&&!await db.prepare("SELECT id FROM assets WHERE id=? AND organization_id=?").bind(asset,organization.id).first())throw new Error("Ekipman bu firmaya ait değil.");
   if(assigned!==user.id&&!await db.prepare("SELECT user_id FROM organization_members WHERE user_id=? AND organization_id=? AND active=1").bind(assigned,organization.id).first())throw new Error("Çalışan bu firmaya ait değil.");
   const date=txt(b.scheduledDate,10)||null;if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Geçerli tarih girin.");
   const id=createId("wo");const number=`SRV-${crypto.randomUUID().slice(0,12).toUpperCase()}`;
   await db.batch([
    db.prepare(`INSERT INTO work_orders(id,organization_id,order_number,title,description,customer_name,location,scheduled_date,created_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,organization.id,number,title,txt(b.description),txt(b.customerName,240),txt(b.location,400),date,user.id),
    db.prepare("INSERT INTO service_jobs(id,organization_id,asset_id,assigned_user_id) VALUES(?,?,?,?)").bind(id,organization.id,asset,assigned),
   ]);await addAudit(user.id,"create","service_job",id,"Servis talebi oluşturuldu.",organization.id);return NextResponse.json({ok:true,id},{status:201});
  }
  const id=txt(b.id,100);const job=await serviceJob(id,organization.id);
  if(!job||(!manage&&job.assigned_user_id!==user.id))return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
  if(Number(b.version)!==Number(job.version))return NextResponse.json({error:"Kayıt başka bir işlemle güncellendi. Yenileyin."},{status:409});
  if(b.action==="share"){
   if(!manage)return NextResponse.json({error:"Müşteri onayını yönetici başlatabilir."},{status:403});
   const purpose=b.purpose==="completion"?"completion":"quote";
   if(job.stage!==(purpose==="quote"?"quoted":"completed"))throw new Error("Önce teklif veya tamamlanan iş durumunu kaydedin.");
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
   await db.batch([
    db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL").bind(id,organization.id),
    db.prepare(`INSERT INTO service_approvals(id,organization_id,job_id,token_hash,purpose,job_version,expires_at,created_by) VALUES(?,?,?,?,?,?,datetime('now','+7 days'),?)`).bind(createId("approval"),organization.id,id,await tokenDigest(token),purpose,job.version,user.id),
   ]);return NextResponse.json({ok:true,path:`/servis/onay#token=${token}`},{headers:{"Cache-Control":"no-store"}});
  }
  if(b.action!=="update")throw new Error("Geçersiz işlem.");
  const stage=txt(b.stage,30)||String(job.stage);validateTransition(String(job.stage),stage);
  if(!manage&&(!["quote_approved","in_progress"].includes(String(job.stage))||!["in_progress","completed"].includes(stage)))throw new Error("Saha kaydı için onaylı veya devam eden iş seçin.");
  const outcome=b.outcome===undefined?String(job.outcome):txt(b.outcome,6000);
  if(stage==="completed"&&!outcome)throw new Error("Yapılan işlemi yazın.");
  const moneyFields=["quote","labor","parts","travel","paid"] as const;
  const values=moneyFields.map(k=>manage&&b[k]!==undefined?cents(b[k]):Number(job[`${k}_cents`]));
  if(b.quote!==undefined&&values[0]!==Number(job.quote_cents)&&!["requested","quoted"].includes(String(job.stage)))throw new Error("Onaylanmış teklif tutarı değiştirilemez.");
  if(values[4]>values[0])throw new Error("Tahsilat teklif tutarını aşamaz.");
  if(stage==="collected"&&values[4]<values[0])throw new Error("Tahsilat tamamlanmadı.");
  if(["accepted","collected"].includes(String(job.stage))&&outcome!==String(job.outcome))throw new Error("Müşterinin onayladığı rapor değiştirilemez.");
  const updated=await db.prepare(`UPDATE service_jobs SET stage=?,outcome=?,quote_cents=?,labor_cents=?,parts_cents=?,travel_cents=?,paid_cents=?,version=version+1,updated_at=CURRENT_TIMESTAMP
   WHERE id=? AND organization_id=? AND version=? RETURNING version`).bind(stage,outcome,...values,id,organization.id,job.version).first();
  if(!updated)return NextResponse.json({error:"Kayıt değişti. Yenileyin."},{status:409});
  await db.batch([
   db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND approved_at IS NULL").bind(id),
   db.prepare("UPDATE work_orders SET status=?,notes=?,completed_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?").bind(["completed","accepted","collected"].includes(stage)?"completed":stage==="cancelled"?"cancelled":stage==="in_progress"?"in_progress":"open",outcome,["completed","accepted","collected"].includes(stage)?new Date().toISOString().slice(0,10):null,id,organization.id),
  ]);
  await addAudit(user.id,"update","service_job",id,`Servis durumu: ${stage}`,organization.id);return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Servis işlemi tamamlanamadı."},{status:400});}
}
