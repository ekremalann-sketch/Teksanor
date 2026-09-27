// Saha formu (kontrol listesi), planlama, e-fatura taslağı ve KVKK başvurusu (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('field-extras',{jobs:'./app/api/service/jobs/route.ts',checklists:'./app/api/service/checklists/route.ts',invoice:'./app/api/service/invoice/route.ts',approval:'./app/api/service/approval/route.ts',einvoice:'./lib/einvoice.ts',checklist:'./lib/checklist.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('tech2','a','member','employee');await h.user('fin','a','member','finance');await h.user('rival','b','owner','owner');
const act=(u,body,org='a')=>api.jobs.POST(req(u,'/api/service/jobs','POST',body,org));
const chk=(u,body,org='a')=>api.checklists.POST(req(u,'/api/service/checklists','POST',body,org));
const chkGet=async(u,jobId,org='a')=>api.checklists.GET(req(u,'/api/service/checklists'+(jobId?`?jobId=${jobId}`:''),'GET',undefined,org));
const job=(id)=>({...sql.prepare('SELECT stage,version,assigned_user_id FROM service_jobs WHERE id=?').get(id)});

let jobId,templateId;
await test('şablon: yalnız yönetici oluşturur; hatalı madde reddedilir; başlangıç şablonları önerilir',async()=>{
  const starters=await (await chkGet('boss')).json();assert.ok(starters.starters.length>=3);
  const items=[{label:'Filtre temizlendi',type:'check'},{label:'Gaz basıncı',type:'number',unit:'bar'},{label:'Durum',type:'choice',options:['İyi','Arızalı']},{label:'Not',type:'text',required:false}];
  assert.equal((await chk('tech',{action:'template.create',name:'Klima',items})).status,403);
  assert.equal((await chk('boss',{action:'template.create',name:'Klima',items:[{label:'Durum',type:'choice',options:['Tek']}]})).status,400);
  assert.equal((await chk('boss',{action:'template.create',name:'Klima',items:[]})).status,400);
  const r=await chk('boss',{action:'template.create',name:'Klima bakım',items});assert.equal(r.status,201);templateId=(await r.json()).id;
  assert.equal((await (await chkGet('rival',undefined,'b')).json()).templates.length,0,'başka firma şablonu görmemeli');
});

await test('saha formu: zorunlu maddeler bitmeden iş tamamlanamaz; cevap türü doğrulanır; sürüm çakışması 409',async()=>{
  const c=await act('boss',{action:'create',title:'Sentetik klima bakımı',customerName:'Demo Müşteri Ltd',location:'Sentetik Cad. 1',assignedUserId:'tech'});jobId=(await c.json()).id;
  await act('boss',{action:'update',id:jobId,version:1,stage:'quoted',quote:1000});
  sql.prepare("UPDATE service_jobs SET stage='in_progress' WHERE id=?").run(jobId);
  assert.equal((await chk('tech2',{action:'attach',jobId,templateId})).status,404,'atanmamış çalışan işe erişemez');
  const [x,y]=await Promise.all([chk('tech',{action:'attach',jobId,templateId}),chk('tech',{action:'attach',jobId,templateId})]);
  assert.deepEqual([x.status,y.status],[201,201]);
  let lists=(await (await chkGet('tech',jobId)).json()).checklists;assert.equal(lists.length,1,'çift ekleme tek form bırakmalı');
  const form=lists[0];const [m1,m2,m3]=form.items.map(i=>i.id);
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:form.version,answers:{[m2]:'abc'}})).status,400);
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:form.version,answers:{hack:true}})).status,400);
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:form.version,answers:{[m3]:'Bozuk'}})).status,400);
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:form.version,answers:{[m1]:true,[m2]:'4,5'}})).status,200);
  const v=job(jobId).version;
  const blocked=await act('tech',{action:'update',id:jobId,version:v,stage:'completed',outcome:'Bakım yapıldı'});
  assert.equal(blocked.status,400);assert.match((await blocked.json()).error,/Zorunlu kontrol/);
  lists=(await (await chkGet('tech',jobId)).json()).checklists;assert.deepEqual(lists[0].missing,['Durum']);
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:form.version,answers:{[m1]:true}})).status,409,'eski sürümle yazılamaz');
  assert.equal((await chk('tech',{action:'answer',jobId,id:form.id,version:lists[0].version,answers:{[m1]:true,[m2]:4.5,[m3]:'İyi'}})).status,200);
  assert.equal((await act('tech',{action:'update',id:jobId,version:job(jobId).version,stage:'completed',outcome:'Bakım yapıldı'})).status,200);
});

