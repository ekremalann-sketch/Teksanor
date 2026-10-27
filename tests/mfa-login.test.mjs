import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHarness} from './helpers/harness.mjs';
const h=await createHarness('mfa-login',{login:'./app/api/auth/login/route.ts',challenge:'./app/api/auth/mfa/challenge/route.ts',mfa:'./lib/mfa.ts',session:'./app/api/auth/session/route.ts',setup:'./app/api/auth/mfa/setup/route.ts',dashboard:'./app/api/dashboard/route.ts'});
await h.user('owner','a','owner','owner');
const env=globalThis.__teksanorTestEnv;
env.MFA_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64url');
const PASS='Test-password-123!';
let ipCounter=0;
// Her giriş farklı IP'den: IP kovası bu testlerde sonucu etkilemesin (IP kovası ayrıca test edilir).
const login=(username,password=PASS,ip=`198.51.100.${(ipCounter++%200)+1}`)=>{const r=h.req('owner','/api/auth/login','POST',{username,password});const headers=new Headers(r.headers);headers.delete('Cookie');headers.set('cf-connecting-ip',ip);return h.api.login.POST(new Request(r.url,{method:'POST',headers,body:JSON.stringify({username,password})}));};
const totpNow=()=>{const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac('sha1','12345678901234567890').update(msg).digest();const offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');};
const enableMfa=async()=>{const cipher=await h.api.mfa.encryptTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');h.sql.prepare("UPDATE user_security SET mfa_enabled=1,totp_secret=?,last_totp_counter=-1 WHERE user_id='owner'").run(cipher);};
const disableMfa=()=>h.sql.prepare("UPDATE user_security SET mfa_enabled=0,totp_secret=NULL,mfa_deferred_until=NULL WHERE user_id='owner'").run();

await test('optional (varsayılan): MFA kurmamış firma sahibi parolayla girer, kuruluma zorlanmaz',async()=>{
 delete env.MFA_MODE;disableMfa();
 const r=await login('owner');
 assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie'));assert.equal((await r.json()).mfaRequired,false);
 const s=await (await h.api.session.GET(h.req('owner','/api/auth/session'))).json();
 assert.equal(s.mfaEnrollmentRequired,false);assert.equal(s.mfaMode,'optional');
 assert.equal((await h.api.dashboard.GET(h.req('owner','/api/dashboard','GET',undefined,'a'))).status,200);
 const st=await (await h.api.setup.GET(h.req('owner','/api/auth/mfa/setup'))).json();
 assert.equal(st.required,false);assert.equal(st.passwordOnly,false);assert.equal(st.canDefer,false);
});

await test('optional: MFA etkin hesapta parola tek başına oturum açmaz; kod sonrası oturum verilir, kod tekrar kullanılamaz',async()=>{
 delete env.MFA_MODE;await enableMfa();
 const r=await login('owner');
 assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null,'MFA bekleyen girişte çerez verilmemeli');
 const state=await r.json();assert.equal(state.mfaRequired,true);assert.ok(state.challengeToken);
 const code=totpNow();
 const wrong=await h.api.challenge.POST(h.req('owner','/api/auth/mfa/challenge','POST',{challengeToken:state.challengeToken,code:code==='000000'?'111111':'000000'}));
 assert.equal(wrong.status,401);assert.equal(wrong.headers.get('set-cookie'),null);
 const ok=await h.api.challenge.POST(h.req('owner','/api/auth/mfa/challenge','POST',{challengeToken:state.challengeToken,code:code.slice(0,3)+' '+code.slice(3)}));
 assert.equal(ok.status,200);assert.ok(ok.headers.get('set-cookie'));
 const next=await h.api.mfa.beginMfaChallenge('owner');
 assert.equal(await h.api.mfa.consumeMfaChallenge(next,code),null);
 assert.ok(h.sql.prepare("SELECT 1 FROM audit_logs WHERE user_id='owner' AND action IN ('login','new_device_login')").get(),'yeni giriş denetim kaydı yazılmalı');
});

await test('off: MFA ne zorlanır ne sorulur (önerilmez)',async()=>{
 env.MFA_MODE='off';await enableMfa();
 const r=await login('owner');
 assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie'));assert.equal((await r.json()).mfaRequired,false);
 const st=await (await h.api.setup.GET(h.req('owner','/api/auth/mfa/setup'))).json();assert.equal(st.passwordOnly,true);
 delete env.MFA_MODE;
});

await test('required: MFA kurmamış yönetici panele kurulum yönlendirmesiyle (428) karşılaşır; bir kez ertelenebilir',async()=>{
 env.MFA_MODE='required';disableMfa();
 const s=await (await h.api.session.GET(h.req('owner','/api/auth/session'))).json();assert.equal(s.mfaEnrollmentRequired,true);
 assert.equal((await h.api.dashboard.GET(h.req('owner','/api/dashboard','GET',undefined,'a'))).status,428);
 const st=await (await h.api.setup.GET(h.req('owner','/api/auth/mfa/setup'))).json();assert.equal(st.required,true);assert.equal(st.canDefer,true);
 assert.equal((await h.api.setup.POST(h.req('owner','/api/auth/mfa/setup','POST',{action:'defer'}))).status,200);
 assert.equal((await h.api.dashboard.GET(h.req('owner','/api/dashboard','GET',undefined,'a'))).status,200);
 h.sql.prepare("UPDATE user_security SET mfa_deferred_until=datetime('now','-1 day') WHERE user_id='owner'").run();
 assert.equal((await h.api.setup.POST(h.req('owner','/api/auth/mfa/setup','POST',{action:'defer'}))).status,403,'erteleme yalnız bir kez');
 // Anahtar tanımlı değilse zorunlu modda bile kilitlenme olmaz.
 const key=env.MFA_ENCRYPTION_KEY;delete env.MFA_ENCRYPTION_KEY;
 assert.equal((await h.api.dashboard.GET(h.req('owner','/api/dashboard','GET',undefined,'a'))).status,200);
 env.MFA_ENCRYPTION_KEY=key;delete env.MFA_MODE;
});

await test('MFA kurulumu yalnız son beş dakika içinde parolası doğrulanmış aynı oturumda tekrar parola istemez',async()=>{
 disableMfa();
 assert.equal(await h.api.auth.hasRecentPasswordProof(h.req('owner','/'), 'owner'),false);
 await h.api.auth.recordSessionPasswordProof(h.tokens.owner,'owner');
 assert.equal(await h.api.auth.hasRecentPasswordProof(h.req('owner','/'), 'owner'),true);
 assert.equal(await h.api.auth.hasRecentPasswordProof(h.req('owner','/'), 'other'),false);
 const r=await h.api.setup.POST(h.req('owner','/api/auth/mfa/setup','POST',{action:'start'}));assert.equal(r.status,200);assert.ok((await r.json()).otpAuthUri);
 h.sql.prepare("UPDATE session_password_proofs SET verified_at=datetime('now','-6 minutes')").run();
 assert.equal(await h.api.auth.hasRecentPasswordProof(h.req('owner','/'),'owner'),false);
 const denied=await h.api.setup.POST(h.req('owner','/api/auth/mfa/setup','POST',{action:'start'}));assert.equal(denied.status,403);
 assert.equal(h.sql.prepare("SELECT mfa_enabled FROM user_security WHERE user_id='owner'").get().mfa_enabled,0);
});

await test('Hesap başına 10 başarısız deneme kilitler (IP değişse de); başarılı girişler IP kovasını tüketmez',async()=>{
 disableMfa();h.sql.prepare("DELETE FROM auth_attempts").run();
 // Aynı IP'den 70 başarılı giriş: IP sınırı (60 başarısız) tetiklenmez.
 for(let i=0;i<70;i++){const r=await login('owner',PASS,'203.0.113.9');assert.equal(r.status,200,`başarılı giriş ${i}`);}
 // Hesap başına: farklı IP'lerden 10 yanlış parola sonrası doğru parola da 429.
 for(let i=0;i<10;i++)assert.equal((await login('owner','Wrong-password-123!',`192.0.2.${i+1}`)).status,401);
 const locked=await login('owner',PASS,'192.0.2.200');assert.equal(locked.status,429);assert.equal(locked.headers.get('set-cookie'),null);
 // Başka hesap aynı IP'den etkilenmez.
 assert.notEqual((await login('baskasi','Wrong-password-123!','192.0.2.1')).status,429);
 h.sql.prepare("DELETE FROM auth_attempts").run();
});

await test('IP başına 60 başarısız deneme sınırı (farklı hesap adlarıyla)',async()=>{
 for(let i=0;i<60;i++)assert.equal((await login(`yok${i}`,'Wrong-password-123!','203.0.113.50')).status,401);
 assert.equal((await login('owner',PASS,'203.0.113.50')).status,429);
 h.sql.prepare("DELETE FROM auth_attempts").run();
});

await test('Yanlış parola ve oturumsuz panel erişimi reddedilir',async()=>{const r=await login('owner','Wrong-password-123!');assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);const q=await h.api.session.GET(new Request('https://teksanor.example/api/auth/session'));assert.equal((await q.json()).authenticated,false);});
