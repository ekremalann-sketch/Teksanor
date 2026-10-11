// Örnek işletme: yalnız platform yöneticisi; parolalar yöneticiden; sentetik veri firmaya ayrı yazılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('demo-company',{demo:'./app/api/organizations/demo/route.ts',dep:'./app/api/departments/route.ts',jobs:'./app/api/service/jobs/route.ts'});
const {sql,api,req}=h;
await h.user('platform','a','owner','owner');sql.prepare("UPDATE users SET role='admin' WHERE id='platform'").run();
await h.user('boss','a','owner','owner');
// D1 ücretsiz plan: istek başına en fazla 50 sorgu. Her isteğin sorgu sayısını ölç.
const env=globalThis.__teksanorTestEnv;const realPrepare=env.DB.prepare;let queries=0;env.DB.prepare=(q)=>{queries++;return realPrepare(q);};
const post=async(u,body)=>{queries=0;const r=await api.demo.POST(req(u,'/api/organizations/demo','POST',body,'a'));post.last=queries;return r;};
const acc=(over={})=>[{accessProfile:'owner',username:'demo.sahip',password:'Ornek-Parola-123',...over},{accessProfile:'employee',roleKey:'ornek.teknisyen1',username:'demo.tek1',password:'Ornek-Parola-456'},{accessProfile:'hr',username:'demo.ik',password:''}];

