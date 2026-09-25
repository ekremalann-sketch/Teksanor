// Uçtan uca servis akışı ve mükerrer kayıt davranışı (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('workflow-e2e',{jobs:'./app/api/service/jobs/route.ts',approval:'./app/api/service/approval/route.ts',workOrder:'./app/api/work-orders/[id]/route.ts',payments:'./app/api/payments/route.ts',expenses:'./app/api/expenses/route.ts',finance:'./lib/finance.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('employee','a','member','employee');await h.user('other','a','member','employee');
const job=(id)=>({...sql.prepare('SELECT stage,version,quote_cents,paid_cents,outcome FROM service_jobs WHERE id=?').get(id)});
const wo=(id)=>({...sql.prepare('SELECT status,completed_date FROM work_orders WHERE id=?').get(id)});
const act=(user,body)=>api.jobs.POST(req(user,'/api/service/jobs','POST',body,'a'));
const customer=(token,method='POST',body={name:'Demo Müşteri',consent:true})=>api.approval[method](new Request('https://test.local/api/service/approval',{method,headers:{Authorization:'Bearer '+token,Origin:'https://test.local','Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined}));
async function share(id,purpose){const r=await act('boss',{action:'share',id,version:job(id).version,purpose});assert.equal(r.status,200);return new URLSearchParams((await r.json()).path.split('#')[1]).get('token');}

let id;
await test('1) iş emri: yönetici servis talebi açar, çalışana atar',async()=>{
  const r=await act('boss',{action:'create',title:'Sentetik kompresör bakımı',customerName:'Demo Müşteri A.Ş.',assignedUserId:'employee',scheduledDate:'2026-10-01'});
  assert.equal(r.status,201);id=(await r.json()).id;
  assert.equal(job(id).stage,'requested');assert.equal(wo(id).status,'open');
});
await test('2) teklif: tutar kaydedilir; onaysız işe başlanamaz',async()=>{
  assert.equal((await act('boss',{action:'update',id,version:1,stage:'quoted',quote:2500,labor:800,parts:600,travel:100})).status,200);
  assert.equal(job(id).quote_cents,250000);
  assert.equal((await act('employee',{action:'update',id,version:2,stage:'in_progress'})).status,400);
});
let quoteToken;
await test('3) müşteri onayı: onay kutusu zorunlu; onay tek sefer aşama ilerletir, tekrar göndermek ikinci değişiklik yapmaz',async()=>{
  quoteToken=await share(id,'quote');
  assert.equal((await customer(quoteToken,'POST',{name:'Demo',consent:false})).status,400);
  const [a,b]=await Promise.all([customer(quoteToken),customer(quoteToken)]);
  assert.deepEqual([a.status,b.status].sort(),[200,200].sort());
  assert.equal(job(id).stage,'quote_approved');assert.equal(job(id).version,3,'eşzamanlı iki onay tek sürüm artışı yapmalı');
  assert.equal((await customer(quoteToken)).status,200);assert.equal(job(id).version,3);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='customer_approval' AND entity_id=?").get(id).n,1);
});
await test('4) onaylı teklif tutarı değiştirilemez; eski iş emri API ile atlatılamaz',async()=>{
  assert.equal((await act('boss',{action:'update',id,version:3,quote:9999})).status,400);
  assert.equal((await api.workOrder.PUT(req('boss','/api/work-orders/'+id,'PUT',{status:'completed'},'a'),{params:Promise.resolve({id})})).status,409);
});
await test('5) saha: yalnız atanan çalışan kayıt girer; iç maliyeti değiştiremez; boş servis formu reddedilir',async()=>{
  assert.equal((await act('other',{action:'update',id,version:3,stage:'in_progress'})).status,404);
  assert.equal((await act('employee',{action:'update',id,version:3,stage:'in_progress',labor:1})).status,200);
  assert.equal(sql.prepare('SELECT labor_cents FROM service_jobs WHERE id=?').get(id).labor_cents,80000);
  assert.equal(wo(id).status,'in_progress');
  assert.equal((await act('employee',{action:'update',id,version:4,stage:'completed',outcome:''})).status,400);
});
await test('6) servis formu: aynı sürümle çift gönderim yalnız bir kez uygulanır',async()=>{
  const body={action:'update',id,version:4,stage:'completed',outcome:'Filtre değiştirildi, basınç testi yapıldı (sentetik).'};
  const [a,b]=await Promise.all([act('employee',body),act('employee',body)]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  assert.equal(job(id).stage,'completed');assert.equal(job(id).version,5);assert.ok(wo(id).completed_date);
});
await test('7) tamamlanma onayı: müşteri raporu onaylar; onaylı rapor değiştirilemez',async()=>{
  const token=await share(id,'completion');
  const view=await (await customer(token,'GET')).json();assert.match(view.outcome,/basınç testi/);assert.equal(view.labor_cents,undefined);
  assert.equal((await customer(token)).status,200);assert.equal(job(id).stage,'accepted');
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,outcome:'Değiştirilmiş rapor'})).status,400);
  const replay=await customer(quoteToken);assert.equal(replay.status,200,'onaylanmış bağlantının tekrarı idempotent');assert.equal(job(id).stage,'accepted','eski teklif bağlantısı aşamayı geri almamalı');
});
await test('8) tahsilat: eksik tahsilatla kapanmaz, fazla tahsilat reddedilir, tam tahsilatla kapanır',async()=>{
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,stage:'collected',paid:1000})).status,400);
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,paid:3000})).status,400);
  assert.equal((await act('employee',{action:'update',id,version:job(id).version,stage:'collected',paid:2500})).status,400,'çalışan tahsilatı kapatamaz');
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,stage:'collected',paid:2500})).status,200);
  assert.deepEqual([job(id).stage,job(id).paid_cents],['collected',250000]);assert.equal(wo(id).status,'completed');
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,stage:'in_progress'})).status,400,'kapanan iş yeniden açılamaz');
});
await test('9) mükerrer kayıt: aynı servis talebi formu art arda iki kez gönderilirse tek iş oluşur',async()=>{
  const body={action:'create',title:'Çift tıklama testi',customerName:'Demo',assignedUserId:'employee'};
  const [a,b]=await Promise.all([act('boss',body),act('boss',body)]);
  const ids=[await a.json(),await b.json()].map(x=>x.id);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE title='Çift tıklama testi'").get().n,1);
  assert.equal(ids[0],ids[1],'ikinci istek ilk kaydı döndürmeli');
});
await test('10) mükerrer kayıt: aynı finans kaydı art arda iki kez gönderilirse tek kayıt oluşur',async()=>{
  const body={period:'Ekim 2026',ownerName:'Demo',bankName:'Çift',accountName:'Kart',totalDebt:'1.000'};
  const [a,b]=await Promise.all([api.payments.POST(req('boss','/api/payments','POST',body,'a')),api.payments.POST(req('boss','/api/payments','POST',body,'a'))]);
  assert.ok([a.status,b.status].every(s=>s<300));
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM payment_records WHERE bank_name='Çift'").get().n,1);
});
await test('11) mükerrer kayıt: aynı gider art arda iki kez gönderilirse tek kayıt oluşur',async()=>{
  const body={period:'Ekim 2026',ownerName:'Demo',category:'Fatura',description:'Çift gider',amount:'250'};
  await Promise.all([api.expenses.POST(req('boss','/api/expenses','POST',body,'a')),api.expenses.POST(req('boss','/api/expenses','POST',body,'a'))]);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM expenses WHERE description='Çift gider'").get().n,1);
});
await test('12) Excel: aynı dosya iki kez içe aktarılırsa satır sayısı artmaz, değişen değer güncellenir',async()=>{
  const rows=[{'Dönem':'Kasım','Kişi':'Demo','Banka':'Excel','Hesap':'H1','Toplam Borç':500},{'Dönem':'Kasım','Kişi':'Demo','Banka':'Excel','Hesap':'H2','Toplam Borç':700,'Ödenen Tutar':700,'Ödeme Durumu':'Ödendi'}];
  for(let i=0;i<2;i++)for(const r of rows)assert.ok((await api.payments.POST(req('boss','/api/payments','POST',api.finance.paymentImportPayload(r,'X'),'a'))).status<300);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM payment_records WHERE bank_name='Excel'").get().n,2);
  await api.payments.POST(req('boss','/api/payments','POST',api.finance.paymentImportPayload({...rows[0],'Toplam Borç':650},'X'),'a'));
  assert.equal(sql.prepare("SELECT total_debt FROM payment_records WHERE bank_name='Excel' AND account_name='H1'").get().total_debt,650);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM payment_records WHERE bank_name='Excel'").get().n,2);
});
