import {NextResponse} from "next/server";
import {ensureSchema,getDb,auditStatement} from "@/lib/db";
import {tokenDigest} from "@/lib/account-tokens";
import {rejectCrossSiteMutation} from "@/lib/security";
import {signaturePath,SignatureError} from "@/lib/signature";
import {ensureServiceColumns} from "@/lib/service";
import {quoteSnapshot} from "@/lib/service-quotes";
import {approvalMessage,approvalNotificationStatement} from "@/lib/approval-notify";
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const rejected=rejectCrossSiteMutation(request);return rejected||handle(request);}
async function handle(request:Request){
 await ensureSchema();await ensureServiceColumns();
 const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return NextResponse.json({error:"Bağlantı geçersiz."},{status:404});
 const db=getDb();const hash=await tokenDigest(token);
 const a=await db.prepare(`SELECT a.*,s.stage,s.version,s.quote_cents,s.outcome,w.title,w.customer_name,w.order_number,o.name AS organization_name
 FROM service_approvals a JOIN service_jobs s ON s.id=a.job_id AND s.organization_id=a.organization_id
 JOIN work_orders w ON w.id=s.id JOIN organizations o ON o.id=s.organization_id
 WHERE token_hash=? AND a.revoked_at IS NULL AND a.expires_at>CURRENT_TIMESTAMP AND o.active=1`).bind(hash).first<Record<string,unknown>>();
 if(!a||(!a.approved_at&&a.job_version!==a.version))return NextResponse.json({error:"Bağlantının süresi dolmuş veya kayıt değişmiş. Yeni bağlantı isteyin."},{status:410});
 const snapshot=a.purpose==="quote"?await quoteSnapshot(db,a.organization_id,a.job_id,a.job_version):null;
 if(request.method==="GET")return NextResponse.json({title:a.title,number:a.order_number,company:a.organization_name,customer:a.customer_name,quote:Number(snapshot?.total_cents??a.quote_cents)/100,quoteRevision:snapshot?.revision,quoteLines:snapshot?JSON.parse(snapshot.lines):undefined,outcome:a.purpose==="completion"?a.outcome:"",purpose:a.purpose,approvedAt:a.approved_at},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 const b=await request.json() as {name?:string;consent?:boolean;signature?:unknown;action?:string;reason?:unknown};const name=String(b.name||"").trim().slice(0,160);
 if(b.action==="reject"){
  const reason=typeof b.reason==="string"?b.reason.trim().slice(0,1000):"";
  if(!reason||!name||a.purpose!=="quote"||a.approved_at)return NextResponse.json({error:"Teklifi reddetmek için ad ve gerekçe gerekli."},{status:400});
  const [updated]=await db.batch([
   db.prepare(`UPDATE service_jobs SET stage='requested',version=version+1,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND organization_id=? AND version=? AND stage='quoted'
      AND EXISTS(SELECT 1 FROM service_approvals WHERE token_hash=? AND approved_at IS NULL
       AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP) RETURNING id`).bind(a.job_id,a.organization_id,a.job_version,hash),
   db.prepare("UPDATE service_approvals SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND changes()>0").bind(hash),
   auditStatement(null,"reject_quote","service_job",String(a.job_id),`Teklif reddi (${name}): ${reason}`,String(a.organization_id),true),
   (()=>{const m=approvalMessage("quote_rejected",{title:String(a.title),order_number:a.order_number as string,customer_name:a.customer_name as string},reason.slice(0,200));return approvalNotificationStatement(db,{organizationId:String(a.organization_id),jobId:String(a.job_id),expectedStage:"requested",expectedVersion:Number(a.job_version)+1,...m});})(),
  ]);
  if(!updated.results?.length)return NextResponse.json({error:"Kayıt değişti. Yeni bağlantı isteyin."},{status:409});
  return NextResponse.json({ok:true});
 }
 if(!name||b.consent!==true)return NextResponse.json({error:"Adınızı yazın ve onay kutusunu işaretleyin."},{status:400});
 let signature:string|null;
 try{signature=signaturePath(b.signature);}catch(e){if(e instanceof SignatureError)return NextResponse.json({error:e.message},{status:400});throw e;}
 const stage=a.purpose==="quote"?"quote_approved":"accepted";const previous=a.purpose==="quote"?"quoted":"completed";
 if(a.approved_at)return NextResponse.json({ok:true});
 // Conditional updates in a single D1 batch prevent approval of a changed report or replay.
 const results=await db.batch([
 db.prepare(`UPDATE service_approvals SET approved_at=CURRENT_TIMESTAMP,approved_by=?,signature_path=? WHERE token_hash=? AND approved_at IS NULL AND revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM service_jobs s WHERE s.id=job_id AND s.version=job_version AND s.stage=?) RETURNING id`).bind(name,signature,hash,previous),
 db.prepare(`UPDATE service_jobs SET stage=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND stage=?
 AND EXISTS(SELECT 1 FROM service_approvals WHERE token_hash=? AND approved_at IS NOT NULL AND revoked_at IS NULL) RETURNING id`).bind(stage,a.job_id,a.job_version,previous,hash),
 auditStatement(null,"customer_approval","service_job",String(a.job_id),`${a.purpose} müşteri onayı kaydedildi${signature?" (imzalı)":""}.`,String(a.organization_id),true),
 // T10: onay yazıldıysa (iş yeni aşamada) yöneticilere ve sorumluya uygulama içi bildirim.
 (()=>{const m=approvalMessage(a.purpose==="quote"?"quote_approved":"work_accepted",{title:String(a.title),order_number:a.order_number as string,customer_name:a.customer_name as string});return approvalNotificationStatement(db,{organizationId:String(a.organization_id),jobId:String(a.job_id),expectedStage:stage,expectedVersion:Number(a.job_version)+1,...m});})(),
 ]);
 const changed=results[1] as {results?:unknown[]};if(!changed?.results?.length)return NextResponse.json({error:"Kayıt değişti. Yeni bağlantı isteyin."},{status:409});

 return NextResponse.json({ok:true});
}

