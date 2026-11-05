import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
// Parola sıfırlama, e-posta doğrulama ve kayıt: denetim kaydı yazılamazsa işlem de uygulanmamalı. Yalnız sentetik veri.
const h=await createHarness('auth-atomic',{recovery:'./app/api/auth/recovery/route.ts',register:'./app/api/auth/register/route.ts',tokens:'./lib/account-tokens.ts'});
const {api,sql,req}=h;
await api.tokens.ensureAccountTokens();
await h.user('sim-user','a','member','employee');
const rows=t=>sql.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();
const failAudit=entity=>sql.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='${entity}' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`);
const dropFail=()=>sql.exec('DROP TRIGGER IF EXISTS fail_audit');
let tokenSequence=0;
async function addToken(purpose,email){const raw=(purpose==='reset'?'a':'b').repeat(56)+(++tokenSequence).toString(16).padStart(8,'0');sql.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,email,expires_at) VALUES(?,?,?,?,datetime('now','+1 hour'))").run(await api.tokens.tokenDigest(raw),'sim-user',purpose,email);return raw;}
const post=(route,body,user)=>api[route].POST(user?req(user,'/api/auth/'+route,'POST',body):new Request('https://test.local/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.local'},body:JSON.stringify(body)}));

test('reset: denetim kaydı yazılamazsa parola, oturumlar ve bağlantı aynen kalır',async()=>{
 const token=await addToken('reset','sim-user@example.test');
 const before={users:rows('users'),sessions:rows('sessions'),tokens:rows('account_tokens'),audit:rows('audit_logs')};
 failAudit('user');
 try{const r=await post('recovery',{action:'reset',token,password:'Synthetic-new-pass-789!'});assert.ok(r.status>=400);}finally{dropFail();}
 assert.deepEqual(rows('users'),before.users);assert.deepEqual(rows('sessions'),before.sessions);assert.deepEqual(rows('audit_logs'),before.audit);
 // Bağlantı tüketilmiş olabilir ama parola değişmemiştir; kullanıcı yeni bağlantı isteyebilir.
 const ok=await post('recovery',{action:'reset',token:await addToken('reset','sim-user@example.test'),password:'Synthetic-new-pass-789!'});
 assert.equal(ok.status,200,await ok.clone().text());
 assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='password_reset' AND entity_id='sim-user'").get().n,1);
 assert.equal(sql.prepare("SELECT count(*) n FROM sessions WHERE user_id='sim-user'").get().n,0);
});

test('verify: denetim kaydı yazılamazsa e-posta değişmez',async()=>{
 h.tokens['sim-user']=await api.auth.createSession('sim-user'); // reset tüm oturumları kapattı; yeni oturum
 const token=await addToken('verify','sim-new@example.test');
 const before=rows('users');
 failAudit('user');
 try{const r=await post('recovery',{action:'verify',token},'sim-user');assert.ok(r.status>=400);}finally{dropFail();}
 assert.deepEqual(rows('users'),before);
 const ok=await post('recovery',{action:'verify',token:await addToken('verify','sim-new@example.test')},'sim-user');
 assert.equal(ok.status,200,await ok.clone().text());
 assert.equal(sql.prepare("SELECT email FROM users WHERE id='sim-user'").get().email,'sim-new@example.test');
});

test('register: denetim kaydı yazılamazsa kullanıcı ve çalışma alanı oluşmaz',async()=>{
 const body={noticeVersion:'2026-10-10',accountType:'business',companyName:'SIM Servis',username:'sim-kayit',email:'sim-kayit@example.test',fullName:'SIM Kayıt',password:'Synthetic-only-123!'};
 const tables=['users','organizations','organization_members','organization_profiles','privacy_notice_receipts'];
 const before=tables.map(rows),audit=rows('audit_logs');
 failAudit('organization');
 let status;try{status=(await post('register',body)).status;}finally{dropFail();}
 assert.ok(status>=400);tables.forEach((t,i)=>assert.deepEqual(rows(t),before[i],t));assert.deepEqual(rows('audit_logs'),audit);
 const ok=await post('register',body);assert.equal(ok.status,201,await ok.clone().text());
 assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='register'").get().n,1);
});
