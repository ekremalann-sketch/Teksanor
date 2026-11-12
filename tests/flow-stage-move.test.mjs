// T14: aşama silmede işler seçilen aşamaya taşınır, geçmişe yazılır; akış sürümü artar; etkilenen iş sayısı önceden görünür.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('flow-stage-move',{jobs:'./app/api/service/jobs/route.ts',flow:'./app/api/service/flow/route.ts'});
const {api,sql,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');
const json=r=>r.json();
const flowGet=()=>api.flow.GET(req('boss','/api/service/flow','GET',undefined,'a'));
const flowSave=body=>api.flow.POST(req('boss','/api/service/flow','POST',body,'a'));
const PARCA={extra:[{key:'ozel_parca_bekliyor',label:'Parça bekliyor',after:'in_progress',required:[]}]};
const ids=[];

await test('kurulum: "Parça bekliyor" aşamasında 3 iş',async()=>{
  assert.equal((await flowSave({version:0,custom:PARCA})).status,200);
  for(const t of ['A','B','C']){const id=(await json(await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'İş '+t,customerName:'Demo müşteri',assignedUserId:'tech'},'a')))).id;ids.push(id);sql.prepare("UPDATE service_jobs SET stage='ozel_parca_bekliyor' WHERE id=?").run(id);}
  const g=await json(await flowGet());assert.equal(g.stageCounts.ozel_parca_bekliyor,3,'önizleme: 3 işi etkiler');
});

await test('taşıma hedefi seçilmeden silinemez; geçersiz hedef reddedilir',async()=>{
  let r=await flowSave({version:1,custom:{extra:[]}});assert.equal(r.status,409);assert.deepEqual((await json(r)).affected,{ozel_parca_bekliyor:3});
  r=await flowSave({version:1,custom:{extra:[]},moves:{ozel_parca_bekliyor:'collected'}});assert.equal(r.status,409,'kapanış aşamasına taşınamaz');
  r=await flowSave({version:1,custom:{extra:[]},moves:{ozel_parca_bekliyor:'ozel_parca_bekliyor'}});assert.equal(r.status,409,'silinen aşamaya taşınamaz');
  assert.equal(sql.prepare("SELECT count(*) n FROM service_jobs WHERE stage='ozel_parca_bekliyor'").get().n,3);
});

await test('silinen aşamadaki işler seçilen aşamaya geçer, her biri geçmişe yazılır, akış sürümü artar',async()=>{
  const before=Object.fromEntries(ids.map(id=>[id,sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id).version]));
  const r=await flowSave({version:1,custom:{extra:[]},moves:{ozel_parca_bekliyor:'in_progress'}});assert.equal(r.status,200);assert.equal((await json(r)).version,2);
  for(const id of ids){const row=sql.prepare('SELECT stage,version FROM service_jobs WHERE id=?').get(id);assert.equal(row.stage,'in_progress');assert.equal(row.version,before[id]+1);}
  const logs=sql.prepare("SELECT entity_id,details FROM audit_logs WHERE action='stage_moved' ORDER BY entity_id").all();
  assert.deepEqual(logs.map(l=>l.entity_id).sort(),[...ids].sort());
  assert.match(logs[0].details,/"Parça bekliyor" → "Sahada" \(akış sürümü 2\)/);
  assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='update' AND entity_type='service_flow' AND details LIKE '%sürüm 2%'").get().n,1);
});

await test('eşzamanlı (eski sürümle) kayıtta hiçbir iş taşınmaz',async()=>{
  assert.equal((await flowSave({version:2,custom:PARCA})).status,200);
  sql.prepare("UPDATE service_jobs SET stage='ozel_parca_bekliyor' WHERE id=?").run(ids[0]);
  sql.prepare("UPDATE service_flows SET version=version+1 WHERE organization_id='a'").run(); // başka biri kaydetti
  const r=await flowSave({version:3,custom:{extra:[]},moves:{ozel_parca_bekliyor:'in_progress'}});
  assert.equal(r.status,409);
  assert.equal(sql.prepare('SELECT stage FROM service_jobs WHERE id=?').get(ids[0]).stage,'ozel_parca_bekliyor');
});

test('düzenleyici: etkilenen iş sayısı ve taşıma seçimi; hedef seçilmeden Kaydet pasif',()=>{
  const src=readFileSync('app/servis/akis/page.tsx','utf8');
  assert.match(src,/Bu değişiklik \{n\} işi etkiler/);
  assert.match(src,/disabled=\{busy\|\|removed\.some\(r=>!moves\[r\.key\]\)\}/);
  assert.match(src,/body:JSON\.stringify\(\{version:data!\.version,custom,moves\}\)/);
});
