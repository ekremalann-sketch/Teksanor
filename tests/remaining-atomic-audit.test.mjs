import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
const paths=['work-orders','field-visits','maintenance','automations','payments'];
const modules={treasury:'./app/api/treasury/route.ts',expenses:'./app/api/expenses/route.ts',organization:'./app/api/organization/route.ts',notifications:'./app/api/notifications/route.ts',password:'./app/api/auth/password/route.ts',jobs:'./app/api/service/jobs/route.ts',checklists:'./app/api/service/checklists/route.ts',control:'./lib/automation-control.ts',rules:'./lib/automation-rules.ts',users:'./app/api/users/route.ts',member:'./app/api/users/[id]/route.ts',org:'./app/api/organizations/[id]/route.ts',approval:'./app/api/service/approval/route.ts',tokens:'./lib/account-tokens.ts'};
for(const p of paths){modules[p.replaceAll('-','_')]=`./app/api/${p}/route.ts`;modules[p.replaceAll('-','_')+'Id']=`./app/api/${p}/[id]/route.ts`;}
const h=await createHarness('remaining-atomic',modules),{api,sql,req,ctx}=h;
await api.rules.ensureRunsTable();await h.user('owner','a','owner','owner');await h.user('other','b','owner','owner');
const rows=t=>sql.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();
async function rollback(entity,tables,invoke){
 const before=tables.map(rows),audit=rows('audit_logs');
 sql.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='${entity}' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`);
 try{let rejected=false;try{const r=await invoke();rejected=r.status>=400;}catch{rejected=true;}assert.ok(rejected,'failure must not return success');tables.forEach((t,i)=>assert.deepEqual(rows(t),before[i],t));assert.deepEqual(rows('audit_logs'),audit);}
 finally{sql.exec('DROP TRIGGER fail_audit');}
}
const call=(p,method,body,id,user='owner',org='a')=>api[(id?p+'Id':p).replaceAll('-','_')][method](req(user,`/api/${p}${id?'/'+id:''}`,method,body,org),id?ctx(id):undefined);
const resources=[
 ['work-orders','work_orders','work_order',{title:'SIM work',department:'SIM'},{title:'SIM changed'}],
 ['field-visits','field_visits','field_visit',{visitorName:'Personel SIM',location:'SIM',visitDate:'2026-10-30'},{findings:'SIM checked'}],
 ['maintenance','maintenance_plans','maintenance_plan',{assetId:'sim-asset',title:'SIM plan',frequencyType:'month'},{status:'paused'}],
 ['automations','automation_rules','automation_rule',{name:'SIM rule',check:'work_orders_overdue',triggerType:'schedule'},{enabled:false}],
];
sql.prepare("INSERT INTO assets(id,organization_id,asset_code,name,created_by) VALUES('sim-asset','a','SIM-01','SIM equipment','owner')").run();
for(const[p,t,e,input,update]of resources){let id;
 await test(`${p} create rolls back on audit failure`,async()=>{await rollback(e,[t],()=>call(p,'POST',input));const r=await call(p,'POST',input);assert.ok(r.ok,await r.clone().text());id=(await r.json()).id;assert.ok(id);});
 await test(`${p} update rolls back; foreign organization blocked`,async()=>{await rollback(e,[t],()=>call(p,'PUT',update,id));const before=rows(t);assert.equal((await call(p,'PUT',update,id,'other','b')).status,404);assert.deepEqual(rows(t),before);assert.ok((await call(p,'PUT',update,id)).ok);});
 if(p==='maintenance')await test('maintenance completion rollback includes next date',()=>rollback(e,[t],()=>call(p,'PUT',{action:'complete'},id)));
 if(p==='automations')await test('manual automation audit failure rolls back claim, counter and notifications',async()=>{sql.exec("UPDATE automation_rules SET is_active=1 WHERE id='"+id+"'");await rollback(e,['automation_runs','automation_rules','notifications'],()=>call(p,'POST',{},id));});
 await test(`${p} delete rollback and no phantom audit`,async()=>{await rollback(e,[t],()=>call(p,'DELETE',undefined,id));const before=rows('audit_logs');assert.equal((await call(p,'DELETE',undefined,id,'other','b')).status,404);assert.equal((await call(p,'DELETE',undefined,'missing')).status,404);assert.deepEqual(rows('audit_logs'),before);assert.ok((await call(p,'DELETE',undefined,id)).ok);});
}
const payment={period:'2026-10',ownerName:'SIM',bankName:'SIM bank',accountName:'SIM account',totalDebt:100,paidAmount:0};
let payId;
await test('payment create and summaries rollback; duplicate creates no extra audit',async()=>{await rollback('payment_record',['payment_records','organization_period_summaries'],()=>call('payments','POST',payment));const r=await call('payments','POST',payment);assert.equal(r.status,201);payId=(await r.json()).id;const audits=rows('audit_logs');assert.equal((await(await call('payments','POST',payment)).json()).duplicate,true);assert.deepEqual(rows('audit_logs'),audits);});
for(const [name,method,body]of [['upsert','POST',{...payment,totalDebt:200,upsert:true}],['approve','PATCH',{action:'approve'}],['move period','PATCH',{...payment,period:'2026-11'}],['delete','DELETE',undefined]])await test(`payment ${name} failure preserves record/history/summaries`,()=>rollback('payment_record',['payment_records','organization_period_summaries'],()=>call('payments',method,body,method==='POST'?undefined:payId)));
await test('approve missing payment returns 404',async()=>assert.equal((await call('payments','PATCH',{action:'approve'},'missing')).status,404));
for(const [entity,table,body]of [['cash_balance','cash_balances',{action:'balance',accountName:'SIM',currency:'TRY',amount:100}],['manual_debt','manual_debts',{action:'debt',lenderName:'SIM',currency:'TRY',amount:100}],['reference_rates','organization_reference_rates',{action:'rates',gramGold:1,quarterGold:1,halfGold:1,fullGold:1,republicGold:1}]])await test(`treasury ${entity} rollback`,async()=>{await rollback(entity,[table],()=>call('treasury','POST',body));assert.ok((await call('treasury','POST',body)).ok);});
await test('expenses rollback includes period summary',async()=>{const b={period:'2026-10',ownerName:'SIM',category:'SIM',description:'SIM expense',amount:50};await rollback('expense',['expenses','organization_period_summaries'],()=>call('expenses','POST',b));assert.equal((await call('expenses','POST',b)).status,201);});
await test('organization profile rollback',async()=>{await rollback('organization_profile',['organization_profiles'],()=>call('organization','POST',{legalName:'SIM'}));assert.ok((await call('organization','POST',{legalName:'SIM'})).ok);});
await test('notification create/read rollback',async()=>{const b={title:'SIM notification',userId:'owner'};await rollback('notification',['notifications'],()=>call('notifications','POST',b));assert.ok((await call('notifications','POST',b)).ok);await rollback('notification',['notifications'],()=>call('notifications','PATCH',{}));assert.ok((await call('notifications','PATCH',{})).ok);});
await test('password failure preserves password and sessions',()=>rollback('user',['users','sessions'],()=>call('password','POST',{currentPassword:'Test-password-123!',newPassword:'Synthetic-new-password-456!'})));
await test('emergency stop and resume audit failure preserve previous state',async()=>{await rollback('automation_rule',['app_metadata'],()=>api.control.setAutomationPaused('a',true,'owner'));await api.control.setAutomationPaused('a',true,'owner');assert.equal(await api.control.isAutomationPaused('a'),true);await rollback('automation_rule',['app_metadata'],()=>api.control.setAutomationPaused('a',false,'owner'));await api.control.setAutomationPaused('a',false,'owner');assert.equal(await api.control.isAutomationPaused('a'),false);});
let jobId;
const jobCall=b=>call('jobs','POST',b);
await test('service create rolls back both tables',async()=>{const b={action:'create',title:'SIM service'};await rollback('service_job',['work_orders','service_jobs'],()=>jobCall(b));const r=await jobCall(b);assert.equal(r.status,201);jobId=(await r.json()).id;});
await test('service scheduling and stage rollback include linked work order',async()=>{for(const b of [{action:'schedule',scheduledDate:'2026-11-01'},{action:'update',stage:'quoted',quote:10}])await rollback('service_job',['work_orders','service_jobs','service_approvals'],()=>jobCall({...b,id:jobId,version:1}));assert.ok((await jobCall({action:'update',id:jobId,version:1,stage:'quoted',quote:10})).ok);});
await test('customer approval rollback includes token and job stage',async()=>{const shared=await jobCall({action:'share',id:jobId,version:2,purpose:'quote'});assert.ok(shared.ok);const {path}=await shared.json();const token=path.split('token=')[1];const invoke=()=>api.approval.POST(new Request('https://test.local/api/service/approval',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({name:'Musteri SIM',consent:true})}));await rollback('service_job',['service_jobs','service_approvals'],invoke);assert.ok((await invoke()).ok);});
await test('user creation rollback includes memberships and access',async()=>{const b={username:'sim-member',fullName:'SIM member',password:'Synthetic-only-123!',accessProfile:'employee'};await rollback('user',['users','organization_members','organization_member_access'],()=>call('users','POST',b));assert.equal((await call('users','POST',b)).status,201);});
await test('platform organization activation rollback includes sessions',async()=>{sql.exec("UPDATE users SET role='admin' WHERE id='owner'");await rollback('organization',['organizations','sessions'],()=>api.org.PATCH(req('owner','/api/organizations/b','PATCH',{active:false},'a'),ctx('b')));sql.exec("UPDATE users SET role='user' WHERE id='owner'");});
await test('member password reset audit failure preserves password and active sessions',async()=>{
 await h.user('sim-reset','a','member','employee');
 assert.equal(await api.auth.confirmRecentPassword(req('owner','/','GET',undefined,'a'),'owner','Test-password-123!'),true);
 await rollback('user',['users','sessions','mfa_challenges'],()=>api.member.PATCH(req('owner','/api/users/sim-reset','PATCH',{action:'reset-password'},'a'),ctx('sim-reset')));
});
await test('checklist create/archive/attach/answer each rolls back on audit failure',async()=>{
 const chk=b=>call('checklists','POST',b), input={action:'template.create',name:'SIM checklist',items:[{label:'SIM checked',type:'check',required:true}]};
 await rollback('checklist_template',['service_checklist_templates'],()=>chk(input));
 const created=await chk(input);assert.equal(created.status,201);const templateId=(await created.json()).id;
 const job=await jobCall({action:'create',title:'SIM checklist job'});const j=(await job.json()).id;
 await rollback('job_checklist',['service_job_checklists'],()=>chk({action:'attach',jobId:j,templateId}));
 const attached=await chk({action:'attach',jobId:j,templateId});assert.equal(attached.status,201);const c=(await attached.json()).checklists[0];
 await rollback('job_checklist',['service_job_checklists'],()=>chk({action:'answer',jobId:j,id:c.id,version:c.version,answers:{[c.items[0].id]:true}}));
 assert.ok((await chk({action:'answer',jobId:j,id:c.id,version:c.version,answers:{[c.items[0].id]:true}})).ok);
 await rollback('checklist_template',['service_checklist_templates'],()=>chk({action:'template.archive',id:templateId}));
 assert.ok((await chk({action:'template.archive',id:templateId})).ok);
});
await test('summary failure also rolls back payment and audit',async()=>{
 const before=rows('payment_records'),audit=rows('audit_logs');
 sql.exec("CREATE TRIGGER fail_summary BEFORE UPDATE ON organization_period_summaries BEGIN SELECT RAISE(ABORT,'synthetic summary'); END");
 try{await assert.rejects(()=>call('payments','POST',{...payment,accountName:'SIM summary failure'}));assert.deepEqual(rows('payment_records'),before);assert.deepEqual(rows('audit_logs'),audit);}finally{sql.exec('DROP TRIGGER fail_summary');}
});



