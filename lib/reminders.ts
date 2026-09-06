import {getDb} from "./db";
import {canView,type MemberAccess} from "./access";
export async function createDueNotifications(orgId:string,userId:string,access:MemberAccess){
 const db=getDb();const manager=["owner","company_admin","ceo","manager"].includes(access.profile);
 const records:{id:string;title:string;due:string;type:string}[]=[];
 if(canView(access,"work-orders")){
  const rows=await db.prepare(`SELECT s.id,w.title,w.scheduled_date AS due FROM service_jobs s JOIN work_orders w ON w.id=s.id
   WHERE s.organization_id=? AND s.stage NOT IN ('accepted','collected','cancelled') AND w.scheduled_date<=date('now','+2 days')
   AND (?=1 OR s.assigned_user_id=?) LIMIT 100`).bind(orgId,manager?1:0,userId).all<{id:string;title:string;due:string}>();
  records.push(...rows.results.map(r=>({...r,type:"work_order"})));
 }
 if(canView(access,"maintenance")){
  const rows=await db.prepare("SELECT id,title,next_due_date AS due FROM maintenance_plans WHERE organization_id=? AND status='active' AND next_due_date<=date('now','+2 days') LIMIT 100").bind(orgId).all<{id:string;title:string;due:string}>();
  records.push(...rows.results.map(r=>({...r,type:"maintenance_plan"})));
 }
 for(const r of records)await db.prepare(`INSERT OR IGNORE INTO notifications(id,organization_id,user_id,title,body,type,entity_type,entity_id)
  VALUES(?,?,?,?,?,'warning',?,?)`).bind(`due:${orgId}:${userId}:${r.type}:${r.id}:${r.due}`,orgId,userId,`${r.type==="work_order"?"Servis":"Bakım"} tarihi: ${r.due}`,r.title,r.type,r.id).run();
}