await test('örnek işletme: firma sahibi bile oluşturamaz, yalnız platform yöneticisi',async()=>{
  assert.equal((await post('boss',{accounts:acc()})).status,403);
  assert.equal((await api.demo.GET(req('boss','/api/organizations/demo','GET',undefined,'a'))).status,403);
});
await test('örnek işletme: parola ve kullanıcı adı doğrulanır, sahip zorunlu',async()=>{
  assert.equal((await post('platform',{accounts:acc({password:'kisa'})})).status,400);
  assert.equal((await post('platform',{accounts:acc({username:'A B'})})).status,400);
  assert.equal((await post('platform',{accounts:[{accessProfile:'hr',username:'x.ik',password:'Ornek-Parola-789'}]})).status,400);
  assert.equal((await post('platform',{accounts:acc({username:'boss'})})).status,409,'kayıtlı kullanıcı adı');
});
let orgId;
await test('örnek işletme: firma, hesaplar ve sentetik kayıtlar oluşur; parola yanıtta dönmez; boş parolalı rol atlanır',async()=>{
  const r=await post('platform',{name:'Örnek Test Firması',accounts:acc()});
  assert.equal(r.status,201);const body=await r.json();orgId=body.organization.id;
  assert.ok(post.last<50,`hesap isteği ${post.last} sorgu`);
  assert.equal((await post('platform',{action:'seed',organizationId:orgId,part:'b'})).status,409,'parçalar sırayla');
  sql.exec("CREATE TRIGGER fail_demo_asset BEFORE INSERT ON assets BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
  assert.equal((await post('platform',{action:'seed',organizationId:orgId,part:'a'})).status,500);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM employees WHERE organization_id=?').get(orgId).n,0,'veri parçası yarım yazılmaz');
  sql.exec('DROP TRIGGER fail_demo_asset');
  for(const part of ['a','b','c']){const s=await post('platform',{action:'seed',organizationId:orgId,part});assert.equal(s.status,200,part);assert.ok(post.last<50,`${part}: ${post.last} sorgu`);console.log("# sorgu",part,post.last);Object.assign(body.counts??={}, (await s.json()).counts);}
  assert.equal((await post('platform',{action:'seed',organizationId:orgId,part:'c'})).status,200,'tekrar istek yeni kayıt eklemez');
  assert.equal((await post('platform',{action:'seed',organizationId:'a',part:'a'})).status,404,'örnek olmayan firmaya eklenmez');
  assert.equal((await post('boss',{action:'seed',organizationId:orgId,part:'a'})).status,403);
  assert.doesNotMatch(JSON.stringify(body),/Ornek-Parola/);
  assert.deepEqual(body.accounts.map(a=>a.username).sort(),['demo.sahip','demo.tek1']);
  assert.ok(body.counts['servis işi']>=10&&body.counts['birim süreci']>=25&&body.counts['çalışan']>=15);
  const owner=sql.prepare("SELECT access_profile FROM organization_member_access m JOIN users u ON u.id=m.user_id WHERE u.username='demo.sahip'").get();assert.equal(owner.access_profile,'owner');
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM work_orders WHERE organization_id='a'").get().n,0,'başka firmaya kayıt yazılmaz');
  const hash=sql.prepare("SELECT password_hash FROM users WHERE username='demo.sahip'").get().password_hash;assert.notEqual(hash,'Ornek-Parola-123');
});
await test('örnek işletme: oluşan sahip girip birimleri ve işleri görür; teknisyen yalnız kendi işlerini görür',async()=>{
  sql.prepare("INSERT INTO user_security(user_id,mfa_enabled) SELECT id,1 FROM users WHERE username='demo.sahip'").run();
  h.tokens['demo.sahip']=await api.auth.createSession(sql.prepare("SELECT id FROM users WHERE username='demo.sahip'").get().id);
  const tekId=sql.prepare("SELECT id FROM users WHERE username='demo.tek1'").get().id;h.tokens['demo.tek1']=await api.auth.createSession(tekId);
  const deps=await (await api.dep.GET(req('demo.sahip','/api/departments','GET',undefined,orgId))).json();
  assert.ok(deps.departments.find(d=>d.slug==='ik').open>=5);
  const all=(await (await api.jobs.GET(req('demo.sahip','/api/service/jobs','GET',undefined,orgId))).json()).jobs;assert.equal(all.length,10);
  const mine=(await (await api.jobs.GET(req('demo.tek1','/api/service/jobs','GET',undefined,orgId))).json()).jobs;
  assert.ok(mine.length>0&&mine.every(j=>j.assigned_user_id===tekId));
});

await test('örnek işletme: bir parça hata verirse o parçanın hiçbir kaydı kalmaz; liste yarım kurulumu gösterir ve devam edilir',async()=>{
  const r=await post('platform',{name:'Yarım Kalan Firma',accounts:acc({username:'yarim.sahip'}).map(a=>a.accessProfile==='employee'?{...a,username:'yarim.tek1'}:a)});
  assert.equal(r.status,201);const org2=(await r.json()).organization.id;
  assert.equal((await post('platform',{action:'seed',organizationId:org2,part:'a'})).status,200);
  // b parçası sırasında çakışma: kilit satırı önceden var (eşzamanlı ikinci istek gibi).
  sql.prepare("INSERT INTO app_metadata (key, value) VALUES (?, 'lock')").run(`demo_lock:${org2}:b`);
  assert.equal((await post('platform',{action:'seed',organizationId:org2,part:'b'})).status,409);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM work_orders WHERE organization_id=?").get(org2).n,0,'yarım iş kaydı yok');
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM tasks WHERE organization_id=?").get(org2).n,0,'yarım görev yok');
  const list=(await (await api.demo.GET(req('platform','/api/organizations/demo','GET',undefined,'a'))).json()).companies;
  const item=list.find(c=>c.organizationId===org2);assert.equal(item.complete,false);assert.equal(item.nextPart,'b');assert.equal(item.stepsDone,2);
  sql.prepare("DELETE FROM app_metadata WHERE key=?").run(`demo_lock:${org2}:b`);
  for(const part of ['b','c'])assert.equal((await post('platform',{action:'seed',organizationId:org2,part})).status,200,part);
  const done=(await (await api.demo.GET(req('platform','/api/organizations/demo','GET',undefined,'a'))).json()).companies.find(c=>c.organizationId===org2);
  assert.equal(done.complete,true);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM work_orders WHERE organization_id=?").get(org2).n,10);
});
