// Servis tahsilat hareketleri (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('service-payments',{jobs:'./app/api/service/jobs/route.ts',payments:'./app/api/service/payments/route.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('outsider','b','owner','owner');

let n=0;const rid=()=>`pay-${Date.now()}-${++n}`;
const job=(id)=>({...sql.prepare('SELECT stage,version,paid_cents,quote_cents FROM service_jobs WHERE id=?').get(id)});
const post=(user,body,org='a')=>api.payments.POST(req(user,'/api/service/payments','POST',body,org));
const pay=(id,amountCents,extra={})=>post('boss',{action:'payment-add',jobId:id,version:job(id).version,amountCents,method:'havale',requestId:rid(),...extra});
const list=(user,id,org='a')=>api.payments.GET(req(user,'/api/service/payments?jobId='+encodeURIComponent(id),'GET',undefined,org));
const rows=(id)=>sql.prepare('SELECT kind,amount_cents FROM service_payments WHERE job_id=? ORDER BY created_at,rowid').all(id).map(r=>({...r}));

async function newJob(title,quote=100000,stage='in_progress'){
 const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title,assignedUserId:'tech'},'a'));
 const {id}=await r.json();sql.prepare('UPDATE service_jobs SET stage=?,quote_cents=? WHERE id=?').run(stage,quote,id);return id;
}

await test('1.000 TL işe 400 ve 600 TL iki ayrı tahsilat; fazlası reddedilir; ödenen toplam hareketlerle tutar',async()=>{
 const id=await newJob('Sentetik iki tahsilat');
 assert.equal((await pay(id,40000)).status,200);
 assert.equal((await pay(id,70000)).status,400,'teklifi aşan tahsilat');
 assert.equal((await pay(id,60000,{method:'nakit'})).status,200);
 assert.equal(job(id).paid_cents,100000);
 assert.deepEqual(rows(id),[{kind:'payment',amount_cents:40000},{kind:'payment',amount_cents:60000}]);
 const view=await (await list('boss',id)).json();
 assert.equal(view.payments.length,2);assert.equal(view.paidCents,100000);assert.equal(view.legacyCents,0);
 const history=sql.prepare('SELECT before_cents,after_cents FROM service_payment_history WHERE job_id=? ORDER BY version').all(id).map(r=>({...r}));
 assert.deepEqual(history,[{before_cents:0,after_cents:40000},{before_cents:40000,after_cents:100000}]);
 const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id,version:job(id).version,stage:'completed',outcome:'Sentetik'},'a'));
 assert.equal(r.status,200);
});

await test('iade ve iptal gerekçe ister, önceki kaydı silmez, iki kez uygulanmaz',async()=>{
 const id=await newJob('Sentetik iade');
 assert.equal((await pay(id,40000)).status,200);
 assert.equal((await pay(id,60000)).status,200);
 const first=sql.prepare("SELECT id FROM service_payments WHERE job_id=? AND amount_cents=40000").get(id).id;
 assert.equal((await post('boss',{action:'payment-void',jobId:id,version:job(id).version,paymentId:first,requestId:rid()})).status,400,'gerekçesiz iptal');
 assert.equal((await post('boss',{action:'payment-refund',jobId:id,version:job(id).version,amountCents:10000,method:'havale',requestId:rid()})).status,400,'gerekçesiz iade');
 const voidBody=()=>({action:'payment-void',jobId:id,version:job(id).version,paymentId:first,reason:'Sentetik hatalı giriş',requestId:rid()});
 assert.equal((await post('boss',voidBody())).status,200);
 assert.equal(job(id).paid_cents,60000);
 assert.equal((await post('boss',voidBody())).status,409,'aynı kayıt ikinci kez iptal edilmez');
 assert.equal((await post('boss',{action:'payment-refund',jobId:id,version:job(id).version,amountCents:70000,method:'havale',reason:'Sentetik',requestId:rid()})).status,400,'tahsil edilenden fazla iade');
 assert.equal((await post('boss',{action:'payment-refund',jobId:id,version:job(id).version,amountCents:10000,method:'havale',reason:'Sentetik kısmi iade',requestId:rid()})).status,200);
 assert.equal(job(id).paid_cents,50000);
 assert.deepEqual(rows(id).map(r=>r.kind),['payment','payment','void','refund'],'önceki hareketler korunur');
 const view=await (await list('boss',id)).json();
 assert.equal(view.payments.find(p=>p.id===first).voided,1);
});

await test('aynı gönderim ve eşzamanlı istekler tek hareket üretir',async()=>{
 const id=await newJob('Sentetik tekrar');
 const body={action:'payment-add',jobId:id,version:job(id).version,amountCents:30000,method:'kart',requestId:rid()};
 const both=await Promise.all([post('boss',body),post('boss',body)]);
 assert.deepEqual(both.map(r=>r.status),[200,200]);
 assert.equal(rows(id).length,1);assert.equal(job(id).paid_cents,30000);
 const v=job(id).version;
 const race=await Promise.all([1,2].map(()=>post('boss',{action:'payment-add',jobId:id,version:v,amountCents:10000,method:'kart',requestId:rid()})));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409],'aynı sürüm üzerinden yalnız biri yazılır');
 assert.equal(job(id).paid_cents,40000);
 const first=sql.prepare("SELECT id FROM service_payments WHERE job_id=? ORDER BY created_at,rowid").get(id).id;
 const w=job(id).version;
 const voids=await Promise.all([1,2].map(()=>post('boss',{action:'payment-void',jobId:id,version:w,paymentId:first,reason:'Sentetik',requestId:rid()})));
 assert.deepEqual(voids.map(r=>r.status).sort(),[200,409]);
 assert.equal(job(id).paid_cents,10000);
});

await test('yetki ve aşama: teknisyen ve başka firma erişemez; onaysız veya kapanmış işte tahsilat yok',async()=>{
 const id=await newJob('Sentetik yetki');
 assert.equal((await post('tech',{action:'payment-add',jobId:id,version:job(id).version,amountCents:100,method:'nakit',requestId:rid()})).status,403);
 assert.equal((await list('tech',id)).status,403);
 assert.equal((await post('outsider',{action:'payment-add',jobId:id,version:job(id).version,amountCents:100,method:'nakit',requestId:rid()},'b')).status,404);
 assert.equal((await list('outsider',id,'b')).status,404);
 const early=await newJob('Sentetik erken',100000,'quoted');
 assert.equal((await pay(early,100)).status,400);
 const closed=await newJob('Sentetik kapalı',100000,'collected');
 assert.equal((await pay(closed,100)).status,400);
 assert.equal((await post('boss',{action:'payment-add',jobId:id,version:job(id).version,amountCents:100,method:'bitcoin',requestId:rid()})).status,400);
 assert.equal((await post('boss',{action:'payment-add',jobId:id,version:job(id).version,amountCents:1.5,method:'nakit',requestId:rid()})).status,400);
 assert.equal((await post('boss',{action:'payment-add',jobId:id,version:job(id).version-1,amountCents:100,method:'nakit',requestId:rid()})).status,409);
 assert.equal(rows(id).length,0);
});

await test('toplam alanından girilen artış harekete dönüşür, azaltma iade/iptal ister',async()=>{
 const id=await newJob('Sentetik eski yol');
 const upd=(paid)=>api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id,version:job(id).version,paid},'a'));
 assert.equal((await upd(250)).status,200);
 assert.deepEqual(rows(id),[{kind:'payment',amount_cents:25000}]);
 const r=await upd(100);assert.equal(r.status,400);assert.match((await r.json()).error,/iade veya tahsilat iptali/);
 assert.equal(job(id).paid_cents,25000);
});
