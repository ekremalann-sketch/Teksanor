import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHarness} from './helpers/harness.mjs';
// Canlıda bildirilen kilitlenme: zorunlu MFA ekranında "Panele dön" aynı sayfaya geri dönüyordu.
const h=await createHarness('mfa-lockout',{dashboard:'./app/api/dashboard/route.ts',setup:'./app/api/auth/mfa/setup/route.ts',challenge:'./app/api/auth/mfa/challenge/route.ts',mfa:'./lib/mfa.ts',session:'./app/api/auth/session/route.ts'});
const {api,req,sql}=h;
await h.user('owner','a','owner','owner');
const KEY=Buffer.alloc(32,7).toString('base64url');
function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',Buffer.from(bytes)).update(msg).digest();const o=d[19]&15;return String((d.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
const dash=()=>api.dashboard.GET(req('owner','/api/dashboard','GET',undefined,'a'));

await test('MFA anahtarı olmadan ve eski erteleme kaydıyla parola oturumu paneli açar',async()=>{
 delete globalThis.__teksanorTestEnv.MFA_ENCRYPTION_KEY;
 sql.prepare("UPDATE user_security SET mfa_enabled=0 WHERE user_id='owner'").run();
 assert.equal((await dash()).status,200);
 const s=await (await api.setup.GET(req('owner','/api/auth/mfa/setup'))).json();
 assert.equal(s.required,false);assert.equal(s.canDefer,false);
 // Varsayılan "optional" modda kimse zorlanmaz; erteleme gereksizdir (409), panel açık kalır.
 assert.equal((await api.setup.POST(req('owner','/api/auth/mfa/setup','POST',{action:'defer'}))).status,409);
 globalThis.__teksanorTestEnv.MFA_ENCRYPTION_KEY=KEY;
 sql.prepare("UPDATE user_security SET mfa_deferred_until=datetime('now','+14 days') WHERE user_id='owner'").run();
 assert.equal((await dash()).status,200);
});

let codes;
await test('Kurulum kurtarma kodlarını bir kez döndürür ve yalnız özetlerini saklar',async()=>{
 const start=await api.setup.POST(req('owner','/api/auth/mfa/setup','POST',{action:'start',password:'Test-password-123!'}));
 assert.equal(start.status,200);const {secret}=await start.json();
 const bad=await api.setup.POST(req('owner','/api/auth/mfa/setup','POST',{code:'000000'}));assert.equal(bad.status,400);assert.match((await bad.json()).error,/saat/);
 const r=await api.setup.POST(req('owner','/api/auth/mfa/setup','POST',{code:totp(secret)}));
 assert.equal(r.status,200);codes=(await r.json()).recoveryCodes;
 assert.equal(codes.length,10);assert.ok(codes.every(c=>/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)));
 const stored=sql.prepare("SELECT recovery_codes,mfa_deferred_until FROM user_security WHERE user_id='owner'").get();
 assert.ok(!stored.recovery_codes.includes(codes[0].replace('-','')));assert.equal(stored.mfa_deferred_until,null);
});

await test('Kurtarma kodu girişte bir kez çalışır; tekrar kullanılamaz',async()=>{
 let token=await api.mfa.beginMfaChallenge('owner');
 const ok=await api.challenge.POST(req('owner','/api/auth/mfa/challenge','POST',{challengeToken:token,code:codes[0].toLowerCase()}));
 assert.equal(ok.status,200);assert.ok(ok.headers.get('set-cookie'));assert.equal((await ok.json()).recoveryCodesLeft,9);
 token=await api.mfa.beginMfaChallenge('owner');
 const again=await api.challenge.POST(req('owner','/api/auth/mfa/challenge','POST',{challengeToken:token,code:codes[0]}));
 assert.equal(again.status,401);
 assert.ok(sql.prepare("SELECT 1 FROM audit_logs WHERE action='mfa_recovery_code_used'").get());
});

await test('Parola denemeleri MFA kovasını tüketmez (ayrı sayaç)',async()=>{
 for(let i=0;i<15;i++){try{await api.auth.enforceAuthRateLimit(req('owner','/'),'login')}catch{}}
 await assert.doesNotReject(()=>api.auth.enforceAuthRateLimit(req('owner','/'),'mfa'));
});

await test('Kurucu yönetici parolası yenilendiğinde MFA korunur',async()=>{
 const old=await api.auth.hashPassword('Old-password-123!');
 sql.prepare("INSERT INTO users(id,username,email,full_name,password_hash,password_salt,role) VALUES('adm','admin2','admin2@internal.teksanor','Admin',?,?,'admin')").run(old.hash,old.salt);
 sql.prepare("INSERT INTO user_security(user_id,mfa_enabled,totp_secret,recovery_codes) VALUES('adm',1,'v1.x.y','[]')").run();
 globalThis.__teksanorTestEnv.ADMIN2_PASSWORD='Fresh-password-789!';
 await api.auth.loginWithUsername({username:'admin2',password:'Fresh-password-789!'});
 const row=sql.prepare("SELECT mfa_enabled,totp_secret,recovery_codes FROM user_security WHERE user_id='adm'").get();
 assert.equal(row.mfa_enabled,1);assert.equal(row.totp_secret,"v1.x.y");assert.equal(row.recovery_codes,"[]");
});
