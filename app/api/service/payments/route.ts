import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,auditStatement} from "@/lib/db";
import {ensureServiceColumns,serviceJob} from "@/lib/service";
import {rejectCrossSiteMutation} from "@/lib/security";
import {recordRead} from "@/lib/read-audit";
import {partRequestId} from "@/lib/service-parts";
import {paymentAmount,paymentMethod,PAYMENT_STAGES} from "@/lib/service-payments";

// Servis tahsilat hareketleri. Yalnız yönetici; tutar ve kurallar sunucuda uygulanır.
const txt=(v:unknown,max=200)=>String(v??"").trim().slice(0,max);
const MANAGERS=["owner","company_admin","ceo","manager"];
const fail=(error:string,status=400)=>NextResponse.json({error},{status});

export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}

async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return fail("Oturum gerekli.",401);
 let organization;
 try{({organization}=await requireOrganization(request,user));}catch{return fail("Erişim reddedildi.",403);}
 try{
  await ensureServiceColumns();
  const access=await getMemberAccess(user,organization);const db=getDb();const org=organization.id;
  if(!MANAGERS.includes(access.profile))return fail("Tahsilat kayıtlarını yönetici yönetir.",403);

  if(request.method==="GET"){
   const jobId=txt(new URL(request.url).searchParams.get("jobId"),100);
   const job=await serviceJob(jobId,org);if(!job)return fail("Servis kaydı bulunamadı.",404);
   const rows=await db.prepare(`SELECT p.id,p.kind,p.amount_cents,p.method,p.reason,p.reverses_id,p.created_at,u.full_name AS actor,
     EXISTS(SELECT 1 FROM service_payments v WHERE v.reverses_id=p.id) AS voided
     FROM service_payments p JOIN users u ON u.id=p.actor_id WHERE p.organization_id=? AND p.job_id=? ORDER BY p.created_at DESC,p.id LIMIT 500`).bind(org,jobId).all<{kind:string;amount_cents:number}>();
   const ledger=rows.results.reduce((sum,row)=>sum+(row.kind==="payment"?row.amount_cents:-row.amount_cents),0);
   await recordRead(user.id,org,"service-payments:job");
   return NextResponse.json({
    payments:rows.results,paidCents:Number(job.paid_cents),quoteCents:Number(job.quote_cents),
    // Bu özellikten önce toplam alanına yazılmış tahsilat; hareket olarak görünmez ama toplamda korunur.
    legacyCents:Number(job.paid_cents)-ledger,
   },{headers:{"Cache-Control":"private, no-store"}});
  }

  const b=await request.json() as Record<string,unknown>;
  const requestId=partRequestId(b.requestId);if(!requestId)return fail("İstek kimliği eksik. Sayfayı yenileyip tekrar deneyin.");
  const jobId=txt(b.jobId,100);const job=await serviceJob(jobId,org);if(!job)return fail("Servis kaydı bulunamadı.",404);
  const seen=async()=>db.prepare("SELECT 1 FROM service_payments WHERE organization_id=? AND request_id=?").bind(org,requestId).first();
  if(await seen())return NextResponse.json({ok:true,duplicate:true});
  if(Number(b.version)!==Number(job.version))return fail("Kayıt başka bir işlemle güncellendi. Yenileyin.",409);
  if(!PAYMENT_STAGES.includes(String(job.stage)))return fail("Bu aşamada tahsilat hareketi kaydedilemez.");

  const reason=txt(b.reason,500);let kind:"payment"|"refund"|"void";let amount:number;let method="diger";let reverses:string|null=null;
  if(b.action==="payment-add"){
   const a=paymentAmount(b.amountCents);const m=paymentMethod(b.method);
   if(!a||!m)return fail("Geçerli tutar ve ödeme yöntemi girin.");
   kind="payment";amount=a;method=m;
  }else if(b.action==="payment-refund"){
   const a=paymentAmount(b.amountCents);const m=paymentMethod(b.method);
   if(!a||!m||!reason)return fail("İade için tutar, yöntem ve gerekçe gerekli.");
   kind="refund";amount=a;method=m;
  }else if(b.action==="payment-void"){
   if(!reason)return fail("İptal gerekçesi gerekli.");
   const original=await db.prepare("SELECT id,amount_cents,method FROM service_payments WHERE id=? AND organization_id=? AND job_id=? AND kind='payment'").bind(txt(b.paymentId,100),org,jobId).first<{id:string;amount_cents:number;method:string}>();
   if(!original)return fail("İptal edilecek tahsilat kaydı bulunamadı.",404);
   if(await db.prepare("SELECT 1 FROM service_payments WHERE reverses_id=?").bind(original.id).first())return fail("Bu tahsilat kaydı zaten iptal edilmiş.",409);
   kind="void";amount=original.amount_cents;method=original.method;reverses=original.id;
  }else return fail("Geçersiz işlem.");

  const delta=kind==="payment"?amount:-amount;
  const labels={payment:"Tahsilat",refund:"İade",void:"Tahsilat iptali"};
  let results;
  try{
   results=await db.batch([
    db.prepare(`UPDATE service_jobs SET paid_cents=paid_cents+?,version=version+1,updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND organization_id=? AND version=? AND stage IN (${PAYMENT_STAGES.map(()=>"?").join(",")})
       AND paid_cents+?>=0 AND paid_cents+?<=quote_cents RETURNING paid_cents`)
     .bind(delta,jobId,org,job.version,...PAYMENT_STAGES,delta,delta),
    db.prepare(`INSERT INTO service_payment_history(organization_id,job_id,version,before_cents,after_cents,actor_id)
     SELECT organization_id,id,version,paid_cents-?,paid_cents,? FROM service_jobs WHERE id=? AND organization_id=? AND changes()>0`)
     .bind(delta,user.id,jobId,org),
    db.prepare(`INSERT INTO service_payments(id,organization_id,job_id,kind,amount_cents,method,reason,reverses_id,request_id,actor_id)
     SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()>0`).bind(createId("pay"),org,jobId,kind,amount,method,reason,reverses,requestId,user.id),
    auditStatement(user.id,kind,"service_payment",jobId,`${labels[kind]}: ${(amount/100).toFixed(2)} TL${reason?` (${reason})`:""}`,org,true),
    db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=? AND approved_at IS NULL AND changes()>0").bind(jobId,org),
   ]);
  }catch(e){
   // Eşzamanlı aynı istek veya aynı kaydın ikinci iptali: benzersiz kısıt ikinci yazımı geri alır.
   if(/UNIQUE/i.test(String(e))){
    if(await seen())return NextResponse.json({ok:true,duplicate:true});
    return fail("Bu tahsilat kaydı zaten iptal edilmiş.",409);
   }
   throw e;
  }
  if(!results[0].results?.length){
   // Aynı istek eşzamanlı geldiyse ilki yazmıştır; ikincisi tekrar sayılır.
   if(await seen())return NextResponse.json({ok:true,duplicate:true});
   const fresh=await serviceJob(jobId,org);
   if(fresh&&Number(fresh.version)!==Number(job.version))return fail("Kayıt başka bir işlemle güncellendi. Yenileyin.",409);
   return fail(delta>0?"Tahsilat teklif tutarını aşamaz.":"İade veya iptal, tahsil edilen tutarı aşamaz.");
  }
  return NextResponse.json({ok:true,paidCents:Number((results[0].results[0] as {paid_cents:number}).paid_cents)});
 }catch(e){console.error("service-payments",e);return fail("Tahsilat işlemi tamamlanamadı.");}
}
