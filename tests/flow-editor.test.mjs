// T5: akış düzenleyici — firma kendi aşamasını ekler, adları değiştirir, zorunlu alan seçer; servis işleri bu akışla yürür.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('flow-editor',{jobs:'./app/api/service/jobs/route.ts',flow:'./app/api/service/flow/route.ts',store:'./lib/flow-store.ts',def:'./lib/flow-definition.ts'});
const {api,sql,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('rival','b','owner','owner');
const json=r=>r.json();
const jobs=(u,body,org='a')=>api.jobs.POST(req(u,'/api/service/jobs','POST',body,org));
const flowGet=(u,org='a')=>api.flow.GET(req(u,'/api/service/flow','GET',undefined,org));
const flowSave=(u,body,org='a')=>api.flow.POST(req(u,'/api/service/flow','POST',body,org));
const job=id=>sql.prepare('SELECT stage,version FROM service_jobs WHERE id=?').get(id);
const PARCA={labels:{in_progress:'Serviste'},extra:[{key:'ozel_parca_bekliyor',label:'Parça bekliyor',after:'in_progress',required:[]}],required:{in_progress:['scheduled_date']}};

test('akış birleştirme: eklenen aşama doğru yerde, geçişler ve tanım geçerli',()=>{
  const f=api.store.buildFlow(PARCA);
  assert.deepEqual(api.def.validateFlowDefinition(f),[]);
  const keys=f.stages.map(s=>s.key);
  assert.equal(keys.indexOf('ozel_parca_bekliyor'),keys.indexOf('in_progress')+1);
  assert.deepEqual(f.stages.find(s=>s.key==='in_progress').next,['ozel_parca_bekliyor','completed','cancelled']);
  assert.deepEqual(f.stages.find(s=>s.key==='ozel_parca_bekliyor').next,['completed','cancelled']);
  assert.equal(f.stages.find(s=>s.key==='in_progress').label,'Serviste');
  assert.ok(api.def.canTransition(f,'in_progress','ozel_parca_bekliyor',false),'teknisyen de parça beklemeye alabilir');
  assert.equal(api.store.sanitizeCustom({extra:[{key:'quoted',label:'X',after:'in_progress'}]}).ok,false,'sistem aşaması anahtarı kullanılamaz');
  assert.equal(api.store.sanitizeCustom({extra:[{key:'ozel_x',label:'X yap',after:'accepted'}]}).ok,false,'müşteri onayından sonra eklenemez');
});

await test('yönetici "Parça bekliyor" ekler; iş bu aşamaya girip çıkar; çalışan akışı değiştiremez; başka firma etkilenmez',async()=>{
  let g=await json(await flowGet('boss'));assert.equal(g.version,0);assert.equal(g.manage,true);
  assert.equal((await flowSave('tech',{version:0,custom:PARCA})).status,403);
  const s=await flowSave('boss',{version:0,custom:PARCA});assert.equal(s.status,200);assert.equal((await json(s)).version,1);
  assert.equal((await flowSave('boss',{version:0,custom:PARCA})).status,409,'eski sürümle kayıt reddedilir');
  const id=(await json(await jobs('boss',{action:'create',title:'Kombi',customerName:'Demo müşteri',assignedUserId:'tech',scheduledDate:'2026-11-20'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='in_progress',version=version+1 WHERE id=?").run(id);
  assert.equal((await jobs('tech',{action:'update',id,version:job(id).version,stage:'ozel_parca_bekliyor'})).status,200);
  assert.equal(job(id).stage,'ozel_parca_bekliyor');
  const list=await json(await api.jobs.GET(req('boss','/api/service/jobs','GET',undefined,'a')));
  assert.equal(list.stageLabels.ozel_parca_bekliyor,'Parça bekliyor');assert.ok(list.flow.stages.some(x=>x.key==='ozel_parca_bekliyor'));
  assert.equal((await jobs('tech',{action:'update',id,version:job(id).version,stage:'completed',outcome:'Parça takıldı'})).status,200);
  const rival=await json(await flowGet('rival','b'));assert.ok(!rival.flow.stages.some(x=>x.key==='ozel_parca_bekliyor'));
});

await test('zorunlu alan akıştan: planlanan tarih zorunluysa tarihsiz iş "Serviste"ye geçemez',async()=>{
  const id=(await json(await jobs('boss',{action:'create',title:'Klima',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='quote_approved',version=version+1 WHERE id=?").run(id);
  sql.prepare("UPDATE work_orders SET scheduled_date=NULL WHERE id=?").run(id);
  const r=await jobs('boss',{action:'update',id,version:job(id).version,stage:'in_progress'});
  assert.equal(r.status,400);assert.match((await json(r)).error,/Planlanan tarih gerekli/);
});

await test('içinde iş olan özel aşama kaldırılamaz',async()=>{
  const id=(await json(await jobs('boss',{action:'create',title:'Jeneratör',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='ozel_parca_bekliyor',version=version+1 WHERE id=?").run(id);
  const r=await flowSave('boss',{version:1,custom:{labels:PARCA.labels,extra:[]}});
  assert.equal(r.status,409);assert.match((await json(r)).error,/"Parça bekliyor" aşamasında 1 iş var/);
});
