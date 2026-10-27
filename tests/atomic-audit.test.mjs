import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHarness} from './helpers/harness.mjs';

const resources = [
 ['employees','employees','employee',{fullName:'Personel SIM-01',department:'SIM'}, {fullName:'Personel SIM-02'}],
 ['tasks','tasks','task',{title:'SIM görev',department:'SIM'}, {title:'SIM görev değişti'}],
 ['customers','customers','customer',{name:'Firma SIM-01'}, {name:'Firma SIM-02'}],
 ['procurement','procurement_requests','procurement_request',{title:'SIM satın alma',department:'SIM'}, {title:'SIM satın alma değişti'}],
 ['risks','risks','risk',{title:'SIM risk',department:'SIM'}, {title:'SIM risk değişti'}],
 ['assets','assets','asset',{name:'Ekipman SIM-01'}, {name:'Ekipman SIM-02'}],
];
const modules={projects:'./app/api/projects/route.ts',types:'./app/api/asset-types/route.ts',interactions:'./app/api/customers/[id]/interactions/route.ts',workflow:'./app/api/department-workflows/route.ts',setup:'./app/api/auth/mfa/setup/route.ts',mfa:'./lib/mfa.ts'};
for(const [path]of resources){modules[path]=`./app/api/${path}/route.ts`;modules[path+'Id']=`./app/api/${path}/[id]/route.ts`;}
const h=await createHarness('atomic-audit',modules);
const {api,sql,req,ctx}=h;
await h.user('owner','a','owner','owner');
await h.user('other','b','owner','owner');
const rows=table=>sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
const auditFailure=(entity,action)=>sql.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='${entity}' ${action?`AND NEW.action='${action}'`:''} BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`);
async function failsAtomically(entity,table,invoke){
 const before=rows(table), audits=rows('audit_logs');auditFailure(entity);
 try {const response=await invoke();assert.ok(response.status>=400);assert.deepEqual(rows(table),before);assert.deepEqual(rows('audit_logs'),audits);}
 finally{sql.exec('DROP TRIGGER fail_audit');}
}
const call=(path,method,body,id,user='owner',org='a')=>api[id?path+'Id':path][method](req(user,`/api/${path}${id?'/'+id:''}`,method,body,org),id?ctx(id):undefined);

await test('projects POST: denetim hatasında proje yazılmaz; başarı yanıtı korunur',async()=>{
 const input={name:'Proje SIM-01',department:'SIM'};
 await failsAtomically('project','projects',()=>api.projects.POST(req('owner','/api/projects','POST',input,'a')));
 const r=await api.projects.POST(req('owner','/api/projects','POST',input,'a'));assert.equal(r.status,200);assert.ok((await r.json()).id);
});

for(const[path,table,entity,input,update]of resources){
 let id;
 await test(`${path} POST: denetim hatası bütün oluşturmayı geri alır`,async()=>{
  // assets POST already used an atomic batch before this patch; keep it covered.
  await failsAtomically(entity,table,()=>call(path,'POST',input));
  const r=await call(path,'POST',input);assert.equal(r.status,200);id=(await r.json()).id;assert.ok(id);
  if(path==='assets')sql.prepare("INSERT INTO maintenance_plans(id,organization_id,asset_id,title,frequency_type,frequency_value,status,created_by) VALUES('plan_sim','a',?,'SIM bakım','month',1,'active','owner')").run(id);
 });
 await test(`${path} PUT: denetim hatası eski kaydı korur; firma ayrımı sürer`,async()=>{
  await failsAtomically(entity,table,()=>call(path,'PUT',update,id));
  const before=rows(table), audits=rows('audit_logs');
  assert.equal((await call(path,'PUT',update,id,'other','b')).status,404);
  assert.equal((await call(path,'PUT',update,id,'other','a')).status,403);
  assert.deepEqual(rows(table),before);assert.deepEqual(rows('audit_logs'),audits);
  const r=await call(path,'PUT',update,id);assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
 });
 await test(`${path} DELETE: denetim hatası silmeyi geri alır; olmayan/yabancı kayıt loglanmaz`,async()=>{
  const plans=path==='assets'?rows('maintenance_plans'):null;
  await failsAtomically(entity,table,()=>call(path,'DELETE',undefined,id));
  if(plans)assert.deepEqual(rows('maintenance_plans'),plans,'bağlı bakım da geri alınır');
  const audits=rows('audit_logs');assert.equal((await call(path,'DELETE',undefined,id,'other','b')).status,404);
  assert.equal((await call(path,'DELETE',undefined,'missing')).status,404);assert.deepEqual(rows('audit_logs'),audits);
  const r=await call(path,'DELETE',undefined,id);assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
  const after=rows('audit_logs');assert.equal((await call(path,'DELETE',undefined,id)).status,404);assert.deepEqual(rows('audit_logs'),after);
 });
}

await test('customers interactions POST: denetim hatası etkileşimi geri alır; yabancı müşteriye yazılmaz',async()=>{
 const created=await call('customers','POST',{name:'Firma SIM etkileşim'});const id=(await created.json()).id;
 const invoke=(user='owner',org='a')=>api.interactions.POST(req(user,`/api/customers/${id}/interactions`,'POST',{summary:'SIM görüşme'},org),ctx(id));
 await failsAtomically('customer_interaction','customer_interactions',()=>invoke());
 const before=rows('audit_logs');assert.equal((await invoke('other','b')).status,404);assert.deepEqual(rows('audit_logs'),before);
 assert.equal((await invoke()).status,200);
});

await test('asset-types DELETE: denetim hatası türü korur; varlık ve başka firma korunur',async()=>{
 const created=await api.types.POST(req('owner','/api/asset-types','POST',{name:'SIM silme türü'},'a'));const id=(await created.json()).id;
 const remove=(user='owner',org='a')=>api.types.DELETE(req(user,`/api/asset-types?id=${id}`,'DELETE',undefined,org));
 await failsAtomically('asset_type','asset_types',()=>remove());
 const before=rows('audit_logs');assert.equal((await remove('other','b')).status,404);assert.deepEqual(rows('audit_logs'),before);
 assert.equal((await remove()).status,200);const audits=rows('audit_logs');assert.equal((await remove()).status,404);assert.deepEqual(rows('audit_logs'),audits);
});

const workflow={action:'create',unit:'engineering',process:'Mühendislik işi',title:'SIM mühendislik',owner:'Personel SIM-01',note:'Kurgusal kapsam',approver:'owner'};
let workflowId;
await test('department-workflows create: denetim hatasında iş akışı açılmaz',async()=>{
 const invoke=()=>api.workflow.POST(req('owner','/api/department-workflows','POST',workflow,'a'));
 await failsAtomically('department-workflow','tasks',invoke);
 const r=await invoke();assert.equal(r.status,200);workflowId=(await r.json()).id;
});
await test('department-workflows advance: denetim hatası aşamayı geri alır; eski sürüm loglanmaz',async()=>{
 const input={action:'advance',unit:'engineering',id:workflowId,version:1,note:'SIM kanıt'};
 const invoke=()=>api.workflow.POST(req('owner','/api/department-workflows','POST',input,'a'));
 await failsAtomically('department-workflow','tasks',invoke);
 assert.equal((await invoke()).status,200);const before=rows('tasks'),audits=rows('audit_logs');
 assert.equal((await invoke()).status,409);assert.deepEqual(rows('tasks'),before);assert.deepEqual(rows('audit_logs'),audits);
});

await test('department-workflows: eşzamanlı aynı aşama yalnız bir kez ilerler ve yalnız bir denetim kaydı üretir',async()=>{
 const input={action:'advance',unit:'engineering',id:workflowId,version:2,note:'SIM eşzamanlı kanıt'};
 const before=rows('audit_logs').length;
 const responses=await Promise.all([1,2].map(()=>api.workflow.POST(req('owner','/api/department-workflows','POST',input,'a'))));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(rows('audit_logs').length,before+1);
 const row=sql.prepare('SELECT description FROM tasks WHERE id=?').get(workflowId);
 assert.equal(JSON.parse(row.description.slice('UNIT-WORKFLOW:'.length)).history.length,3);
});

// Ephemeral synthetic seed: do not put credential-looking constants in source/history.
const secret=api.mfa.createTotpSecret();
function totp(){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const message=Buffer.alloc(8);message.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(message).digest();
 return String((digest.readUInt32BE(digest[19]&15)&0x7fffffff)%1000000).padStart(6,'0');
}
for(const[action,audit]of [['defer','defer_mfa'],['recovery-codes','rotate_mfa_recovery_codes'],['disable','disable_mfa'],['confirm','enable_mfa']]){
 await test(`MFA ${action}: denetim hatası güvenlik ayarını, mevcut oturumları ve doğrulama isteğini korur`,async()=>{
  const user='mfa-'+action;await h.user(user,'a','owner','owner');
  globalThis.__teksanorTestEnv.MFA_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64url');
  globalThis.__teksanorTestEnv.MFA_MODE=action==='defer'?'required':'optional';
  const encrypted=await api.mfa.encryptTotpSecret(secret);
  sql.prepare("UPDATE user_security SET mfa_enabled=?,totp_secret=?,mfa_setup_secret=?,mfa_setup_expires_at=datetime('now','+10 minutes'),recovery_codes='[]' WHERE user_id=?")
   .run(['defer','confirm'].includes(action)?0:1,encrypted,encrypted,user);
  await api.mfa.beginMfaChallenge(user);
  const tables=['user_security','sessions','mfa_challenges'];const before=new Map(tables.map(t=>[t,rows(t)]));
  const invoke=()=>api.setup.POST(req(user,'/api/auth/mfa/setup','POST',{action,password:'Test-password-123!',code:totp()}));
  auditFailure('user_security',audit);
  try {let response;try{response=await invoke()}catch{}assert.ok(!response||response.status>=400);for(const t of tables)assert.deepEqual(rows(t),before.get(t),t);}
  finally {sql.exec('DROP TRIGGER fail_audit');}
  const response=await invoke();assert.equal(response.status,200,await response.clone().text());
  assert.equal(sql.prepare('SELECT count(*) n FROM audit_logs WHERE user_id=? AND action=?').get(user,audit).n,1);
  if(['confirm','disable'].includes(action)){assert.ok(response.headers.get('set-cookie'));assert.equal(sql.prepare('SELECT count(*) n FROM sessions WHERE user_id=?').get(user).n,1);}
  delete globalThis.__teksanorTestEnv.MFA_MODE;
 });
}
