// T12: akışta onay adımı. Onaysız iş sonraki aşamaya geçemez; "açan kişi onaylayamaz" seçeneği; kişiye atanmış onay.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('stage-approval',{jobs:'./app/api/service/jobs/route.ts',flow:'./app/api/service/flow/route.ts'});
const {api,sql,req}=h;
await h.user('boss','a','owner','owner');await h.user('mgr','a','member','manager');
await h.user('tech','a','member','employee');await h.user('chief','a','member','employee');
const json=r=>r.json();
const post=(u,body)=>api.jobs.POST(req(u,'/api/service/jobs','POST',body,'a'));
const list=async u=>(await json(await api.jobs.GET(req(u,'/api/service/jobs','GET',undefined,'a')))).jobs;
const ver=id=>sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id).version;
const stageOf=id=>sql.prepare('SELECT stage FROM service_jobs WHERE id=?').get(id).stage;
const ONAY={extra:[{key:'ozel_parca_onay',label:'Ek parça onayı',after:'in_progress',approval:{by:'manager',notCreator:true}}]};
let job;

await test('kurulum: onay aşaması kaydedilir ve akışta görünür',async()=>{
  const r=await api.flow.POST(req('boss','/api/service/flow','POST',{version:0,custom:ONAY},'a'));assert.equal(r.status,200);
  job=(await json(await post('boss',{action:'create',title:'Kombi',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='ozel_parca_onay' WHERE id=?").run(job);
  const g=await json(await api.flow.GET(req('boss','/api/service/flow','GET',undefined,'a')));
  assert.deepEqual(g.flow.stages.find(s=>s.key==='ozel_parca_onay').approval,{by:'manager',notCreator:true});
});

await test('onaysız iş sonraki aşamaya geçemez (saha da yönetici de)',async()=>{
  for(const u of ['tech','mgr']){
    const r=await post(u,{action:'update',id:job,version:ver(job),stage:'completed',outcome:'Parça takıldı'});
    assert.equal(r.status,400);assert.match((await json(r)).error,/onayı verilmeden iş ileri geçemez/);
  }
  assert.equal(stageOf(job),'ozel_parca_onay');
});

await test('yetkisiz kişi ve işi açan kişi onaylayamaz; başka yönetici onaylar',async()=>{
  assert.equal((await post('tech',{action:'approve-stage',id:job,version:ver(job)})).status,403);
  const r=await post('boss',{action:'approve-stage',id:job,version:ver(job)});assert.equal(r.status,403);assert.match((await json(r)).error,/İşi açan kişi/);
  assert.equal((await list('boss')).find(j=>j.id===job).can_approve,false);
  assert.equal((await list('mgr')).find(j=>j.id===job).can_approve,true);
  assert.equal((await post('mgr',{action:'approve-stage',id:job,version:ver(job)})).status,200);
  assert.equal((await post('mgr',{action:'approve-stage',id:job,version:ver(job)})).status,409,'ikinci onay yok');
  assert.equal((await list('tech')).find(j=>j.id===job).stage_approved,true);
  assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='approve_stage' AND entity_id=?").get(job).n,1);
});

await test('onaydan sonra iş değişirse yeniden onay gerekir; onaylı iş ileri geçer',async()=>{
  sql.prepare('UPDATE service_jobs SET version=version+1 WHERE id=?').run(job);
  let r=await post('tech',{action:'update',id:job,version:ver(job),stage:'completed',outcome:'Parça takıldı'});assert.equal(r.status,400);
  assert.equal((await post('mgr',{action:'approve-stage',id:job,version:ver(job)})).status,200);
  r=await post('tech',{action:'update',id:job,version:ver(job),stage:'completed',outcome:'Parça takıldı'});assert.equal(r.status,200);
  assert.equal(stageOf(job),'completed');
});

await test('onay beklerken iptal edilebilir',async()=>{
  const id=(await json(await post('boss',{action:'create',title:'Klima',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='ozel_parca_onay' WHERE id=?").run(id);
  assert.equal((await post('boss',{action:'update',id,version:ver(id),stage:'cancelled'})).status,200);
});

await test('kişiye atanmış onay: o kişi işi görür ve yalnız onaylayabilir',async()=>{
  const g=await json(await api.flow.GET(req('boss','/api/service/flow','GET',undefined,'a')));
  let r=await api.flow.POST(req('boss','/api/service/flow','POST',{version:g.version,custom:{extra:[{...ONAY.extra[0],approval:{by:'user',userId:'yok',notCreator:true}}]}},'a'));
  assert.equal(r.status,400,'firmada olmayan kişi seçilemez');
  r=await api.flow.POST(req('boss','/api/service/flow','POST',{version:g.version,custom:{extra:[{...ONAY.extra[0],approval:{by:'user',userId:'chief',notCreator:true}}]}},'a'));assert.equal(r.status,200);
  const id=(await json(await post('boss',{action:'create',title:'Pompa',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  sql.prepare("UPDATE service_jobs SET stage='ozel_parca_onay' WHERE id=?").run(id);
  const seen=(await list('chief')).find(j=>j.id===id);assert.ok(seen,'onaylayacak kişi listede görür');assert.equal(seen.can_approve,true);
  assert.equal((await post('mgr',{action:'approve-stage',id,version:ver(id)})).status,403,'yönetici de olsa seçilen kişi değil');
  assert.equal((await post('chief',{action:'update',id,version:ver(id),stage:'completed',outcome:'x'})).status,404,'onaylayan başka işlem yapamaz');
  assert.equal((await post('chief',{action:'approve-stage',id,version:ver(id)})).status,200);
  assert.equal((await post('tech',{action:'update',id,version:ver(id),stage:'completed',outcome:'Tamam'})).status,200);
});

test('ekran: Onayla düğmesi, onay bekleniyor bilgisi ve düzenleyicide onay seçenekleri',()=>{
  const page=readFileSync('app/servis/page.tsx','utf8');
  assert.match(page,/action:"approve-stage"/);assert.match(page,/Onay bekleniyor\. Bu onayı siz veremezsiniz\./);
  const ed=readFileSync('app/servis/akis/page.tsx','utf8');
  assert.match(ed,/İşi açan kişi onaylayamaz/);assert.match(ed,/Herhangi bir yönetici/);
});
