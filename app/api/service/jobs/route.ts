import {recordRead} from "@/lib/read-audit";
class RequiredChecklistError extends Error {}
import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,auditStatement} from "@/lib/db";
import {cents,totals,validateTransition,serviceJob,ensureServiceColumns,ServiceRuleError} from "@/lib/service";
import {canTransition,missingRequired,TECHNICAL_SERVICE_FLOW} from "@/lib/flow-definition";
import {tokenDigest} from "@/lib/account-tokens";
import {rejectCrossSiteMutation} from "@/lib/security";
import {isSafeSignaturePath} from "@/lib/signature";
import {quoteLines,quoteSnapshot} from "@/lib/service-quotes";
const txt=(v:unknown,max=1000)=>String(v??"").trim().slice(0,max);
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}
async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 let organization;
 // Yetki reddi 400 değil 403 döner; istemci hatayı doğru yorumlar.
 try{({organization}=await requireOrganization(request,user));}catch(e){return NextResponse.json({error:"Erişim reddedildi."},{status:403});}
 try{
  await ensureServiceColumns();const access=await getMemberAccess(user,organization);const db=getDb();
  const manage=["owner","company_admin","ceo","manager"].includes(access.profile);const canWrite=access.editModules.includes("work-orders");
  if(request.method==="GET"){
   const quoteJob=txt(new URL(request.url).searchParams.get("quoteHistory"),100);
   if(quoteJob){
    if(!manage)return NextResponse.json({error:"Teklif geçmişi için yönetici yetkisi gerekir."},{status:403});
    if(!await serviceJob(quoteJob,organization.id))return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
    const history=await db.prepare("SELECT revision,lines,total_cents,reason,created_at FROM service_quote_versions WHERE organization_id=? AND job_id=? ORDER BY revision DESC").bind(organization.id,quoteJob).all<{lines:string}>();
    await recordRead(user.id,organization.id,"service-jobs:quote-history");
    return NextResponse.json({history:history.results.map(row=>({...row,lines:JSON.parse(row.lines)}))},{headers:{"Cache-Control":"private, no-store"}});
   }
   const visitJob=txt(new URL(request.url).searchParams.get("visitHistory"),100);
   if(visitJob){
    const job=await serviceJob(visitJob,organization.id);
    if(!job||(!manage&&job.assigned_user_id!==user.id))return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
    const visits=await db.prepare("SELECT v.id,v.scheduled_date,v.status,v.note,v.closed_at,u.full_name AS assigned_name FROM service_visits v JOIN users u ON u.id=v.assigned_user_id WHERE v.organization_id=? AND v.job_id=? ORDER BY v.scheduled_date DESC,v.created_at DESC,v.id").bind(organization.id,visitJob).all();
    await recordRead(user.id,organization.id,"service-jobs:visits");
    return NextResponse.json({visits:visits.results},{headers:{"Cache-Control":"private, no-store"}});
   }
   const paymentJob=txt(new URL(request.url).searchParams.get("paymentHistory"),100);
   if(paymentJob){
    if(!manage)return NextResponse.json({error:"Tahsilat geçmişini yönetici görüntüleyebilir."},{status:403});
    if(!await serviceJob(paymentJob,organization.id))return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
    const history=await db.prepare("SELECT version,before_cents,after_cents,created_at FROM service_payment_history WHERE organization_id=? AND job_id=? ORDER BY version DESC").bind(organization.id,paymentJob).all();
    await recordRead(user.id,organization.id,"service-jobs:payment-history");
    return NextResponse.json({history:history.results},{headers:{"Cache-Control":"private, no-store"}});
   }
   if(new URL(request.url).searchParams.get("summary")==="1"){
    const stages=await db.prepare("SELECT stage,count(*) count,MAX(0,AVG((julianday('now')-julianday(updated_at))*24)) waitHours FROM service_jobs WHERE organization_id=? AND (?=1 OR assigned_user_id=?) AND stage NOT IN ('collected','cancelled') GROUP BY stage").bind(organization.id,manage?1:0,user.id).all<{stage:string;count:number;waitHours:number}>();
    const late=await db.prepare("SELECT s.id,w.title,w.order_number,w.scheduled_date,s.stage FROM service_jobs s JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id WHERE s.organization_id=? AND (?=1 OR s.assigned_user_id=?) AND s.stage IN ('requested','quoted','quote_approved','in_progress') AND date(w.scheduled_date)<date('now') ORDER BY w.scheduled_date LIMIT 5").bind(organization.id,manage?1:0,user.id).all();
    const bottleneck=stages.results.reduce<{stage:string;weight:number}|null>((best,row)=>{const weight=row.count*row.waitHours;return !best||weight>best.weight?{stage:row.stage,weight}:best;},null);
    await recordRead(user.id,organization.id,"service-jobs:summary");
    return NextResponse.json({stages:stages.results,late:late.results,bottleneck,approximate:true},{headers:{"Cache-Control":"private, no-store"}});
   }

   const lastApproval=(column:string)=>`(SELECT x.${column} FROM service_approvals x WHERE x.job_id=s.id AND x.organization_id=s.organization_id AND x.approved_at IS NOT NULL ORDER BY x.approved_at DESC,x.created_at DESC,x.rowid DESC LIMIT 1)`;
   const jobs=await db.prepare(`SELECT w.title,w.description,w.customer_name,w.location,w.scheduled_date,w.order_number,w.assigned_to,s.*,a.asset_code,a.name AS asset_name,
    ${lastApproval("purpose")} AS approval_purpose,${lastApproval("approved_by")} AS approved_by,${lastApproval("approved_at")} AS approved_at,${lastApproval("signature_path")} AS signature_path
    FROM service_jobs s JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id
    LEFT JOIN assets a ON a.id=s.asset_id AND a.organization_id=s.organization_id
    WHERE s.organization_id=? AND (?=1 OR s.assigned_user_id=?) ORDER BY (s.id=?) DESC,s.updated_at DESC LIMIT 200`).bind(organization.id,manage?1:0,user.id,txt(new URL(request.url).searchParams.get("job"),100)).all<Record<string,unknown>>();
   for(const j of jobs.results){if(!isSafeSignaturePath(j.signature_path))j.signature_path=null;if(manage)Object.assign(j,totals(j as never));else for(const key of ["labor_cents","parts_cents","travel_cents","paid_cents"])delete j[key];}
   const assets=access.viewModules.includes("assets")?await db.prepare("SELECT id,name,asset_code FROM assets WHERE organization_id=? ORDER BY name LIMIT 500").bind(organization.id).all():{results:[]};
   const members=manage?await db.prepare("SELECT u.id,u.username,u.full_name FROM users u JOIN organization_members m ON m.user_id=u.id WHERE m.organization_id=? AND m.active=1 AND u.active=1").bind(organization.id).all():{results:[]};
   await recordRead(user.id,organization.id,"service-jobs:list");
   return NextResponse.json({jobs:jobs.results,assets:assets.results,members:members.results,manage,canWrite,userId:user.id,organization:{id:organization.id,name:organization.name}});
  }
  const b=await request.json() as Record<string,unknown>;
  if(b.action==="create"){
   if(!manage)return NextResponse.json({error:"Yeni servis açmak için yönetici yetkisi gerekir."},{status:403});
   const previousJobId=txt(b.previousJobId,100)||null;
   if(previousJobId&&!await serviceJob(previousJobId,organization.id))throw new ServiceRuleError("Önceki servis işi bu firmada bulunamadı.");
   const title=txt(b.title,240);if(!title)throw new ServiceRuleError("İş başlığı gerekli.");
   const asset=txt(b.assetId,100)||null;const assigned=txt(b.assignedUserId,100)||user.id;
   if(asset&&!await db.prepare("SELECT id FROM assets WHERE id=? AND organization_id=?").bind(asset,organization.id).first())throw new ServiceRuleError("Ekipman bu firmaya ait değil.");
   if(assigned!==user.id&&!await db.prepare("SELECT user_id FROM organization_members WHERE user_id=? AND organization_id=? AND active=1").bind(assigned,organization.id).first())throw new ServiceRuleError("Çalışan bu firmaya ait değil.");
   const date=txt(b.scheduledDate,10)||null;if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new ServiceRuleError("Geçerli tarih girin.");
   const id=createId("wo");const number=`SRV-${crypto.randomUUID().slice(0,12).toUpperCase()}`;
   await db.batch([
    // Çift gönderim koruması: aynı yöneticinin 60 sn içindeki aynı başlık+müşteri+atama talebi yeni iş açmaz.
    db.prepare(`INSERT INTO work_orders(id,organization_id,order_number,title,description,customer_name,location,scheduled_date,created_by)
     SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM work_orders w JOIN service_jobs s ON s.id=w.id
      WHERE w.organization_id=? AND w.title=? AND COALESCE(w.customer_name,'')=? AND w.created_by=? AND COALESCE(s.assigned_user_id,'')=? AND s.previous_job_id IS ? AND w.created_at>datetime('now','-60 seconds'))`)
     .bind(id,organization.id,number,title,txt(b.description),txt(b.customerName,240),txt(b.location,400),date,user.id,organization.id,title,txt(b.customerName,240),user.id,assigned,previousJobId),
    db.prepare("INSERT INTO service_jobs(id,organization_id,asset_id,assigned_user_id,previous_job_id) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM work_orders WHERE id=?)").bind(id,organization.id,asset,assigned,previousJobId,id),
    auditStatement(user.id,"create","service_job",id,"Servis talebi oluşturuldu.",organization.id,true),
   ]);
   if(!await db.prepare("SELECT id FROM service_jobs WHERE id=?").bind(id).first()){
    const existing=await db.prepare(`SELECT w.id FROM work_orders w JOIN service_jobs s ON s.id=w.id WHERE w.organization_id=? AND w.title=? AND COALESCE(w.customer_name,'')=? AND w.created_by=? AND COALESCE(s.assigned_user_id,'')=? AND s.previous_job_id IS ? AND w.created_at>datetime('now','-60 seconds') ORDER BY w.created_at DESC LIMIT 1`).bind(organization.id,title,txt(b.customerName,240),user.id,assigned,previousJobId).first<{id:string}>();
    return NextResponse.json({ok:true,id:existing?.id,duplicate:true});
   }
   return NextResponse.json({ok:true,id},{status:201});
  }
  const id=txt(b.id,100);const job=await serviceJob(id,organization.id);
  if(!job||(!manage&&job.assigned_user_id!==user.id))return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
  if(Number(b.version)!==Number(job.version))return NextResponse.json({error:"Kayıt başka bir işlemle güncellendi. Yenileyin."},{status:409});
  if(b.action==="quote-revise"){
   if(!manage)return NextResponse.json({error:"Teklifi yönetici düzenleyebilir."},{status:403});
   if(!["requested","quoted"].includes(String(job.stage)))throw new ServiceRuleError("Onaylanmış teklif değiştirilemez.");
   const lines=quoteLines(b.lines);
   if(!lines)throw new ServiceRuleError("Geçerli teklif kalemleri girin.");
   const total=lines.reduce((sum,line)=>sum+line.quantity*line.unitCents,0);
   if(!Number.isSafeInteger(total)||total>10_000_000_000||total<Number(job.paid_cents))throw new ServiceRuleError("Teklif toplamı geçersiz.");
   const previous=await quoteSnapshot(db,organization.id,id,job.version);
   const reason=typeof b.reason==="string"?b.reason.trim().slice(0,1000):"";
   if((previous||job.stage==="quoted")&&!reason)throw new ServiceRuleError("Revizyon gerekçesi gerekli.");
   const revision=(previous?.revision??0)+1;
   const [updated]=await db.batch([
    db.prepare(`UPDATE service_jobs SET stage='quoted',quote_cents=?,version=version+1,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND organization_id=? AND version=? AND stage IN ('requested','quoted') RETURNING version`)
     .bind(total,id,organization.id,job.version),
    db.prepare(`INSERT INTO service_quote_versions(organization_id,job_id,job_version,revision,lines,total_cents,reason,actor_id)
      SELECT ?,?,?,?,?,?,?,? WHERE changes()>0`)
     .bind(organization.id,id,Number(job.version)+1,revision,JSON.stringify(lines),total,reason,user.id),
    auditStatement(user.id,"revise_quote","service_job",id,`Teklif sürümü: ${revision}`,organization.id,true),
    db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL AND changes()>0").bind(id,organization.id),
   ]);
   if(!updated.results?.length)return NextResponse.json({error:"Kayıt değişti. Yenileyin."},{status:409});
   return NextResponse.json({ok:true,revision,totalCents:total});
  }
  if(b.action==="share"){
   const purpose=b.purpose==="completion"?"completion":"quote";
   if(!manage && purpose!=="completion")return NextResponse.json({error:"Teklif onayını yönetici başlatabilir."},{status:403});
   const validity=manage?"+7 days":"+1 hour";
   if(job.stage!==(purpose==="quote"?"quoted":"completed"))throw new ServiceRuleError("Önce teklif veya tamamlanan iş durumunu kaydedin.");
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
   await db.batch([
    db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL").bind(id,organization.id),
    db.prepare(`INSERT INTO service_approvals(id,organization_id,job_id,token_hash,purpose,job_version,expires_at,created_by) VALUES(?,?,?,?,?,?,datetime('now',?),?)`).bind(createId("approval"),organization.id,id,await tokenDigest(token),purpose,job.version,validity,user.id),
    auditStatement(user.id,"share","service_job",id,"Müşteri onay bağlantısı oluşturuldu.",organization.id,true),
   ]);return NextResponse.json({ok:true,path:`/servis/onay#token=${token}`},{headers:{"Cache-Control":"no-store"}});
  }
  if(b.action==="visit-close"){
   if(["completed","accepted","collected","cancelled"].includes(String(job.stage)))throw new ServiceRuleError("Kapanış aşamasındaki işin ziyareti değiştirilemez.");
   const visitId=txt(b.visitId,100),status=txt(b.status,30),note=txt(b.note,2000);
   if(!["done","parts_waiting","customer_absent","cancelled"].includes(status)||!note)throw new ServiceRuleError("Ziyaret sonucu ve açıklama gerekli.");
   if(!manage&&(!["quote_approved","in_progress"].includes(String(job.stage))||status==="cancelled"))return NextResponse.json({error:"Ziyaret işlemi için yetkiniz yok."},{status:403});
   const [closed]=await db.batch([
    db.prepare(`UPDATE service_visits SET status=?,note=?,closed_at=CURRENT_TIMESTAMP
     WHERE id=? AND job_id=? AND organization_id=? AND status='planned' AND (?=1 OR assigned_user_id=?)
       AND EXISTS(SELECT 1 FROM service_jobs WHERE id=? AND organization_id=? AND version=?) RETURNING id`)
     .bind(status,note,visitId,id,organization.id,manage?1:0,user.id,id,organization.id,job.version),
    auditStatement(user.id,"close","service_visit",visitId,status,organization.id,true),
   ]);
   if(!closed.results?.length)return NextResponse.json({error:"Ziyaret değişti veya bu ziyaret için yetkiniz yok."},{status:409});
   return NextResponse.json({ok:true});
  }
  if(b.action==="schedule"||b.action==="visit-plan"){
   // Planlama panosu: yalnız yönetici tarih ve sorumlu atar. Onaylanmış/kapanmış iş yeniden planlanmaz.
   if(!manage)return NextResponse.json({error:"Planlamayı yönetici yapar."},{status:403});
   if(["accepted","collected","cancelled"].includes(String(job.stage)))throw new ServiceRuleError("Kapanmış iş yeniden planlanamaz.");
   const date=b.scheduledDate===null||b.scheduledDate===""?null:txt(b.scheduledDate,10);
   if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date))throw new ServiceRuleError("Geçerli tarih girin.");
   const assigned=b.assignedUserId===undefined?String(job.assigned_user_id||user.id):txt(b.assignedUserId,100);
   if(assigned!==job.assigned_user_id&&!await db.prepare("SELECT user_id FROM organization_members WHERE user_id=? AND organization_id=? AND active=1").bind(assigned,organization.id).first())throw new ServiceRuleError("Çalışan bu firmaya ait değil.");
   const planningVisit=b.action==="visit-plan";
   if(planningVisit&&(!date||!assigned||job.stage==="completed"))throw new ServiceRuleError("Ziyaret için açık iş, tarih ve sorumlu gerekli.");
   if(!planningVisit&&await db.prepare("SELECT 1 FROM service_visits WHERE job_id=? AND organization_id=? AND status='planned'").bind(id,organization.id).first())throw new ServiceRuleError("Önce açık ziyareti sonuçlandırın veya iptal edin.");
   const visitId=createId("visit");
   const visitStatement=db.prepare(`INSERT INTO service_visits(id,organization_id,job_id,assigned_user_id,scheduled_date)
    SELECT ?,?,?,?,? WHERE changes()>0`).bind(visitId,organization.id,id,assigned,date);
   const [moved]=await db.batch([
    db.prepare(`UPDATE service_jobs SET assigned_user_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND version=?
      AND NOT EXISTS(SELECT 1 FROM service_visits WHERE job_id=? AND status='planned') RETURNING version`).bind(assigned,id,organization.id,job.version,id),
    ...(planningVisit?[visitStatement]:[]),
    auditStatement(user.id,"schedule","service_job",id,`Plan: ${date||"tarihsiz"} → ${assigned}`,organization.id,true),
    db.prepare("UPDATE work_orders SET scheduled_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND changes()>0").bind(date,id,organization.id),
    db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL AND changes()>0 AND EXISTS(SELECT 1 FROM service_jobs WHERE id=? AND version=? AND assigned_user_id=?)").bind(id,organization.id,id,Number(job.version)+1,assigned),
   ]);
   if(!moved.results?.length)return NextResponse.json({error:"Kayıt değişti. Yenileyin."},{status:409});
   return NextResponse.json({ok:true});
  }
  if(b.action!=="update")throw new ServiceRuleError("Geçersiz işlem.");
  const stage=txt(b.stage,30)||String(job.stage);validateTransition(String(job.stage),stage);
  if(!manage&&!canTransition(TECHNICAL_SERVICE_FLOW,String(job.stage),stage,false))throw new ServiceRuleError("Saha kaydı için onaylı veya devam eden iş seçin.");
  const outcome=b.outcome===undefined?String(job.outcome):txt(b.outcome,6000);
  // T4: aşamanın zorunlu alanları akış tanımından.
  if(stage!==job.stage){const missing=missingRequired(TECHNICAL_SERVICE_FLOW,stage,{outcome});if(missing.length)throw new ServiceRuleError(missing[0]);}else if(stage==="completed"&&!outcome)throw new ServiceRuleError("Yapılan işlemi yazın.");
  if(["completed","cancelled"].includes(stage)&&stage!==job.stage&&await db.prepare("SELECT 1 FROM service_visits WHERE job_id=? AND organization_id=? AND status='planned'").bind(id,organization.id).first())throw new ServiceRuleError("İşi kapatmadan açık ziyareti sonuçlandırın.");
  if(["completed","cancelled"].includes(stage)&&stage!==job.stage&&await db.prepare("SELECT 1 FROM service_job_parts WHERE job_id=? AND organization_id=? AND reserved>0").bind(id,organization.id).first())throw new ServiceRuleError("İşi kapatmadan önce ayrılan parçaları kullanıldı veya depoya iade edildi olarak işaretleyin.");
  if(stage==="completed"&&job.stage!=="completed"){
   const open=await db.prepare("SELECT name FROM service_job_checklists WHERE job_id=? AND organization_id=? AND completed_at IS NULL").bind(id,organization.id).all<{name:string}>();
   if(open.results.length)throw new RequiredChecklistError("Zorunlu kontrol maddeleri tamamlanmadı. Saha formundaki zorunlu alanları doldurun.");
  }
  const moneyFields=["quote","labor","parts","travel","paid"] as const;
  const values=moneyFields.map(k=>manage&&b[k]!==undefined?cents(b[k]):Number(job[`${k}_cents`]));
  if(values[0]!==Number(job.quote_cents)&&await quoteSnapshot(db,organization.id,id,job.version))throw new ServiceRuleError("Teklif toplamı yalnızca teklif kalemlerinden değiştirilebilir.");
  if(b.quote!==undefined&&values[0]!==Number(job.quote_cents)&&!["requested","quoted"].includes(String(job.stage)))throw new ServiceRuleError("Onaylanmış teklif tutarı değiştirilemez.");
  if(values[4]>values[0])throw new ServiceRuleError("Tahsilat teklif tutarını aşamaz.");
  if(stage==="collected"&&values[4]<values[0])throw new ServiceRuleError("Tahsilat tamamlanmadı.");
  if(values[4]<Number(job.paid_cents))throw new ServiceRuleError("Tahsil edilen tutarı azaltmak için iade veya tahsilat iptali kaydı kullanın.");
  if(["accepted","collected"].includes(String(job.stage))&&outcome!==String(job.outcome))throw new ServiceRuleError("Müşterinin onayladığı rapor değiştirilemez.");
  const paymentHistory=values[4]!==Number(job.paid_cents)?[db.prepare(`INSERT INTO service_payment_history(organization_id,job_id,version,before_cents,after_cents,actor_id)
   SELECT organization_id,id,version+1,paid_cents,?,? FROM service_jobs WHERE id=? AND organization_id=? AND version=?`)
   .bind(values[4],user.id,id,organization.id,job.version)]:[];
  const results=await db.batch([
   ...paymentHistory,
   db.prepare(`UPDATE service_jobs SET stage=?,outcome=?,quote_cents=?,labor_cents=?,parts_cents=?,travel_cents=?,paid_cents=?,version=version+1,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND organization_id=? AND version=? RETURNING version`).bind(stage,outcome,...values,id,organization.id,job.version),
   // Toplam alanından girilen tahsilat artışı da ayrı bir tahsilat hareketi olarak kaydedilir.
   ...(values[4]>Number(job.paid_cents)?[db.prepare(`INSERT INTO service_payments(id,organization_id,job_id,kind,amount_cents,method,reason,request_id,actor_id)
    SELECT ?,?,?,'payment',?,'diger','',?,? WHERE changes()>0`).bind(createId("pay"),organization.id,id,values[4]-Number(job.paid_cents),createId("legacy-pay"),user.id)]:[]),
   auditStatement(user.id,"update","service_job",id,`Servis durumu: ${stage}`,organization.id,true),
   db.prepare("UPDATE work_orders SET status=?,notes=?,completed_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND changes()>0").bind(["completed","accepted","collected"].includes(stage)?"completed":stage==="cancelled"?"cancelled":stage==="in_progress"?"in_progress":"open",outcome,["completed","accepted","collected"].includes(stage)?new Date().toISOString().slice(0,10):null,id,organization.id),
   db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL AND changes()>0").bind(id,organization.id),
  ]);
  if(!results[paymentHistory.length].results?.length)return NextResponse.json({error:"Kayıt değişti. Yenileyin."},{status:409});
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof RequiredChecklistError||e instanceof ServiceRuleError?e.message:"Servis işlemi tamamlanamadı."},{status:400});}
}
