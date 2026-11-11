// Gün sonu kasa (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('service-cash',{jobs:'./app/api/service/jobs/route.ts',payments:'./app/api/service/payments/route.ts',cash:'./app/api/service/cash/route.ts',cashLib:'./lib/service-cash.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('outsider','b','owner','owner');
const today=new Date().toISOString().slice(0,10);
let n=0;const rid=()=>`kasa-${Date.now()}-${++n}`;
const job=id=>({...sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id)});
const pay=(id,amountCents,method,action='payment-add',extra={})=>api.payments.POST(req('boss','/api/service/payments','POST',{action,jobId:id,version:job(id).version,amountCents,method,requestId:rid(),...extra},'a'));
const cash=(user,q='',org='a')=>api.cash.GET(req(user,'/api/service/cash?bugun='+today+'&'+q,'GET',undefined,org));
const expense=(body,user='boss')=>api.cash.POST(req(user,'/api/service/cash','POST',{spentOn:today,method:'nakit',requestId:rid(),...body},'a'));
async function newJob(title){const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title,assignedUserId:'tech'},'a'));const {id}=await r.json();sql.prepare("UPDATE service_jobs SET stage='in_progress',quote_cents=500000 WHERE id=?").run(id);return id;}

await test('yönteme ve kişiye göre tahsilat, iade düşülür, gider ve net hesaplanır',async()=>{
 const a=await newJob('Sentetik kasa 1'),b=await newJob('Sentetik kasa 2');
 assert.equal((await pay(a,40000,'nakit')).status,200);
 assert.equal((await pay(a,60000,'kart')).status,200);
 assert.equal((await pay(b,25000,'havale')).status,200);
 assert.equal((await pay(b,5000,'havale','payment-refund',{reason:'Sentetik kısmi iade'})).status,200);
 assert.equal((await expense({description:'Sentetik yakıt',amountCents:3000})).status,201);
 const d=await (await cash('boss')).json();
 assert.equal(d.collectedCents,120000);assert.equal(d.expenseCents,3000);assert.equal(d.netCents,117000);
 const m=Object.fromEntries(d.byMethod.map(x=>[x.method,x]));
 assert.equal(m.nakit.netCents,37000);assert.equal(m.kart.netCents,60000);assert.equal(m.havale.inCents,25000);assert.equal(m.havale.outCents,5000);
 assert.equal(d.byActor.length,1);assert.equal(d.byActor[0].netCents,120000);
});

await test('CSV indirme; formül enjeksiyonu engellenir',async()=>{
 assert.equal((await expense({description:'=HYPERLINK("x")',amountCents:100})).status,201);
 const r=await cash('boss','format=csv');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/csv/);
 const text=await r.text();assert.match(text,/Tarih;Tür;İş no/);assert.match(text,/'=HYPERLINK/);assert.ok(!/;=HYPERLINK/.test(text));
});

await test('yetki, girdi doğrulama ve tekrar koruması',async()=>{
 assert.equal((await cash('tech')).status,403);
 assert.equal((await expense({description:'x',amountCents:100},'tech')).status,403);
 const other=await (await cash('outsider','',  'b')).json();assert.equal(other.collectedCents,0,'başka firma kasası boş');
 assert.equal((await expense({description:'',amountCents:100})).status,400);
 assert.equal((await expense({description:'x',amountCents:-1})).status,400);
 assert.equal((await expense({description:'x',amountCents:100,method:'kripto'})).status,400);
 assert.equal((await cash('boss','donem=ozel&baslangic=2026-02-30&bitis=2026-03-01')).status,400);
 assert.equal((await cash('boss','donem=ozel&baslangic=2024-01-01&bitis=2026-01-01')).status,400,'1 yıldan uzun');
 const body={description:'Sentetik tekrar',amountCents:500,requestId:rid()};
 await expense(body);const again=await expense(body);assert.equal((await again.json()).duplicate,true);
 assert.equal(sql.prepare("SELECT count(*) c FROM service_expenses WHERE description='Sentetik tekrar'").get().c,1);
});

await test('dönem hesapları',async()=>{
 const {cashRange}=api.cashLib;
 assert.deepEqual(cashRange('hafta',null,null,'2026-11-11'),{from:'2026-11-05',to:'2026-11-11'});
 assert.deepEqual(cashRange('ay',null,null,'2026-11-11'),{from:'2026-11-01',to:'2026-11-11'});
 assert.equal(cashRange('ozel','2026-11-12','2026-11-11','2026-11-11'),null);
});
