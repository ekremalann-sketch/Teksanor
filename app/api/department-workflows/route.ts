import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganization, canManageOrganization } from "@/lib/tenancy";
import { requireModuleAccess, errorStatus } from "@/lib/access";
import { getDb, createId, addAudit } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { optionalCalendarDate } from "@/lib/dates";
import { UNITS, WORKFLOW_PREFIX, readUnitRecord, advanceUnitRecord } from "@/lib/department-workflows";
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
async function handle(request:Request,write:boolean){
 if(write){const denied=rejectCrossSiteMutation(request);if(denied)return denied;}
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 try {
 const {organization}=await requireOrganization(request,user);const payload=write?await request.json():{};
 const unit=UNITS.find(u=>u.id===(write?payload.unit:new URL(request.url).searchParams.get("unit")));if(!unit)throw new Error("Birim seçin.");
 await requireModuleAccess(user,organization,unit.module,write?"edit":"view");const db=getDb();
 if(!write){const rows=await db.prepare("SELECT * FROM tasks WHERE organization_id = ? AND department = ? AND description LIKE ? ORDER BY created_at DESC").bind(organization.id,unit.name,WORKFLOW_PREFIX+"%").all();
 const approvers=await db.prepare("SELECT u.id, u.full_name FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.active=1 AND m.role IN ('owner','admin')").bind(organization.id).all();
 return NextResponse.json({items:rows.results.map((v:any)=>({...v,workflow:readUnitRecord(v.description)})),approvers:approvers.results},{headers:{"cache-control":"no-store"}});}
 const note=String(payload.note||"").trim().slice(0,1500);
 if(payload.action==="create"){
 const process=String(payload.process||"");if(!unit.processes[process])throw new Error("Süreç seçin.");const title=String(payload.title||"").trim().slice(0,180);const owner=String(payload.owner||"").trim().slice(0,100);if(!title||!owner||!note)throw new Error("Başlık, sorumlu ve kapsam / başarı ölçütü gerekli.");
 const approver=String(payload.approver||"");const valid=await db.prepare("SELECT user_id FROM organization_members WHERE organization_id=? AND user_id=? AND active=1 AND role IN ('owner','admin')").bind(organization.id,approver).first();if(!valid)throw new Error("Firma yöneticisi onay sorumlusu seçin.");
 const id=createId("unit");const record={unit:unit.id,process,stage:0,note,approver,history:[{at:new Date().toISOString(),actor:user.id,action:"create",note}]};
 await db.prepare("INSERT INTO tasks (id,organization_id,title,description,department,assignee_name,status,priority,due_date,created_by) VALUES (?,?,?,?,?,?,'open','normal',?,?)").bind(id,organization.id,title,WORKFLOW_PREFIX+JSON.stringify(record),unit.name,owner,optionalCalendarDate(payload.dueDate),user.id).run();await addAudit(user.id,"create","department-workflow",id,unit.name+" süreci açıldı.",organization.id);return NextResponse.json({ok:true,id});
 }
 const row=await db.prepare("SELECT * FROM tasks WHERE id=? AND organization_id=? AND department=?").bind(payload.id,organization.id,unit.name).first<any>();const record=readUnitRecord(row?.description);if(!row||!record) return NextResponse.json({error:"Süreç bulunamadı."},{status:404});
 if(payload.version!==record.history.length)return NextResponse.json({error:"Süreç değişti; yenileyin."},{status:409});
 const next=advanceUnitRecord(record,String(payload.action),user.id,canManageOrganization(user,organization),note);const done=next.stage===unit.processes[next.process].length-1;
 const result=await db.prepare("UPDATE tasks SET description=?,status=?,completed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND description=?").bind(WORKFLOW_PREFIX+JSON.stringify(next),done?"done":"in_progress",done?new Date().toISOString():null,row.id,organization.id,row.description).run();if(!result.meta?.changes)return NextResponse.json({error:"Kayıt değişti; yenileyin."},{status:409});
 await addAudit(user.id,String(payload.action),"department-workflow",row.id,unit.name+" süreci güncellendi.",organization.id);return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:"İşlem yapılamadı."},{status:errorStatus(e)});}
}
