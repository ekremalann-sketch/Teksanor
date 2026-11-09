// Servis parça ve depo hareketleri (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('service-parts',{jobs:'./app/api/service/jobs/route.ts',parts:'./app/api/service/parts/route.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');
await h.user('outsider','b','owner','owner');

let n=0;const rid=()=>`req-${Date.now()}-${++n}`;
const parts=(user,body,org='a')=>api.parts.POST(req(user,'/api/service/parts','POST',body,org));
const view=(user,jobId,org='a')=>api.parts.GET(req(user,'/api/service/parts?jobId='+encodeURIComponent(jobId),'GET',undefined,org));
const jobs=(user,body)=>api.jobs.POST(req(user,'/api/service/jobs','POST',body,'a'));
const stock=(id)=>sql.prepare('SELECT on_hand FROM service_parts WHERE id=?').get(id).on_hand;
const line=(job,part)=>({...(sql.prepare('SELECT reserved,used FROM service_job_parts WHERE job_id=? AND part_id=?').get(job,part)??{reserved:0,used:0})});
const job=(id)=>({...sql.prepare('SELECT stage,version,parts_cents FROM service_jobs WHERE id=?').get(id)});
const movements=(id)=>sql.prepare('SELECT count(*) AS c FROM service_part_movements WHERE job_id=?').get(id).c;

async function newJob(title){
 const r=await jobs('boss',{action:'create',title,assignedUserId:'tech'});assert.equal(r.status,201);return (await r.json()).id;
}
async function newPart(code,cost=2500,qty=10){
 const r=await parts('boss',{action:'part-create',code,name:'Sentetik '+code,unitCostCents:cost});assert.equal(r.status,201);
 const {id}=await r.json();
 assert.equal((await parts('boss',{action:'part-receive',partId:id,quantity:qty,requestId:rid()})).status,200);
 return id;
}

await test('parça ayrılır, kullanılan düşer, fazlası iade edilir; stok eksiye inmez',async()=>{
 const id=await newJob('Sentetik parça işi');const part=await newPart('SNT-001',2500,10);
 assert.equal(stock(part),10);
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:11,requestId:rid()})).status,409,'stoktan fazla ayrılamaz');
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:4,requestId:rid()})).status,200);
 assert.equal(stock(part),6);assert.deepEqual(line(id,part),{reserved:4,used:0});
 sql.prepare("UPDATE service_jobs SET stage='in_progress' WHERE id=?").run(id);
 assert.equal((await parts('tech',{action:'part-consume',jobId:id,partId:part,quantity:5,requestId:rid()})).status,409,'ayrılandan fazla kullanılamaz');
 const before=job(id);
 assert.equal((await parts('tech',{action:'part-consume',jobId:id,partId:part,quantity:3,requestId:rid()})).status,200);
 assert.deepEqual(line(id,part),{reserved:1,used:3});
 assert.equal(job(id).parts_cents,before.parts_cents+3*2500,'kullanım parça maliyetine eklenir');
 assert.equal(job(id).version,before.version+1);
 assert.equal((await parts('tech',{action:'part-return',jobId:id,partId:part,quantity:2,requestId:rid()})).status,409,'ayrılandan fazla iade edilemez');
 assert.equal((await parts('tech',{action:'part-return',jobId:id,partId:part,quantity:1,requestId:rid()})).status,200);
 assert.equal(stock(part),7);assert.deepEqual(line(id,part),{reserved:0,used:3});
});

await test('aynı gönderim iki stok hareketi üretmez (sıralı ve eşzamanlı)',async()=>{
 const id=await newJob('Sentetik tekrar işi');const part=await newPart('SNT-002',1000,5);
 const body={action:'part-reserve',jobId:id,partId:part,quantity:2,requestId:rid()};
 assert.equal((await parts('boss',body)).status,200);
 const again=await parts('boss',body);assert.equal(again.status,200);assert.equal((await again.json()).duplicate,true);
 assert.equal(stock(part),3);assert.equal(movements(id),1);
 const same={action:'part-reserve',jobId:id,partId:part,quantity:1,requestId:rid()};
 const both=await Promise.all([parts('boss',same),parts('boss',same)]);
 assert.deepEqual(both.map(r=>r.status),[200,200]);
 assert.equal(stock(part),2);assert.equal(movements(id),2);assert.deepEqual(line(id,part),{reserved:3,used:0});
 const race=await Promise.all([1,2,3].map(()=>parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:2,requestId:rid()})));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409,409],'son iki parça yalnız bir kez ayrılır');
 assert.equal(stock(part),0);
});

