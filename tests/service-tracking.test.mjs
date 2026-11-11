// Müşteri takip bağlantısı (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('service-tracking',{jobs:'./app/api/service/jobs/route.ts',tracking:'./app/api/service/tracking/route.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');await h.user('outsider','b','owner','owner');
const create=(user,jobId,org='a')=>api.tracking.POST(req(user,'/api/service/tracking','POST',{jobId},org));
const view=code=>api.tracking.GET(new Request('https://test.local/api/service/tracking?code='+encodeURIComponent(code)));
async function newJob(){const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'Sentetik kombi bakımı',customerName:'Örnek Müşteri',assignedUserId:'tech'},'a'));return (await r.json()).id;}

await test('yönetici ve atanmış teknisyen bağlantı üretir; müşteri üyeliksiz görür, iç bilgi sızmaz',async()=>{
 const id=await newJob();
 sql.prepare("UPDATE service_jobs SET stage='in_progress',quote_cents=200000,paid_cents=50000,labor_cents=90000,parts_cents=30000 WHERE id=?").run(id);
 const r=await create('boss',id);assert.equal(r.status,200);const {code,path}=await r.json();
 assert.match(path,/^\/servis\/takip#kod=/);assert.match(code,/^[A-Za-z0-9_-]{32}$/);
 assert.equal(sql.prepare('SELECT count(*) c FROM service_tracking WHERE code_hash=?').get(code).c,0,'kodun kendisi saklanmaz');
 const v=await view(code);assert.equal(v.status,200);const d=await v.json();
 assert.equal(d.status,'Teknisyen çalışıyor');assert.equal(d.remainingCents,150000);assert.equal(d.title,'Sentetik kombi bakımı');
 const raw=JSON.stringify(d);for(const secret of ['labor','parts','cost','tech','assigned','90000','30000'])assert.ok(!raw.includes(secret),secret);
 assert.equal(v.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await create('tech',id)).status,200,'atanmış teknisyen');
});

await test('yeni bağlantı eskisini geçersiz kılar; geçersiz kodlar ve yetkisiz kişiler reddedilir',async()=>{
 const id=await newJob();
 const first=(await (await create('boss',id)).json()).code;
 const second=(await (await create('boss',id)).json()).code;
 assert.equal((await view(first)).status,404);assert.equal((await view(second)).status,200);
 for(const bad of ['', 'kisa', 'x'.repeat(32), "' OR 1=1 --".padEnd(32,'a')])assert.equal((await view(bad)).status,404);
 assert.equal((await create('other',id)).status,404,'atanmamış teknisyen');
 assert.equal((await create('outsider',id,'b')).status,404,'başka firma');
 const anon=await api.tracking.POST(new Request('https://test.local/api/service/tracking',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.local'},body:JSON.stringify({jobId:id})}));
 assert.equal(anon.status,401);
});

await test('takip sayfası arama motoruna kapalı ve kod adres çubuğunun # kısmından okunur',()=>{
 assert.match(readFileSync('app/servis/takip/layout.tsx','utf8'),/index: false/);
 assert.match(readFileSync('app/servis/takip/page.tsx','utf8'),/location\.hash/);
});
