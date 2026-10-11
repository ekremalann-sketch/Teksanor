import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {getDb} from "@/lib/db";
import {requireOrganization} from "@/lib/tenancy";
import {getMemberAccess} from "@/lib/access";
export async function GET(request:Request){try{
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 const {organization}=await requireOrganization(request,user),access=await getMemberAccess(user,organization),db=getDb();
 const chips:{label:string;count:number;href:string}[]=[];const count=async(q:string,args:unknown[])=>Number((await db.prepare(q).bind(...args).first<{n:number}>())?.n||0);
 if(access.viewModules.includes("work-orders")){
 const manage=["owner","company_admin","ceo","manager"].includes(access.profile);
 const own=" AND (?=1 OR s.assigned_user_id=?)",params=[organization.id,manage?1:0,user.id];
 const late=await count("SELECT count(*) n FROM service_jobs s JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id WHERE s.organization_id=? AND s.stage IN ('requested','quoted','quote_approved','in_progress') AND date(w.scheduled_date)<date('now')"+own,params);
 if(late)chips.push({label:"Geciken servis",count:late,href:"/servis?view=overdue"});
 const approvals=await count("SELECT count(*) n FROM service_jobs s WHERE s.organization_id=? AND s.stage IN ('quoted','completed')"+own,params);if(approvals)chips.push({label:"Müşteri onayı bekliyor",count:approvals,href:"/servis?view=all&stage=approval"});
 }
 if(access.viewModules.includes("tasks")){const n=await count("SELECT count(*) n FROM tasks WHERE organization_id=? AND status NOT IN ('done','cancelled') AND date(due_date)<date('now')",[organization.id]);if(n)chips.push({label:"Süresi geçen görev",count:n,href:"/panel#panel=tasks&filter=overdue"});}
 if(access.viewModules.includes("risks")){const n=await count("SELECT count(*) n FROM risks WHERE organization_id=? AND impact='critical' AND status IN ('identified','mitigating')",[organization.id]);if(n)chips.push({label:"Kritik açık risk",count:n,href:"/panel#panel=risks&filter=critical"});}
 return NextResponse.json({chips:chips.slice(0,4)},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Öncelik bilgisi alınamadı."},{status:403});}}
