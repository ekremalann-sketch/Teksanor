import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {ensureSchema,getDb,auditStatement} from "@/lib/db";
import {ensureServiceColumns,serviceJob} from "@/lib/service";
import {rejectCrossSiteMutation} from "@/lib/security";
import {tokenDigest} from "@/lib/account-tokens";
import {CUSTOMER_STAGE_LABELS,newTrackingCode,validTrackingCode} from "@/lib/service-tracking";

// GET ?code=: üyeliksiz müşteri görünümü. POST {jobId}: yönetici veya atanmış teknisyen yeni takip bağlantısı üretir.
const LINK_MAX_DAYS=90,CLOSED_GRACE_DAYS=7;
const MANAGERS=["owner","company_admin","ceo","manager"];
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});

export async function GET(request:Request){
 await ensureSchema();await ensureServiceColumns();
 const code=new URL(request.url).searchParams.get("code");
 if(!validTrackingCode(code))return fail("Takip bağlantısı geçersiz.",404);
 const row=await getDb().prepare(`SELECT o.name AS company,w.order_number,w.title,w.scheduled_date,s.stage,s.updated_at,s.quote_cents,s.paid_cents,s.time_window,s.on_way_at,s.arrived_at,
   (SELECT v.scheduled_date FROM service_visits v WHERE v.job_id=s.id AND v.status='planned' ORDER BY v.scheduled_date LIMIT 1) AS next_visit,
   (julianday('now')-julianday(t.created_at)>${LINK_MAX_DAYS} OR (s.stage IN ('accepted','collected','cancelled') AND julianday('now')-julianday(s.updated_at)>${CLOSED_GRACE_DAYS})) AS expired
  FROM service_tracking t JOIN service_jobs s ON s.id=t.job_id AND s.organization_id=t.organization_id
  JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id JOIN organizations o ON o.id=s.organization_id
  WHERE t.code_hash=? AND o.active=1`).bind(await tokenDigest(code)).first<Record<string,unknown>>();
 if(!row)return fail("Takip bağlantısı geçersiz veya yenilenmiş. Firmanızdan yeni bağlantı isteyin.",404);
 // Güvenlik (#52): bağlantı süresiz açık kalmaz — en çok 90 gün; iş kapandıktan/iptalden 7 gün sonra kapanır.
 if(Number(row.expired))return fail("Takip bağlantısının süresi doldu. Firmanızdan yeni bağlantı isteyin.",410);
 const quote=Number(row.quote_cents),paid=Number(row.paid_cents);
 // T6: sahada olan işte yolda/adreste bilgisi (personel adı gösterilmez).
 const field=["quote_approved","in_progress"].includes(String(row.stage));
 const status=field&&row.arrived_at?"Teknisyen adreste":field&&row.on_way_at?"Teknisyen yolda":CUSTOMER_STAGE_LABELS[String(row.stage)]??"İşleniyor";
 return NextResponse.json({company:row.company,number:row.order_number,title:row.title,status,timeWindow:row.time_window??null,
  stage:row.stage,updatedAt:row.updated_at,plannedDate:row.next_visit??row.scheduled_date??null,
  totalCents:quote,paidCents:paid,remainingCents:Math.max(0,quote-paid)},{headers});
}

export async function POST(request:Request){
 const rejected=rejectCrossSiteMutation(request);if(rejected)return rejected;
 const user=await getCurrentUser(request);if(!user)return fail("Oturum gerekli.",401);
 let organization;try{({organization}=await requireOrganization(request,user));}catch{return fail("Erişim reddedildi.",403);}
 try{
  await ensureServiceColumns();
  const access=await getMemberAccess(user,organization);const manage=MANAGERS.includes(access.profile);
  const b=await request.json() as {jobId?:unknown};const jobId=String(b.jobId??"").slice(0,100);
  const job=await serviceJob(jobId,organization.id);
  if(!job||(!manage&&job.assigned_user_id!==user.id))return fail("Servis kaydı bulunamadı.",404);
  const code=newTrackingCode();const db=getDb();
  await db.batch([
   db.prepare(`INSERT INTO service_tracking(job_id,organization_id,code_hash,created_by) VALUES(?,?,?,?)
     ON CONFLICT(job_id) DO UPDATE SET code_hash=excluded.code_hash,created_by=excluded.created_by,created_at=CURRENT_TIMESTAMP`).bind(jobId,organization.id,await tokenDigest(code),user.id),
   auditStatement(user.id,"share","service_tracking",jobId,"Müşteri takip bağlantısı oluşturuldu.",organization.id,true),
  ]);
  return NextResponse.json({ok:true,path:`/servis/takip#kod=${code}`,code},{headers});
 }catch(e){console.error("service-tracking",e);return fail("Takip bağlantısı oluşturulamadı.",400);}
}
