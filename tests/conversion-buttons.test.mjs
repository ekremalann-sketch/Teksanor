// T8: dönüştürme düğmeleri — talep → teklif, tamamla → tahsil et. Hiçbir adımda açılır listeden aşama seçilmez.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('conversion-buttons',{jobs:'./app/api/service/jobs/route.ts',ui:'./lib/service-ui.ts'});
const {api,sql,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');
const json=r=>r.json();
const post=(u,body)=>api.jobs.POST(req(u,'/api/service/jobs','POST',body,'a'));
const job=id=>sql.prepare('SELECT stage,version,quote_cents,paid_cents FROM service_jobs WHERE id=?').get(id);

test('her yönetici adımında tek düğme var (bilgi yazısı değil)',()=>{
  for(const [stage,label,to] of [['requested','Teklife dönüştür','quoted'],['quote_approved','İşe başla','in_progress'],['in_progress','İşi tamamla','completed'],['accepted','Tahsil et','collected']]){
    const s=api.ui.nextStep(stage,true);assert.equal(s.kind,'stage',stage);assert.equal(s.label,label);assert.equal(s.stage,to);
  }
  for(const stage of ['quoted','completed'])assert.equal(api.ui.nextStep(stage,true).kind,'share');
});

await test('talep → teklif: tutarsız teklife dönüştürülemez; tutarla tek çağrıda dönüşür',async()=>{
  const id=(await json(await post('boss',{action:'create',title:'Kombi bakımı',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  const bad=await post('boss',{action:'update',id,version:1,stage:'quoted'});assert.equal(bad.status,400);assert.match((await json(bad)).error,/Önce teklif tutarını girin/);
  assert.equal((await post('boss',{action:'update',id,version:1,stage:'quoted',quote:1500})).status,200);assert.equal(job(id).stage,'quoted');
});

await test('tamamla → tahsil et: tek düğme kalan tutarı tahsil edip işi kapatır; eksik tahsilat reddedilir',async()=>{
  const id=(await json(await post('boss',{action:'create',title:'Klima',customerName:'Demo müşteri',assignedUserId:'tech'}))).id;
  assert.equal((await post('boss',{action:'update',id,version:1,stage:'quoted',quote:2000})).status,200);
  sql.prepare("UPDATE service_jobs SET stage='accepted',outcome='Bakım yapıldı',version=version+1 WHERE id=?").run(id);
  const v=job(id).version;
  assert.equal((await post('boss',{action:'update',id,version:v,stage:'collected'})).status,400,'tahsilat girilmeden kapanmaz');
  assert.equal((await post('boss',{action:'update',id,version:v,stage:'collected',paid:2000})).status,200);
  assert.deepEqual({...job(id)},{stage:'collected',version:v+1,quote_cents:200000,paid_cents:200000});
});

test('servis ekranında aşama seçme listesi yok; iptal "Diğer işlemler" satırında',()=>{
  const src=readFileSync('app/servis/page.tsx','utf8');
  assert.doesNotMatch(src,/name="stage"/);
  assert.match(src,/stage:step\.stage,outcome:note,\.\.\.\(step\.stage==="collected"\?\{paid:current\.quote_cents\/100\}:\{\}\)/);
  assert.match(src,/İşi iptal et/);
  assert.match(src,/const next=transitionsOf\(flow\)/); // T5: firmanın akışından
});
