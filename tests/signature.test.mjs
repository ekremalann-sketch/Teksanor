// Müşteri imzası: doğrulama, saklama biçimi ve servis masasında görünürlük (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('signature',{jobs:'./app/api/service/jobs/route.ts',approval:'./app/api/service/approval/route.ts',sig:'./lib/signature.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('employee','a','member','employee');await h.user('stranger','a','member','employee');
const {signaturePath,isSafeSignaturePath}=api.sig;
const act=(user,body)=>api.jobs.POST(req(user,'/api/service/jobs','POST',body,'a'));
const list=async(user)=>(await (await api.jobs.GET(req(user,'/api/service/jobs','GET',undefined,'a'))).json()).jobs;
const version=(id)=>sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id).version;
const customer=(token,body)=>api.approval.POST(new Request('https://test.local/api/service/approval',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)}));
async function share(id,purpose){const r=await act('boss',{action:'share',id,version:version(id),purpose});assert.equal(r.status,200);return new URLSearchParams((await r.json()).path.split('#')[1]).get('token');}
const stroke=[[10,150,40,120,80,160,120,110],[200,100,260,140]];

test('imza yolu: yalnız tamsayı koordinatlar, sınır içinde, güvenli biçim',()=>{
  const path=signaturePath(stroke);
  assert.equal(path,'M10 150 L40 120 L80 160 L120 110 M200 100 L260 140');
  assert.ok(isSafeSignaturePath(path));
  assert.equal(signaturePath(undefined),null);assert.equal(signaturePath([]),null);
  for(const bad of ['<svg onload=alert(1)>',[[1.5,2,3,4]],[[1,2,3]],[[700,10,20,20]],[[-1,0,5,5]],[['1','2','3','4']],[[1,1]],Array.from({length:61},()=>[1,1,2,2])])
    assert.throws(()=>signaturePath(bad),/İmza/,JSON.stringify(bad).slice(0,40));
  assert.equal(isSafeSignaturePath('M1 1 L2 2"/><script>'),false);
  assert.equal(isSafeSignaturePath('data:image/png;base64,AAAA'),false);
});

let id;
test('müşteri imzalı onay: imza saklanır, denetim kaydı "imzalı" der, servis masasında görünür',async()=>{
  const c=await act('boss',{action:'create',title:'Sentetik imza testi',customerName:'Demo Müşteri',assignedUserId:'employee'});
  assert.equal(c.status,201);id=(await c.json()).id;
  assert.equal((await act('boss',{action:'update',id,version:1,stage:'quoted',quote:1000})).status,200);
  const token=await share(id,'quote');
  assert.equal((await customer(token,{name:'Demo Müşteri',consent:true,signature:[[1,2,3]]})).status,400,'bozuk imza reddedilmeli');
  assert.equal(sql.prepare('SELECT stage FROM service_jobs WHERE id=?').get(id).stage,'quoted','reddedilen istek aşamayı değiştirmemeli');
  assert.equal((await customer(token,{name:'Demo Müşteri',consent:true,signature:stroke})).status,200);
  const row=sql.prepare('SELECT signature_path,approved_by FROM service_approvals WHERE job_id=? AND approved_at IS NOT NULL').get(id);
  assert.equal(row.signature_path,'M10 150 L40 120 L80 160 L120 110 M200 100 L260 140');
  assert.match(sql.prepare("SELECT details FROM audit_logs WHERE action='customer_approval' AND entity_id=?").get(id).details,/imzalı/);
  const mine=(await list('employee')).find(j=>j.id===id);
  assert.equal(mine.signature_path,row.signature_path);assert.equal(mine.approved_by,'Demo Müşteri');assert.equal(mine.approval_purpose,'quote');
  assert.equal((await list('stranger')).some(j=>j.id===id),false,'atanmamış çalışan imzayı görmemeli');
});

test('imzasız onay eskisi gibi çalışır (geriye uyumlu)',async()=>{
  const c=await act('boss',{action:'create',title:'Sentetik imzasız',customerName:'Demo'});const jid=(await c.json()).id;
  await act('boss',{action:'update',id:jid,version:1,stage:'quoted',quote:500});
  const token=await share(jid,'quote');
  assert.equal((await customer(token,{name:'Demo',consent:true})).status,200);
  assert.equal(sql.prepare('SELECT signature_path FROM service_approvals WHERE job_id=? AND approved_at IS NOT NULL').get(jid).signature_path,null);
});

test('veri tabanında bozulmuş imza servis masasına gönderilmez',async()=>{
  sql.prepare('UPDATE service_approvals SET signature_path=? WHERE job_id=?').run('M1 1"/><script>x</script>',id);
  assert.equal((await list('boss')).find(j=>j.id===id).signature_path,null);
});

test('yayın geçişi: önceki sürümün veri tabanında imza sütunu, başka tabloya dokunmadan eklenir',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'tk-schema-'));const file=join(dir,'old.sqlite');
  const first=await createHarness('schema-old',{},{file});
  // Önceki canlı sürümün durumu: şema sürümü aynı, imza sütunu yok. Eski tablolardan kopyalama
  // tekrar çalışsaydı silinmiş özet geri gelirdi; bunun olmadığını da doğrula.
  first.sql.exec("ALTER TABLE service_approvals DROP COLUMN signature_path");
  const before=first.sql.prepare('SELECT COUNT(*) AS n FROM organization_period_summaries').get().n;
  first.sql.close();
  const second=await createHarness('schema-new',{jobs:'./app/api/service/jobs/route.ts'},{file});
  assert.ok(!second.sql.prepare('PRAGMA table_info(service_approvals)').all().some(c=>c.name==='signature_path'),'genel kurulum yeniden çalışmamalı');
  await second.user('boss2','a','owner','owner');
  const r=await second.api.jobs.GET(second.req('boss2','/api/service/jobs','GET',undefined,'a'));
  assert.equal(r.status,200,'eksik sütunla servis masası açılmalı');
  assert.ok(second.sql.prepare('PRAGMA table_info(service_approvals)').all().some(c=>c.name==='signature_path'));
  assert.equal(second.sql.prepare('SELECT COUNT(*) AS n FROM organization_period_summaries').get().n,before);
  second.sql.close();await rm(dir,{recursive:true,force:true});
});
