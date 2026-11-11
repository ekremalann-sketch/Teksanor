// T10: müşteri teklifi onaylayınca / reddedince firma yöneticisi ve işin sorumlusu uygulama içinde haberdar olur.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('approval-notify',{jobs:'./app/api/service/jobs/route.ts',approval:'./app/api/service/approval/route.ts',notify:'./lib/approval-notify.ts'});
const {api,sql,req}=h;
await h.user('boss','a','owner','owner');await h.user('mgr','a','member','manager');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');await h.user('rival','b','owner','owner');
const json=async(r)=>r.json();
const share=async(id,version)=>new URLSearchParams((await json(await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'share',id,version,purpose:'quote'},'a')))).path.split('#')[1]).get('token');
const customer=(t,body)=>api.approval.POST(new Request('https://test.local/api/service/approval',{method:'POST',headers:{Authorization:'Bearer '+t,Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)}));
const notes=(job)=>sql.prepare("SELECT user_id,title,body,type FROM notifications WHERE entity_type='service_job' AND entity_id=? ORDER BY user_id").all(job);
async function quotedJob(title){
  const r=await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title,customerName:'Demo müşteri',assignedUserId:'tech'},'a'));assert.equal(r.status,201);const id=(await json(r)).id;
  assert.equal((await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'update',id,version:1,stage:'quoted',quote:1000,labor:100,parts:200,travel:50},'a'))).status,200);
  return id;
}

await test('teklif onayı: sahip, yönetici ve sorumlu teknisyen bildirim alır; ilgisiz çalışan ve başka firma almaz',async()=>{
  const id=await quotedJob('Klima bakımı');const t=await share(id,2);
  assert.equal((await customer(t,{name:'Demo müşteri',consent:true})).status,200);
  const rows=notes(id);
  assert.deepEqual(rows.map(r=>r.user_id),['boss','mgr','tech']);
  assert.ok(rows.every(r=>r.type==='success'&&r.title.startsWith('Teklif onaylandı: Klima bakımı')));
  assert.equal(sql.prepare("SELECT count(*) n FROM notifications WHERE user_id IN ('other','rival')").get().n,0);
  // Aynı bağlantıyla ikinci istek ikinci bildirim üretmez.
  assert.equal((await customer(t,{name:'Demo müşteri',consent:true})).status,200);
  assert.equal(notes(id).length,3);
});

await test('teklif reddi: gerekçeyle uyarı bildirimi',async()=>{
  const id=await quotedJob('Jeneratör testi');const t=await share(id,2);
  assert.equal((await customer(t,{action:'reject',name:'Demo müşteri',reason:'Fiyat yüksek'})).status,200);
  const rows=notes(id);
  assert.equal(rows.length,3);
  assert.ok(rows.every(r=>r.type==='warning'&&/Gerekçe: Fiyat yüksek/.test(r.body)));
});

await test('onay yazılmazsa (eski bağlantı) bildirim de oluşmaz',async()=>{
  const id=await quotedJob('Pompa');const t=await share(id,2);
  sql.prepare("UPDATE service_jobs SET version=version+1 WHERE id=?").run(id);
  assert.notEqual((await customer(t,{name:'Demo müşteri',consent:true})).status,200);
  assert.equal(notes(id).length,0);
});

await test('bildirim metinleri sade',()=>{
  assert.equal(api.notify.approvalMessage('work_accepted',{title:'Kombi',order_number:'IS-7',customer_name:'Ayşe'}).title,'İş teslim alındı: Kombi (IS-7)');
});
