import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,createId,auditStatement} from "@/lib/db";
import {ensureServiceColumns} from "@/lib/service";
import {rejectCrossSiteMutation} from "@/lib/security";
import {recordRead} from "@/lib/read-audit";
import {partRequestId} from "@/lib/service-parts";
import {paymentAmount,paymentMethod} from "@/lib/service-payments";
import {cashRange,csvCell,METHOD_LABELS} from "@/lib/service-cash";

// Gün sonu kasa: yalnız yönetici. Tahsilat, iade ve iptal hareketleri ile giderlerin yönteme ve kişiye göre özeti.
const MANAGERS=["owner","company_admin","ceo","manager"];
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
type Row={kind:string;amount_cents:number;method:string;actor:string;created_at:string;order_number:string;title:string;reason:string};

export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}

async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return fail("Oturum gerekli.",401);
 let organization;try{({organization}=await requireOrganization(request,user));}catch{return fail("Erişim reddedildi.",403);}
 try{
  await ensureServiceColumns();
  const access=await getMemberAccess(user,organization);
  if(!MANAGERS.includes(access.profile))return fail("Kasa ekranını yönetici görüntüler.",403);
  const db=getDb();const org=organization.id;
  if(request.method==="POST"){
   const b=await request.json() as Record<string,unknown>;
   const requestId=partRequestId(b.requestId);const amount=paymentAmount(b.amountCents);const method=paymentMethod(b.method);
   const description=String(b.description??"").trim().slice(0,200);const spentOn=String(b.spentOn??"");
   if(!requestId||!amount||!method||!description||!cashRange("ozel",spentOn,spentOn,spentOn))return fail("Gider için tarih, açıklama, tutar ve yöntem girin.");
   if(await db.prepare("SELECT 1 FROM service_expenses WHERE organization_id=? AND request_id=?").bind(org,requestId).first())return NextResponse.json({ok:true,duplicate:true});
   const id=createId("exp");
   try{await db.batch([
    db.prepare("INSERT INTO service_expenses(id,organization_id,spent_on,description,amount_cents,method,request_id,actor_id) VALUES(?,?,?,?,?,?,?,?)").bind(id,org,spentOn,description,amount,method,requestId,user.id),
    auditStatement(user.id,"create","service_expense",id,`Gider: ${(amount/100).toFixed(2)} TL`,org,true),
   ]);}catch(e){if(/UNIQUE/i.test(String(e)))return NextResponse.json({ok:true,duplicate:true});throw e;}
   return NextResponse.json({ok:true,id},{status:201});
  }
  const params=new URL(request.url).searchParams;const today=new Date().toISOString().slice(0,10);
  const range=cashRange(params.get("donem"),params.get("baslangic"),params.get("bitis"),params.get("bugun")&&/^\d{4}-\d{2}-\d{2}$/.test(params.get("bugun")!)?params.get("bugun")!:today);
  if(!range)return fail("Geçerli bir tarih aralığı seçin (en fazla 1 yıl).");
  const rows=(await db.prepare(`SELECT p.kind,p.amount_cents,p.method,u.full_name AS actor,p.created_at,w.order_number,w.title,p.reason
   FROM service_payments p JOIN users u ON u.id=p.actor_id JOIN work_orders w ON w.id=p.job_id AND w.organization_id=p.organization_id
   WHERE p.organization_id=? AND date(p.created_at) BETWEEN ? AND ? ORDER BY p.created_at,p.id`).bind(org,range.from,range.to).all<Row>()).results;
  const expenses=(await db.prepare(`SELECT e.spent_on,e.description,e.amount_cents,e.method,u.full_name AS actor FROM service_expenses e JOIN users u ON u.id=e.actor_id
   WHERE e.organization_id=? AND e.spent_on BETWEEN ? AND ? ORDER BY e.spent_on,e.created_at`).bind(org,range.from,range.to).all<{spent_on:string;description:string;amount_cents:number;method:string;actor:string}>()).results;
  const sign=(k:string)=>k==="payment"?1:-1;
  const byMethod:Record<string,{in:number;out:number;expense:number}>={};
  const byActor:Record<string,{count:number;net:number}>={};
  for(const r of rows){const m=byMethod[r.method]??={in:0,out:0,expense:0};if(r.kind==="payment")m.in+=r.amount_cents;else m.out+=r.amount_cents;
   const a=byActor[r.actor]??={count:0,net:0};a.count++;a.net+=sign(r.kind)*r.amount_cents;}
  for(const e of expenses){(byMethod[e.method]??={in:0,out:0,expense:0}).expense+=e.amount_cents;}
  const collected=rows.reduce((s,r)=>s+sign(r.kind)*r.amount_cents,0),spent=expenses.reduce((s,e)=>s+e.amount_cents,0);
  await recordRead(user.id,org,"service-cash");
  if(params.get("format")==="csv"){
   const lines=[["Tarih","Tür","İş no","İş","Yöntem","Tutar (TL)","Kişi","Açıklama"].join(";")];
   const kinds:Record<string,string>={payment:"Tahsilat",refund:"İade",void:"Tahsilat iptali"};
   for(const r of rows)lines.push([r.created_at,kinds[r.kind]??r.kind,r.order_number,r.title,METHOD_LABELS[r.method]??r.method,(sign(r.kind)*r.amount_cents/100).toFixed(2).replace(".",","),r.actor,r.reason].map(csvCell).join(";"));
   for(const e of expenses)lines.push([e.spent_on,"Gider","","",METHOD_LABELS[e.method]??e.method,(-e.amount_cents/100).toFixed(2).replace(".",","),e.actor,e.description].map(csvCell).join(";"));
   return new Response("﻿"+lines.join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="kasa-${range.from}-${range.to}.csv"`,"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json({range,collectedCents:collected,expenseCents:spent,netCents:collected-spent,
   byMethod:Object.entries(byMethod).map(([method,v])=>({method,label:METHOD_LABELS[method]??method,inCents:v.in,outCents:v.out,expenseCents:v.expense,netCents:v.in-v.out-v.expense})),
   byActor:Object.entries(byActor).map(([actor,v])=>({actor,count:v.count,netCents:v.net})).sort((a,b)=>b.netCents-a.netCents),
   movements:rows.slice(-200).reverse(),expenses:expenses.slice(-200).reverse()},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){console.error("service-cash",e);return fail("Kasa bilgisi alınamadı.");}
}