await test('planlama: yalnız yönetici; geçersiz tarih ve başka firma çalışanı reddedilir; çalışan yeni işi görür',async()=>{
  const c=await act('boss',{action:'create',title:'Sentetik jeneratör testi',customerName:'Demo Müşteri Ltd'});const id=(await c.json()).id;
  assert.equal((await act('tech',{action:'schedule',id,version:1,scheduledDate:'2026-10-05',assignedUserId:'tech'})).status,404,'çalışan başkasının işini göremez');
  assert.equal((await act('boss',{action:'schedule',id,version:1,scheduledDate:'2026-02-30'})).status,400);
  assert.equal((await act('boss',{action:'schedule',id,version:1,scheduledDate:'2026-10-05',assignedUserId:'rival'})).status,400);
  assert.equal((await act('boss',{action:'schedule',id,version:1,scheduledDate:'2026-10-05',assignedUserId:'tech2'})).status,200);
  assert.equal(job(id).assigned_user_id,'tech2');
  assert.equal(sql.prepare('SELECT scheduled_date FROM work_orders WHERE id=?').get(id).scheduled_date,'2026-10-05');
  assert.equal((await act('boss',{action:'schedule',id,version:1,scheduledDate:'2026-10-06'})).status,409,'eski sürüm');
  const seen=(await (await api.jobs.GET(req('tech2','/api/service/jobs','GET',undefined,'a'))).json()).jobs.map(j=>j.id);assert.ok(seen.includes(id));
});

await test('e-fatura taslağı: tutarlar kuruş hassasiyetinde; XML geçerli ve kaçışlı; yetki ve aşama kuralları',async()=>{
  const {invoiceTotals,buildUblInvoice}=api.einvoice;
  assert.deepEqual(invoiceTotals(100001,20,5000),{netCents:100001,vatCents:20000,grossCents:120001,prepaidCents:5000,payableCents:115001});
  assert.throws(()=>invoiceTotals(100,18,0),/KDV/);
  const xml=buildUblInvoice({number:'SRV-1',issueDate:'2026-09-27',currency:'TRY',seller:{name:'A & B <Ltd>'},buyer:{name:'"Müşteri" & Ortakları'},lineDescription:'Bakım </cbc:Name><script>',netCents:250075,vatRate:20,paidCents:0});
  assert.match(xml,/A &amp; B &lt;Ltd&gt;/);assert.doesNotMatch(xml,/<script>/);
  assert.match(xml,/<cbc:PayableAmount currencyID="TRY">3000.90<\/cbc:PayableAmount>/);
  assert.match(xml,/Eksik bilgi: satıcı vergi numarası/);
  const dir=mkdtempSync(join(tmpdir(),'ubl-'));writeFileSync(join(dir,'i.xml'),xml);
  execFileSync('python3',['-c','import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])',join(dir,'i.xml')]);
  const get=(u,id,vat='')=>api.invoice.GET(req(u,`/api/service/invoice?id=${id}${vat}`,'GET',undefined,'a'));
  assert.equal((await get('boss',jobId)).status,409,'onaysız iş faturalanmaz');
  sql.prepare("UPDATE service_jobs SET stage='accepted',paid_cents=20000 WHERE id=?").run(jobId);
  assert.equal((await get('tech',jobId)).status,403);assert.equal((await get('fin',jobId)).status,403,'servis modülü finansa kapalı');
  assert.equal((await get('boss',jobId,'&vat=18')).status,400);
  const r=await get('boss',jobId);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/xml/);
  const body=await r.text();assert.match(body,/<cbc:TaxInclusiveAmount currencyID="TRY">1200.00</);assert.match(body,/<cbc:PayableAmount currencyID="TRY">1000.00</);
  assert.equal((await api.invoice.GET(req('rival',`/api/service/invoice?id=${jobId}`,'GET',undefined,'b'))).status,404);
});

await test('kilit: müşteri onayından sonra form değiştirilemez',async()=>{
  const form=(await (await chkGet('boss',jobId)).json()).checklists[0];
  assert.equal((await chk('boss',{action:'answer',jobId,id:form.id,version:form.version,answers:{}})).status,409);
});

