import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {auditStatement,createId,getDb} from "@/lib/db";
import {getMemberAccess} from "@/lib/access";
import {requireOrganization} from "@/lib/tenancy";
import {rejectCrossSiteMutation} from "@/lib/security";
import {ensureServiceColumns} from "@/lib/service";
import {buildFlow,EDITABLE_AFTER,loadFlowCustom,REQUIRED_FIELDS,sanitizeCustom} from "@/lib/flow-store";
import {TECHNICAL_SERVICE_FLOW} from "@/lib/flow-definition";

// T5: firmanın teknik servis akışını okur ve (yalnız yönetici) kaydeder.
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){const r=rejectCrossSiteMutation(request);return r||handle(request);}
async function handle(request:Request){
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 let organization;try{({organization}=await requireOrganization(request,user));}catch{return NextResponse.json({error:"Erişim reddedildi."},{status:403});}
 await ensureServiceColumns();const db=getDb();const access=await getMemberAccess(user,organization);
 const manage=["owner","company_admin","ceo","manager"].includes(access.profile);
 if(!access.viewModules.includes("work-orders"))return NextResponse.json({error:"Erişim reddedildi."},{status:403});
 const current=await loadFlowCustom(db,organization.id);
 const counts=(await db.prepare("SELECT stage,count(*) AS n FROM service_jobs WHERE organization_id=? GROUP BY stage").bind(organization.id).all<{stage:string;n:number}>()).results;
 const stageCounts=Object.fromEntries(counts.map(c=>[c.stage,Number(c.n)]));
 if(request.method==="GET")return NextResponse.json({manage,version:current.version,stageCounts,custom:current.custom,flow:buildFlow(current.custom),base:TECHNICAL_SERVICE_FLOW,editableAfter:EDITABLE_AFTER,requiredFields:REQUIRED_FIELDS});
 if(!manage)return NextResponse.json({error:"Akışı yalnız yönetici değiştirir."},{status:403});
 const body=await request.json().catch(()=>null) as {version?:unknown;custom?:unknown;moves?:unknown}|null;
 if(!body||Number(body.version)!==current.version)return NextResponse.json({error:"Akış başka biri tarafından değişti. Sayfayı yenileyin."},{status:409});
 const parsed=sanitizeCustom(body.custom);
 if(!parsed.ok)return NextResponse.json({error:parsed.errors[0],errors:parsed.errors},{status:400});
 // T14: kaldırılan özel aşamadaki işler, kullanıcının seçtiği aşamaya taşınır ve her iş geçmişe yazılır.
 const kept=new Set((parsed.value.extra??[]).map(e=>e.key));
 const newFlow=buildFlow(parsed.value);const valid=new Set(newFlow.stages.filter(x=>!x.closed).map(x=>x.key));
 const moves=(body.moves&&typeof body.moves==="object"?body.moves:{}) as Record<string,unknown>;
 const moveStatements=[];
 for(const e of current.custom.extra??[]){if(kept.has(e.key))continue;
  const ids=(await db.prepare("SELECT id FROM service_jobs WHERE organization_id=? AND stage=?").bind(organization.id,e.key).all<{id:string}>()).results;
  if(!ids.length)continue;
  const to=String(moves[e.key]??"");
  if(!valid.has(to))return NextResponse.json({error:`"${e.label}" aşamasında ${ids.length} iş var. Bu işlerin taşınacağı aşamayı seçin.`,affected:{[e.key]:ids.length}},{status:409});
  // Yalnız akış kaydı bu toplu işlemde yeni sürüme geçtiyse taşınır (eşzamanlı kayıtta hiçbir iş taşınmaz).
  moveStatements.push(db.prepare("UPDATE service_jobs SET stage=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE organization_id=? AND stage=? AND EXISTS(SELECT 1 FROM service_flows WHERE organization_id=? AND flow_key='teknik-servis' AND version=?)").bind(to,organization.id,e.key,organization.id,current.version+1));
  const toLabel=newFlow.stages.find(x=>x.key===to)?.label??to;
  for(const j of ids)moveStatements.push(auditStatement(user.id,"stage_moved","service_job",j.id,`Aşama kaldırıldı: "${e.label}" → "${toLabel}" (akış sürümü ${current.version+1})`,organization.id,true));
 }
 const json=JSON.stringify(parsed.value);
 const res=await db.batch([
  current.version===0
   ?db.prepare("INSERT INTO service_flows(organization_id,flow_key,version,custom_json,updated_by) VALUES(?,'teknik-servis',1,?,?) ON CONFLICT DO NOTHING RETURNING version").bind(organization.id,json,user.id)
   :db.prepare("UPDATE service_flows SET custom_json=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE organization_id=? AND flow_key='teknik-servis' AND version=? RETURNING version").bind(json,user.id,organization.id,current.version),
  ...moveStatements,
  db.prepare("INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,details,organization_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM service_flows WHERE organization_id=? AND flow_key='teknik-servis' AND version=?)").bind(createId("audit"),user.id,"update","service_flow","teknik-servis",`Akış güncellendi (sürüm ${current.version+1}): ${(parsed.value.extra??[]).length} ek aşama`,organization.id,organization.id,current.version+1),
 ]);
 const updated=(res[0] as {results?:{version:number}[]}).results?.[0];
 if(!updated)return NextResponse.json({error:"Akış başka biri tarafından değişti. Sayfayı yenileyin."},{status:409});
 return NextResponse.json({ok:true,version:updated.version,flow:buildFlow(parsed.value)});
}
