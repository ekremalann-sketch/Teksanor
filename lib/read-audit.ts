import { getDb } from "./db";
export async function recordRead(userId:string,organizationId:string,resource:string) {
 const hour=new Date().toISOString().slice(0,13);
 const key=JSON.stringify([userId,organizationId,resource,hour]);
 await getDb().prepare("INSERT OR IGNORE INTO read_audits(audit_key,user_id,organization_id,resource,hour) VALUES(?,?,?,?,?)").bind(key,userId,organizationId,resource,hour).run();
}
