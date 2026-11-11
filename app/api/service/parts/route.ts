import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,auditStatement} from "@/lib/db";
import {ensureServiceColumns,serviceJob} from "@/lib/service";
import {rejectCrossSiteMutation} from "@/lib/security";
import {recordRead} from "@/lib/read-audit";
import {partQuantity,partRequestId,PART_MOVE_KINDS,type PartMoveKind} from "@/lib/service-parts";

// Servis parça ve depo hareketleri. Yetki ve stok kuralları yalnız burada, sunucuda uygulanır.
const txt=(v:unknown,max=200)=>String(v??"").trim().slice(0,max);
const OPEN_FOR_RESERVE=["requested","quoted","quote_approved","in_progress"];
const OPEN_FOR_CONSUME=["quote_approved","in_progress"];
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
  const access=await getMemberAccess(user,organization);const db=getDb();
  const manage=MANAGERS.includes(access.profile);const canWrite=manage||access.editModules.includes("work-orders");
  const org=organization.id;

  if(request.method==="GET"){
   const params=new URL(request.url).searchParams;
   const jobId=txt(params.get("jobId"),100);
   if(jobId){
    const job=await serviceJob(jobId,org);
    if(!job||(!manage&&job.assigned_user_id!==user.id))return fail("Servis kaydı bulunamadı.",404);
    const lines=await db.prepare(`SELECT p.id AS part_id,p.code,p.name,jp.reserved,jp.used${manage?",p.unit_cost_cents":""}
     FROM service_job_parts jp JOIN service_parts p ON p.id=jp.part_id AND p.organization_id=jp.organization_id
     WHERE jp.organization_id=? AND jp.job_id=? ORDER BY p.code`).bind(org,jobId).all();
    const movements=manage?await db.prepare(`SELECT m.kind,m.quantity,m.created_at,p.code,p.name,u.full_name AS actor
     FROM service_part_movements m JOIN service_parts p ON p.id=m.part_id JOIN users u ON u.id=m.actor_id
     WHERE m.organization_id=? AND m.job_id=? ORDER BY m.created_at DESC,m.id LIMIT 200`).bind(org,jobId).all():{results:[]};
    const stock=manage?await db.prepare("SELECT id,code,name,on_hand FROM service_parts WHERE organization_id=? ORDER BY code LIMIT 500").bind(org).all():{results:[]};
    await recordRead(user.id,org,"service-parts:job");
    return NextResponse.json({lines:lines.results,movements:movements.results,stock:stock.results,manage},{headers:{"Cache-Control":"private, no-store"}});
   }
   if(!manage)return fail("Depo listesini yönetici görüntüleyebilir.",403);
   const parts=await db.prepare(`SELECT p.id,p.code,p.name,p.unit_cost_cents,p.sale_price_cents,p.on_hand,p.critical_level,p.barcode,
     COALESCE((SELECT SUM(reserved) FROM service_job_parts jp WHERE jp.part_id=p.id AND jp.organization_id=p.organization_id),0) AS reserved
     FROM service_parts p WHERE p.organization_id=? ORDER BY (p.on_hand<=p.critical_level AND p.critical_level>0) DESC,p.code LIMIT 1000`).bind(org).all<{code:string;name:string;barcode:string|null;unit_cost_cents:number;sale_price_cents:number;on_hand:number;critical_level:number;reserved:number}>();
   const critical=parts.results.filter(p=>p.critical_level>0&&p.on_hand<=p.critical_level).length;
   await recordRead(user.id,org,"service-parts:stock");
   if(params.get("format")==="csv"){
    const cell=(v:unknown)=>{const t=String(v??"");const safe=/^[=+\-@\t\r]/.test(t)?"'"+t:t;return /[";\n]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;};
    const tl=(c:number)=>(c/100).toFixed(2).replace(".",",");
    const lines=[["Kod","Ad","Barkod","Depoda","İşlere ayrılan","Kritik seviye","Alış (TL)","Satış (TL)"].join(";"),...parts.results.map(p=>[p.code,p.name,p.barcode??"",p.on_hand,p.reserved,p.critical_level,tl(p.unit_cost_cents),tl(p.sale_price_cents)].map(cell).join(";"))];
    return new Response("\uFEFF"+lines.join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="stok.csv"',"Cache-Control":"private, no-store"}});
   }
   return NextResponse.json({parts:parts.results,critical},{headers:{"Cache-Control":"private, no-store"}});
  }

  const b=await request.json() as Record<string,unknown>;
  if(!canWrite)return fail("Parça işlemi için yetkiniz yok.",403);

  if(b.action==="part-create"){
   if(!manage)return fail("Depoya parça tanımını yönetici yapar.",403);
   const code=txt(b.code,40),name=txt(b.name,160);const cost=Number(b.unitCostCents);
   if(!code||!name||!Number.isSafeInteger(cost)||cost<0||cost>10_000_000_000)return fail("Parça kodu, adı ve geçerli birim maliyet gerekli.");
   if(await db.prepare("SELECT 1 FROM service_parts WHERE organization_id=? AND code=?").bind(org,code).first())return fail("Bu parça kodu zaten tanımlı.",409);
   const id=createId("part");
   await db.batch([
    db.prepare("INSERT INTO service_parts(id,organization_id,code,name,unit_cost_cents,created_by) VALUES(?,?,?,?,?,?)").bind(id,org,code,name,cost,user.id),
    auditStatement(user.id,"create","service_part",id,`Parça tanımı: ${code}`,org,true),
   ]);
   return NextResponse.json({ok:true,id},{status:201});
  }

  if(b.action==="part-update"){
   if(!manage)return fail("Parça bilgisini yönetici düzenler.",403);
   const id=txt(b.partId,100),name=txt(b.name,160),barcode=txt(b.barcode,64)||null;
   const nums=[b.unitCostCents,b.salePriceCents].map(Number);const critical=Number(b.criticalLevel);
   if(!name||nums.some(n=>!Number.isSafeInteger(n)||n<0||n>10_000_000_000)||!Number.isSafeInteger(critical)||critical<0||critical>100000)return fail("Ad, fiyatlar ve kritik seviye geçerli olmalı.");
   const [row]=await db.batch([
    db.prepare("UPDATE service_parts SET name=?,unit_cost_cents=?,sale_price_cents=?,critical_level=?,barcode=? WHERE id=? AND organization_id=? RETURNING id").bind(name,nums[0],nums[1],critical,barcode,id,org),
    auditStatement(user.id,"update","service_part",id,"Parça bilgisi güncellendi.",org,true),
   ]);
   if(!row.results?.length)return fail("Parça bu firmada bulunamadı.",404);
   return NextResponse.json({ok:true});
  }

  const requestId=partRequestId(b.requestId);const quantity=partQuantity(b.quantity);const partId=txt(b.partId,100);
  if(!requestId)return fail("İstek kimliği eksik. Sayfayı yenileyip tekrar deneyin.");
  if(!quantity)return fail("Miktar 1 ile 10.000 arasında tam sayı olmalı.");
  const part=await db.prepare("SELECT id,unit_cost_cents FROM service_parts WHERE id=? AND organization_id=?").bind(partId,org).first<{id:string;unit_cost_cents:number}>();
  if(!part)return fail("Parça bu firmada bulunamadı.",404);
  // Aynı istek ikinci kez gelirse yeni hareket yazılmaz.
  const seen=async()=>db.prepare("SELECT kind,part_id,job_id,quantity FROM service_part_movements WHERE organization_id=? AND request_id=?").bind(org,requestId).first();
  if(await seen())return NextResponse.json({ok:true,duplicate:true});

  const movement=(kind:string,jobId:string|null)=>db.prepare(`INSERT INTO service_part_movements(id,organization_id,part_id,job_id,kind,quantity,unit_cost_cents,request_id,actor_id)
   SELECT ?,?,?,?,?,?,?,?,? WHERE changes()>0`).bind(createId("pmv"),org,part.id,jobId,kind,quantity,part.unit_cost_cents,requestId,user.id);

  let statements;let conflict:string;
  if(b.action==="part-receive"){
   if(!manage)return fail("Depo girişini yönetici yapar.",403);
   statements=[
    db.prepare("UPDATE service_parts SET on_hand=on_hand+? WHERE id=? AND organization_id=? RETURNING on_hand").bind(quantity,part.id,org),
    movement("receive",null),
    auditStatement(user.id,"receive","service_part",part.id,`Depo girişi: ${quantity}`,org,true),
   ];
   conflict="Depo girişi kaydedilemedi.";
  }else{
   const kind=txt(b.action,30).replace(/^part-/,"") as PartMoveKind;
   if(!PART_MOVE_KINDS.includes(kind))return fail("Geçersiz işlem.");
   const jobId=txt(b.jobId,100);const job=await serviceJob(jobId,org);
   if(!job||(!manage&&job.assigned_user_id!==user.id))return fail("Servis kaydı bulunamadı.",404);
   const stage=String(job.stage);
   // Teknisyen yalnız kendi işinde kullanım ve iade yapar; ayırma yöneticidedir.
   const jobGuard=(stages:string[])=>`EXISTS(SELECT 1 FROM service_jobs WHERE id=? AND organization_id=? AND stage IN (${stages.map(()=>"?").join(",")}) AND (?=1 OR assigned_user_id=?))`;
   const guardValues=(stages:string[])=>[jobId,org,...stages,manage?1:0,user.id];
   if(kind==="reserve"){
    if(!manage)return fail("Parça ayırmayı yönetici yapar.",403);
    if(!OPEN_FOR_RESERVE.includes(stage))return fail("Bu aşamadaki işe parça ayrılamaz.");
    statements=[
     db.prepare(`UPDATE service_parts SET on_hand=on_hand-? WHERE id=? AND organization_id=? AND on_hand>=? AND ${jobGuard(OPEN_FOR_RESERVE)} RETURNING on_hand`)
      .bind(quantity,part.id,org,quantity,...guardValues(OPEN_FOR_RESERVE)),
     db.prepare(`INSERT INTO service_job_parts(organization_id,job_id,part_id,reserved) SELECT ?,?,?,? WHERE changes()>0
      ON CONFLICT(job_id,part_id) DO UPDATE SET reserved=reserved+excluded.reserved`).bind(org,jobId,part.id,quantity),
     movement("reserve",jobId),
     auditStatement(user.id,"reserve","service_part",part.id,`İşe ayrıldı: ${quantity}`,org,true),
    ];
    conflict="Depoda yeterli parça yok veya iş değişti.";
   }else if(kind==="consume"){
    if(!OPEN_FOR_CONSUME.includes(stage))return fail("Parça kullanımı onaylı veya devam eden işte kaydedilir.");
    statements=[
     db.prepare(`UPDATE service_job_parts SET reserved=reserved-?,used=used+? WHERE job_id=? AND part_id=? AND organization_id=? AND reserved>=? AND ${jobGuard(OPEN_FOR_CONSUME)} RETURNING used`)
      .bind(quantity,quantity,jobId,part.id,org,quantity,...guardValues(OPEN_FOR_CONSUME)),
     db.prepare("UPDATE service_jobs SET parts_cents=parts_cents+?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND changes()>0")
      .bind(quantity*part.unit_cost_cents,jobId,org),
     movement("consume",jobId),
     auditStatement(user.id,"consume","service_part",part.id,`İşte kullanıldı: ${quantity}`,org,true),
    ];
    conflict="Bu iş için ayrılmış yeterli parça yok.";
   }else{
    const anyStage=["requested","quoted","quote_approved","in_progress","completed","accepted","collected","cancelled"];
    statements=[
     db.prepare(`UPDATE service_job_parts SET reserved=reserved-? WHERE job_id=? AND part_id=? AND organization_id=? AND reserved>=? AND ${jobGuard(anyStage)} RETURNING reserved`)
      .bind(quantity,jobId,part.id,org,quantity,...guardValues(anyStage)),
     db.prepare("UPDATE service_parts SET on_hand=on_hand+? WHERE id=? AND organization_id=? AND changes()>0").bind(quantity,part.id,org),
     movement("return",jobId),
     auditStatement(user.id,"return","service_part",part.id,`Depoya iade: ${quantity}`,org,true),
    ];
    conflict="İade miktarı ayrılan miktarı aşamaz.";
   }
  }
  let results;
  try{results=await db.batch(statements);}
  catch(e){
   // Eşzamanlı aynı istek: benzersiz istek kimliği ikinci yazımı geri alır.
   if(/UNIQUE/i.test(String(e))&&await seen())return NextResponse.json({ok:true,duplicate:true});
   throw e;
  }
  if(!results[0].results?.length)return fail(conflict,409);
  return NextResponse.json({ok:true});
 }catch(e){console.error("service-parts",e);return fail("Parça işlemi tamamlanamadı.");}
}
