import {NextResponse} from "next/server";
import {ensureSchema,getDb,addAudit} from "@/lib/db";
import {tokenDigest} from "@/lib/account-tokens";
import {rejectCrossSiteMutation} from "@/lib/security";
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const rejected=rejectCrossSiteMutation(request);return rejected||handle(request);}
async function handle(request:Request){
 await ensureSchema();
 const token=request.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return NextResponse.json({error:"Bağlantı geçersiz."},{status:404});
 const db=getDb();const hash=await tokenDigest(token);
 const a=await db.prepare(`SELECT a.*,s.stage,s.version,s.quote_cents,s.outcome,w.title,w.customer_name,w.order_number,o.name AS organization_name
 FROM service_approvals a JOIN service_jobs s ON s.id=a.job_id AND s.organization_id=a.organization_id
 JOIN work_orders w ON w.id=s.id JOIN organizations o ON o.id=s.organization_id
 WHERE token_hash=? AND a.revoked_at IS NULL AND a.expires_at>CURRENT_TIMESTAMP AND o.active=1`).bind(hash).first<Record<string,unknown>>();
 if(!a||(!a.approved_at&&a.job_version!==a.version))return NextResponse.json({error:"Bağlantının süresi dolmuş veya kayıt değişmiş. Yeni bağlantı isteyin."},{status:410});
 if(request.method==="GET")return NextResponse.json({title:a.title,number:a.order_number,company:a.organization_name,customer:a.customer_name,quote:Number(a.quote_cents)/100,outcome:a.purpose==="completion"?a.outcome:"",purpose:a.purpose,approvedAt:a.approved_at},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 const b=await request.json() as {name?:string;consent?:boolean};const name=String(b.name||"").trim().slice(0,160);
 if(!name||b.consent!==true)return NextResponse.json({error:"Adınızı yazın ve onay kutusunu işaretleyin."},{status:400});
 const stage=a.purpose==="quote"?"quote_approved":"accepted";const previous=a.purpose==="quote"?"quoted":"completed";
 if(a.approved_at)return NextResponse.json({ok:true});
 // Conditional updates in a single D1 batch prevent approval of a changed report or replay.
 const results=await db.batch([
 db.prepare(`UPDATE service_approvals SET approved_at=CURRENT_TIMESTAMP,approved_by=? WHERE token_hash=? AND approved_at IS NULL AND revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM service_jobs s WHERE s.id=job_id AND s.version=job_version AND s.stage=?) RETURNING id`).bind(name,hash,previous),
 db.prepare(`UPDATE service_jobs SET stage=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND stage=?
 AND EXISTS(SELECT 1 FROM service_approvals WHERE token_hash=? AND approved_at IS NOT NULL AND revoked_at IS NULL) RETURNING id`).bind(stage,a.job_id,a.job_version,previous,hash),
 ]);
 const changed=results[1] as {results?:unknown[]};if(!changed?.results?.length)return NextResponse.json({error:"Kayıt değişti. Yeni bağlantı isteyin."},{status:409});
 await addAudit(null,"customer_approval","service_job",String(a.job_id),`${a.purpose} müşteri onayı kaydedildi.`,String(a.organization_id));
 return NextResponse.json({ok:true});
}
