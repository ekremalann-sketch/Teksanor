import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
import {getDb,addAudit} from "@/lib/db";
import {ensureServiceColumns,serviceJob} from "@/lib/service";
import {buildUblInvoice} from "@/lib/einvoice";

// Muhasebe XML ön taslağı indirme (standart uyumu doğrulanmadı). Yalnız müşterinin onayladığı veya tahsil edilen
// iş için; yalnız yönetici (servis modülü finans rolüne kapalıdır). Hiçbir dış servise gönderim yapılmaz.
export async function GET(request:Request){
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 let organization;
 try{({organization}=await requireOrganization(request,user));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Erişim reddedildi."},{status:403});}
 await ensureServiceColumns();
 const access=await getMemberAccess(user,organization);
 if(!["owner","company_admin","ceo","manager"].includes(access.profile))return NextResponse.json({error:"Fatura taslağını yönetici indirir."},{status:403});
 const url=new URL(request.url);
 const job=await serviceJob(String(url.searchParams.get("id")||""),organization.id);
 if(!job)return NextResponse.json({error:"Servis kaydı bulunamadı."},{status:404});
 if(!["accepted","collected"].includes(String(job.stage)))return NextResponse.json({error:"Fatura taslağı müşteri işi onayladıktan sonra hazırlanır."},{status:409});
 const vat=Number(url.searchParams.get("vat")??20);
 const profile=await getDb().prepare("SELECT legal_name,tax_number,tax_office,address,email FROM organization_profiles WHERE organization_id=?").bind(organization.id).first<Record<string,string|null>>();
 try{
  const xml=buildUblInvoice({
   number:String(job.order_number),issueDate:new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Istanbul"}), // Türkiye takvim günü (UTC gece yarısı kayması olmasın)
  currency:"TRY",
   seller:{name:organization.name,legalName:profile?.legal_name,taxNumber:profile?.tax_number,taxOffice:profile?.tax_office,address:profile?.address,email:profile?.email},
   buyer:{name:String(job.customer_name||"Müşteri"),address:String(job.location||"")||null},
   lineDescription:`Servis hizmeti: ${job.title}`,netCents:Number(job.quote_cents),vatRate:vat,paidCents:Number(job.paid_cents),orderReference:String(job.order_number),
  });
  await addAudit(user.id,"export","einvoice_draft",String(job.id),`E-fatura taslağı indirildi (KDV %${vat}).`,organization.id);
  return new Response(xml,{headers:{"Content-Type":"application/xml; charset=utf-8","Content-Disposition":`attachment; filename="${String(job.order_number).replace(/[^A-Za-z0-9_-]/g,"")}-efatura-taslak.xml"`,"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Taslak hazırlanamadı."},{status:400});}
}
