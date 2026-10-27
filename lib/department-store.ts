import {getDb,type Database} from "./db";
// Production migrations own the schema. No CREATE/ALTER on a user request.
export async function ensureDepartmentTables(db:Database=getDb()){
 await db.prepare("SELECT id FROM department_processes LIMIT 0").all();
 await db.prepare("SELECT id FROM department_process_events LIMIT 0").all();
}
