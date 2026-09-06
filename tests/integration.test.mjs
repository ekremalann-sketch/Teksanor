import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
function statement(query,values=[]){return {query,values,bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}};}
const db={prepare:statement,async exec(q){sql.exec(q)},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>{const stmt=sql.prepare(s.query);return stmt.columns().length?{results:stmt.all(...s.values),success:true}:{success:true,meta:{changes:Number(stmt.run(...s.values).changes)}}});sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__teksanorTestEnv={DB:db,UPLOADS:{head:async()=>null}};
await mkdir('tests/.tmp',{recursive:true});
await build({stdin:{contents:`export * as auth from './lib/auth.ts'; export * as database from './lib/db.ts'; export * as tenancy from './lib/tenancy.ts'; export * as access from './lib/access.ts'; export * as jobs from './app/api/service/jobs/route.ts';export * as approval from './app/api/service/approval/route.ts';export * as chat from './app/api/agents/chat/route.ts';export * as dashboard from './app/api/dashboard/route.ts';export * as workorder from './app/api/work-orders/[id]/route.ts';export * as mfa from './lib/mfa.ts';export * as recovery from './app/api/auth/recovery/route.ts';export * as account from './lib/account-tokens.ts';export * as health from './app/api/health/route.ts';`,resolveDir:process.cwd()},outfile:'tests/.tmp/integration.mjs',bundle:true,platform:'node',format:'esm',define:{__TEKSANOR_COMMIT__:'"test-sha"'},plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'runtime',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.__teksanorTestEnv'}));b.onResolve({filter:/^next\/server$/},()=>({path:'response',namespace:'response'}));b.onLoad({filter:/.*/,namespace:'response'},()=>({contents:'export class NextResponse extends Response {static json(data,init){return Response.json(data,init)}}'}));}}]});
const api=await import('./.tmp/integration.mjs');
await api.database.ensureSchema();
for(const id of ['boss','employee','finance','outsider']){
 const p=await api.auth.hashPassword('Test-password-123!');
 sql.prepare('INSERT INTO users(id,username,email,full_name,password_hash,password_salt,role) VALUES(?,?,?,?,?,?,?)').run(id,id,id+'@example.test',id,p.hash,p.salt,'user');
}
for(const id of ['a','b'])sql.prepare('INSERT INTO organizations(id,name,slug) VALUES(?,?,?)').run(id,id,id);
for(const [id,org,role,profile] of [['boss','a','owner','owner'],['employee','a','member','employee'],['finance','a','member','finance'],['outsider','b','owner','owner']]){
 sql.prepare('INSERT INTO organization_members(organization_id,user_id,role) VALUES(?,?,?)').run(org,id,role);
 sql.prepare('INSERT INTO organization_member_access(organization_id,user_id,access_profile) VALUES(?,?,?)').run(org,id,profile);
}
const tokens={};for(const id of ['boss','employee','finance','outsider'])tokens[id]=await api.auth.createSession(id);
function req(user,path,method='GET',body,org='a'){return new Request('https://test.local'+path,{method,headers:{Cookie:'teksanor_session='+tokens[user],'X-Organization-Id':org,'Content-Type':'application/json',Origin:'https://test.local'},body:body?JSON.stringify(body):undefined});}
async function json(response){return response.json()}
let job;
await test('schema initializes on a fresh database and includes project, service, MFA and access tables',()=>{for(const table of ['projects','service_jobs','user_security','organization_member_access'])assert.ok(sql.prepare("SELECT name FROM sqlite_master WHERE name=?").get(table));});
await test('cross-company organization selection is rejected',async()=>{const u=await api.auth.getCurrentUser(req('outsider','/api/work-orders'));await assert.rejects(()=>api.tenancy.requireOrganization(req('outsider','/api/work-orders'),u));});
await test('employee cannot call finance, HR or assistant APIs directly',async()=>{const u=await api.auth.getCurrentUser(req('employee','/api/agents/chat'));for(const path of ['treasury','payments','employees','agents/chat'])await assert.rejects(()=>api.tenancy.requireOrganization(req('employee','/api/'+path),u));});
await test('employee dashboard never returns financial summaries or other audit details',async()=>{sql.prepare("INSERT INTO organization_period_summaries(id,organization_id,period,total_debt) VALUES('sum','a','now',987654)").run();const d=await json(await api.dashboard.GET(req('employee','/api/dashboard')));assert.deepEqual(d.summaries,[]);assert.deepEqual(d.activity,[]);});
await test('service creation validates foreign assets and assigned users',async()=>{const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'x',assignedUserId:'outsider'}));assert.notEqual(r.status,201);});
await test('manager creates a service assigned to employee',async()=>{const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'Pompa bakımı',customerName:'Demo müşteri',assignedUserId:'employee'}));assert.equal(r.status,201);job=(await json(r)).id;});
await test('employee cannot create an arbitrary service',async()=>{assert.equal((await api.jobs.POST(req('employee','/api/service/jobs','POST',{action:'create',title:'Forbidden'}))).status,403)});
await test('employee list excludes private cost fields',async()=>{const d=await json(await api.jobs.GET(req('employee','/api/service/jobs')));assert.equal(d.jobs.length,1);assert.equal(d.jobs[0].labor_cents,undefined);});
await test('quote must be approved before work starts',async()=>{const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:1,stage:'in_progress'}));assert.equal(r.status,400);});
await test('price is validated and stale version rejected',async()=>{let r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:1,stage:'quoted',quote:1000,labor:100,parts:200,travel:50}));assert.equal(r.status,200);r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:1,stage:'quoted'}));assert.equal(r.status,409);});
let approvalToken;
await test('onay link contains scoped quote but never internal costs',async()=>{const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'share',id:job,version:2,purpose:'quote'}));assert.equal(r.status,200);approvalToken=new URLSearchParams((await json(r)).path.split('#')[1]).get('token');const d=await json(await api.approval.GET(new Request('https://test.local/api/service/approval',{headers:{Authorization:'Bearer '+approvalToken}})));assert.equal(d.quote,1000);assert.equal(d.labor_cents,undefined);});
await test('customer consent required; valid consent atomically advances stage',async()=>{const r=await api.approval.POST(new Request('https://test.local/api/service/approval',{method:'POST',headers:{Authorization:'Bearer '+approvalToken,Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({name:'Demo müşteri',consent:true})}));assert.equal(r.status,200);assert.equal(sql.prepare('SELECT stage FROM service_jobs WHERE id=?').get(job).stage,'quote_approved');});
await test('approved quote cannot be changed',async()=>{const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:3,quote:2500}));assert.equal(r.status,400);});
await test('old work-order API cannot bypass service approvals',async()=>{const r=await api.workorder.PUT(req('boss','/api/work-orders/'+job,'PUT',{status:'completed'}),{params:Promise.resolve({id:job})});assert.equal(r.status,409)});
await test('assigned employee may record work without editing internal costs',async()=>{const r=await api.jobs.POST(req('employee','/api/service/jobs','POST',{action:'update',id:job,version:3,stage:'in_progress',outcome:'Pompa kontrol edildi.',labor:999999}));assert.equal(r.status,200);assert.equal(sql.prepare('SELECT labor_cents FROM service_jobs WHERE id=?').get(job).labor_cents,10000);});
await test('empty completion reports rejected',async()=>{const r=await api.jobs.POST(req('employee','/api/service/jobs','POST',{action:'update',id:job,version:4,stage:'completed',outcome:''}));assert.equal(r.status,400)});
await test('missing API data never reported as zero by assistant',async()=>{const r=await api.chat.POST(req('boss','/api/agents/chat','POST',{agentName:'Yönetim',message:'Özet'}));assert.equal(r.status,200);const d=await json(r);assert.equal(d.source,'summary');assert.match(d.reply,/987654/);sql.exec('ALTER TABLE projects RENAME TO projects_unavailable');const bad=await api.chat.POST(req('boss','/api/agents/chat','POST',{agentName:'Yönetim',message:'Özet'}));assert.equal(bad.status,503);sql.exec('ALTER TABLE projects_unavailable RENAME TO projects');});
await test('chat is isolated per user and permission scope',async()=>{const scope=api.access.accessRules.owner.view.slice().sort().join(',');sql.prepare("INSERT INTO agent_chats(id,organization_id,agent_name,user_id,role,content,access_scope) VALUES('secret','a','Yönetim','outsider','user','PRIVATE OTHER CHAT',?)").run(scope);const d=await json(await api.chat.GET(req('boss','/api/agents/chat?agent=Y%C3%B6netim')));assert.ok(!JSON.stringify(d).includes('PRIVATE OTHER CHAT'));});
await test('MFA challenge has an attempt limit and cannot create a session on invalid codes',async()=>{const token=await api.mfa.beginMfaChallenge('boss');for(let i=0;i<7;i++)assert.equal(await api.mfa.consumeMfaChallenge(token,'000000'),null);assert.equal(sql.prepare('SELECT attempts FROM mfa_challenges WHERE user_id=?').get('boss').attempts,5)});
await test('ISO session expiry compares actual datetime rather than lexical text',async()=>{sql.prepare("UPDATE sessions SET expires_at=? WHERE user_id='finance'").run(new Date(Date.now()-60000).toISOString());assert.equal(await api.auth.getCurrentUser(req('finance','/api/dashboard')),null)});
await test('expired and replayed reset links cannot reset passwords',async()=>{await api.account.ensureAccountTokens();const token='a'.repeat(64),hash=await api.account.tokenDigest(token);sql.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES(?,'boss','reset','boss@example.test',datetime('now','-1 minute'))").run(hash);const r=await api.recovery.POST(req('boss','/api/auth/recovery','POST',{action:'reset',token,password:'another-password-123'}));assert.equal(r.status,400)});
await test('health detects unavailable DB/storage instead of only checking HTML',async()=>{assert.equal((await api.health.GET()).status,200);globalThis.__teksanorTestEnv.UPLOADS=undefined;assert.equal((await api.health.GET()).status,503)});
await test('work completion, customer acceptance and final collection finish the full service lifecycle',async()=>{
 let r=await api.jobs.POST(req('employee','/api/service/jobs','POST',{action:'update',id:job,version:4,stage:'completed',outcome:'Pompa kontrol edildi. Bağlantı sıkıldı.'}));assert.equal(r.status,200);
 r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'share',id:job,version:5,purpose:'completion'}));const t=new URLSearchParams((await json(r)).path.split('#')[1]).get('token');
 const consent=(yes)=>new Request('https://test.local/api/service/approval',{method:'POST',headers:{Authorization:'Bearer '+t,Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({name:'Demo müşteri',consent:yes})});
 assert.equal((await api.approval.POST(consent(false))).status,400);
 assert.equal((await api.approval.POST(consent(true))).status,200);
 assert.equal((await api.approval.POST(consent(true))).status,200);
 r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:6,stage:'collected',paid:500}));assert.equal(r.status,400);
 r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id:job,version:6,stage:'collected',paid:1000}));assert.equal(r.status,200);assert.equal(sql.prepare('SELECT stage FROM service_jobs WHERE id=?').get(job).stage,'collected');
});
await test('changing a draft invalidates previously issued approval links',async()=>{
 const created=await json(await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'İkinci servis'})));const id=created.id;
 await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id,version:1,stage:'quoted',quote:500}));
 const share=await json(await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'share',id,version:2})));const t=new URLSearchParams(share.path.split('#')[1]).get('token');
 await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id,version:2,quote:600}));
 assert.equal((await api.approval.GET(new Request('https://test.local/api/service/approval',{headers:{Authorization:'Bearer '+t}}))).status,410);
});
await test('valid password recovery is single use and keeps MFA setting',async()=>{
 const token='b'.repeat(64),hash=await api.account.tokenDigest(token);await api.account.ensureAccountTokens();
 sql.prepare("INSERT INTO user_security(user_id,mfa_enabled) VALUES('employee',1) ON CONFLICT(user_id) DO UPDATE SET mfa_enabled=1").run();
 sql.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES(?,'employee','reset','employee@example.test',datetime('now','+10 minutes'))").run(hash);
 const request=()=>req('employee','/api/auth/recovery','POST',{action:'reset',token,password:'recovered-password-123!'});
 assert.equal((await api.recovery.POST(request())).status,200);assert.equal((await api.recovery.POST(request())).status,400);
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id='employee'").get().n,0);assert.equal(sql.prepare("SELECT mfa_enabled FROM user_security WHERE user_id='employee'").get().mfa_enabled,1);
 const password=sql.prepare("SELECT password_salt,password_hash FROM users WHERE id='employee'").get();assert.ok(await api.auth.verifyPassword('recovered-password-123!',password.password_salt,password.password_hash));
});
await test('MFA uses authenticated encryption and rejects ciphertext tampering',async()=>{
 globalThis.__teksanorTestEnv.MFA_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64url');
 const secret=api.mfa.createTotpSecret();const encrypted=await api.mfa.encryptTotpSecret(secret);assert.notEqual(encrypted,secret);assert.equal(await api.mfa.decryptTotpSecret(encrypted),secret);
 const pieces=encrypted.split('.');const bytes=Buffer.from(pieces[2],'base64url');bytes[0]^=1;pieces[2]=bytes.toString('base64url');await assert.rejects(()=>api.mfa.decryptTotpSecret(pieces.join('.')));
 // RFC 6238 SHA-1 vector at 59 seconds: 94287082, truncated to 6 digits.
 assert.ok(await api.mfa.verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','287082',59000));
});
await test('database roundtrip preserves service records and foreign keys in an isolated restore',()=>{
 const copy=new DatabaseSync(':memory:');
 const tables=sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
 for(const t of tables){copy.exec(t.sql);const rows=sql.prepare(`SELECT * FROM ${t.name}`).all();for(const row of rows){const cols=Object.keys(row);copy.prepare(`INSERT INTO ${t.name}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).run(...Object.values(row));}}
 assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(copy.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM service_jobs').get().n,2);copy.close();
});