await test('yetki: teknisyen ayırma ve depo girişi yapamaz, başka işe ve başka firmaya erişemez',async()=>{
 const id=await newJob('Sentetik yetki işi');const part=await newPart('SNT-003',500,5);
 assert.equal((await parts('tech',{action:'part-reserve',jobId:id,partId:part,quantity:1,requestId:rid()})).status,403);
 assert.equal((await parts('tech',{action:'part-receive',partId:part,quantity:1,requestId:rid()})).status,403);
 assert.equal((await parts('tech',{action:'part-create',code:'X-1',name:'X',unitCostCents:1})).status,403);
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:2,requestId:rid()})).status,200);
 sql.prepare("UPDATE service_jobs SET stage='in_progress' WHERE id=?").run(id);
 assert.equal((await parts('other',{action:'part-consume',jobId:id,partId:part,quantity:1,requestId:rid()})).status,404,'atanmamış teknisyen');
 assert.equal((await view('other',id)).status,404);
 assert.equal((await parts('outsider',{action:'part-receive',partId:part,quantity:1,requestId:rid()},'b')).status,404,'başka firma parçası');
 assert.equal((await parts('outsider',{action:'part-reserve',jobId:id,partId:part,quantity:1,requestId:rid()},'b')).status,404);
 assert.equal((await view('outsider',id,'b')).status,404);
 const techView=await (await view('tech',id)).json();
 assert.equal(techView.lines.length,1);assert.equal('unit_cost_cents' in techView.lines[0],false,'teknisyen birim maliyeti görmez');
 assert.deepEqual(techView.stock,[]);
 const bossView=await (await view('boss',id)).json();
 assert.equal(bossView.lines[0].unit_cost_cents,500);assert.equal(bossView.movements.length,1);
 assert.equal(stock(part),3);
});

await test('aşama kuralları: onaysız işte kullanım yok, ayrılmış parça varken iş kapanmaz',async()=>{
 const id=await newJob('Sentetik kapanış işi');const part=await newPart('SNT-004',100,3);
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:2,requestId:rid()})).status,200);
 assert.equal((await parts('tech',{action:'part-consume',jobId:id,partId:part,quantity:1,requestId:rid()})).status,400,'teklif onayı öncesi kullanım yok');
 sql.prepare("UPDATE service_jobs SET stage='in_progress' WHERE id=?").run(id);
 assert.equal((await parts('tech',{action:'part-consume',jobId:id,partId:part,quantity:1,requestId:rid()})).status,200);
 let r=await jobs('boss',{action:'update',id,version:job(id).version,stage:'completed',outcome:'Sentetik işlem yapıldı'});
 assert.equal(r.status,400);assert.match((await r.json()).error,/ayrılan parçaları/);
 assert.equal((await parts('tech',{action:'part-return',jobId:id,partId:part,quantity:1,requestId:rid()})).status,200);
 r=await jobs('boss',{action:'update',id,version:job(id).version,stage:'completed',outcome:'Sentetik işlem yapıldı'});
 assert.equal(r.status,200);
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:1,requestId:rid()})).status,400,'kapanmış işe ayırma yok');
 assert.equal(stock(part),2);
});

await test('geçersiz girdiler reddedilir',async()=>{
 const id=await newJob('Sentetik girdi işi');const part=await newPart('SNT-005',100,3);
 for(const quantity of [0,-1,1.5,'abc',10001])assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity,requestId:rid()})).status,400);
 assert.equal((await parts('boss',{action:'part-reserve',jobId:id,partId:part,quantity:1,requestId:'kisa'})).status,400);
 assert.equal((await parts('boss',{action:'part-create',code:'SNT-005',name:'Tekrar',unitCostCents:1})).status,409);
 assert.equal((await parts('boss',{action:'part-create',code:'SNT-006',name:'Eksi',unitCostCents:-1})).status,400);
 assert.equal(stock(part),3);
});
