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

await test('teklif kalemleri sunucuda toplanır, gerekçeli revizyon ve ret tek kez yazılır, onaylı sürüm sabit kalır',async()=>{
 const opened=await act('boss',{action:'create',title:'Sentetik kalemli teklif',assignedUserId:'employee'});
 const {id}=await opened.json();
 const lines=[{kind:'item',label:'Sentetik parça',quantity:2,unitCents:2500},{kind:'labor',label:'Sentetik işçilik',quantity:1,unitCents:1500}];
 const secondLines=[{...lines[0],quantity:3},lines[1]];
 const finalLines=[lines[0],{...lines[1],unitCents:2000}];
 const revise=(reason,who='boss',version=job(id).version,revisionLines=lines)=>act(who,{action:'quote-revise',id,version,lines:revisionLines,reason,totalCents:1});
 assert.equal((await revise('', 'employee')).status,403);
 assert.equal((await revise('')).status,200);
 assert.equal(job(id).quote_cents,6500);
 const old=await share(id,'quote');
 assert.deepEqual((await (await customer(old,'GET')).json()).quoteLines,lines);
 assert.equal((await revise('')).status,400);
 const version=job(id).version;
 assert.deepEqual((await Promise.all([revise('Sentetik güncelleme','boss',version,secondLines),revise('Sentetik güncelleme','boss',version,secondLines)])).map(r=>r.status).sort(),[200,409]);
 assert.equal((await customer(old,'GET')).status,410);
 const rejected=await share(id,'quote');
 const second=await (await customer(rejected,'GET')).json();
 assert.equal(second.quote,90);
 assert.equal(second.quoteRevision,2);
 assert.deepEqual(second.quoteLines,secondLines);
 assert.equal((await customer(rejected,'POST',{action:'reject',name:'Demo'})).status,400);
 assert.equal((await customer(rejected,'POST',{action:'reject',name:'Demo',reason:'Sentetik ret gerekçesi'})).status,200);
 assert.equal(job(id).stage,'requested');
 assert.equal((await customer(rejected)).status,410);
 assert.equal((await revise('Ret sonrası revizyon','boss',job(id).version,finalLines)).status,200);
 const accepted=await share(id,'quote');
 assert.equal((await customer(accepted)).status,200);
 assert.equal((await revise('Onay sonrası değişiklik')).status,400);
 const replay=await (await customer(accepted,'GET')).json();
 assert.equal(replay.quote,70);
 assert.equal(replay.quoteRevision,3);
 assert.deepEqual(replay.quoteLines,finalLines);
 await h.user('quote-outsider','b','owner','owner');
 const path='/api/service/jobs?quoteHistory='+id;
 assert.equal((await api.jobs.GET(req('employee',path,'GET',undefined,'a'))).status,403);
 assert.equal((await api.jobs.GET(req('quote-outsider',path,'GET',undefined,'b'))).status,404);
 const history=await api.jobs.GET(req('boss',path,'GET',undefined,'a'));
 assert.deepEqual((await history.json()).history.map(row=>[row.revision,row.total_cents,row.lines]),[
  [3,7000,finalLines],[2,9000,secondLines],[1,6500,lines],
 ]);
});

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
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,paid:1000})).status,200);
  assert.equal((await act('boss',{action:'update',id,version:job(id).version,stage:'collected',paid:2500})).status,200);
  const path='/api/service/jobs?paymentHistory='+encodeURIComponent(id);
  const history=await api.jobs.GET(req('boss',path,'GET',undefined,'a'));
  assert.equal(history.status,200);
  assert.deepEqual((await history.json()).history.map(row=>[row.before_cents,row.after_cents]),[[100000,250000],[0,100000]]);
  assert.equal((await api.jobs.GET(req('employee',path,'GET',undefined,'a'))).status,403);
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

await test('tekrar servis işi kaynağını saklar ve çift gönderimde aynı işe döner',async()=>{
 const input={action:'create',title:'Tekrar ziyaret',previousJobId:id};
 const first=await act('boss',input);
 assert.equal(first.status,201);
 const created=(await first.json()).id;
 assert.notEqual(created,id);
 assert.equal(sql.prepare('SELECT previous_job_id FROM service_jobs WHERE id=?').get(created).previous_job_id,id);
 assert.equal((await (await act('boss',input)).json()).id,created);
 assert.equal((await act('boss',{...input,previousJobId:'missing'})).status,400);
});

await test('parça bekleyen ziyaret kapanır, sonraki ziyaret aynı servis işinde kalır',async()=>{
 const created=await act('boss',{action:'create',title:'İki ziyaretli sentetik iş',assignedUserId:'employee'});
 const serviceId=(await created.json()).id;
 sql.prepare("UPDATE service_jobs SET stage='in_progress' WHERE id=?").run(serviceId);
 const plan=(date)=>act('boss',{action:'visit-plan',id:serviceId,version:job(serviceId).version,scheduledDate:date,assignedUserId:'employee'});
 assert.equal((await plan('2026-11-10')).status,200);
 assert.equal((await plan('2026-11-11')).status,409);
 const visitId=sql.prepare('SELECT id FROM service_visits WHERE job_id=?').get(serviceId).id;
 const close={action:'visit-close',id:serviceId,version:job(serviceId).version,visitId,status:'parts_waiting',note:'Sentetik parça bekleniyor'};
 assert.equal((await act('other',close)).status,404);
 assert.equal((await act('employee',{action:'update',id:serviceId,version:job(serviceId).version,stage:'completed',outcome:'Deneme'})).status,400);
 assert.equal((await act('employee',close)).status,200);
 assert.equal((await act('employee',close)).status,409);
 assert.equal((await plan('2026-11-11')).status,200);
 const r=await api.jobs.GET(req('boss','/api/service/jobs?visitHistory='+serviceId,'GET',undefined,'a'));
 assert.deepEqual((await r.json()).visits.map(visit=>visit.status),['planned','parts_waiting']);
});
