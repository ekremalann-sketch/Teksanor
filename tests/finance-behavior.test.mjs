// Gerçek ödeme/gider rotalarını bellek içi SQLite üzerinde çalıştıran davranış testleri.
// Yalnız sentetik test kullanıcıları ve demo tutarları kullanılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';

const sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
function statement(query,values=[]){return {query,values,bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}};}
const db={prepare:statement,async exec(q){sql.exec(q)},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>{const stmt=sql.prepare(s.query);return stmt.columns().length?{results:stmt.all(...s.values),success:true}:{success:true,meta:{changes:Number(stmt.run(...s.values).changes)}}});sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__teksanorTestEnv={DB:db,UPLOADS:{head:async()=>null}};
await mkdir('tests/.tmp',{recursive:true});
await build({stdin:{contents:`export * as auth from './lib/auth.ts'; export * as database from './lib/db.ts'; export * as finance from './lib/finance.ts'; export * as payments from './app/api/payments/route.ts'; export * as payment from './app/api/payments/[id]/route.ts'; export * as expenses from './app/api/expenses/route.ts';`,resolveDir:process.cwd()},outfile:'tests/.tmp/finance-behavior.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent',define:{__TEKSANOR_COMMIT__:'"test-sha"'},plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'runtime',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.__teksanorTestEnv'}));b.onResolve({filter:/^next\/server$/},()=>({path:'response',namespace:'response'}));b.onLoad({filter:/.*/,namespace:'response'},()=>({contents:'export class NextResponse extends Response {static json(data,init){return Response.json(data,init)}}'}));}}]});
const api=await import('./.tmp/finance-behavior.mjs');
await api.database.ensureSchema();
for(const id of ['boss','finance','outsider']){const p=await api.auth.hashPassword('Test-password-123!');sql.prepare('INSERT INTO users(id,username,email,full_name,password_hash,password_salt,role) VALUES(?,?,?,?,?,?,?)').run(id,id,id+'@example.test',id,p.hash,p.salt,'user');}
for(const id of ['a','b'])sql.prepare('INSERT INTO organizations(id,name,slug) VALUES(?,?,?)').run(id,id,id);
for(const [id,org,role,profile] of [['boss','a','owner','owner'],['finance','a','member','finance'],['outsider','b','owner','owner']]){sql.prepare('INSERT INTO organization_members(organization_id,user_id,role) VALUES(?,?,?)').run(org,id,role);sql.prepare('INSERT INTO organization_member_access(organization_id,user_id,access_profile) VALUES(?,?,?)').run(org,id,profile);}
const tokens={};for(const id of ['boss','finance','outsider'])tokens[id]=await api.auth.createSession(id);
const req=(user,path,method='GET',body,org='a')=>new Request('https://test.local'+path,{method,headers:{Cookie:'teksanor_session='+tokens[user],'X-Organization-Id':org,'Content-Type':'application/json',Origin:'https://test.local'},body:body?JSON.stringify(body):undefined});
const ctx=(id)=>({params:Promise.resolve({id})});
const count=(where='1=1')=>sql.prepare(`SELECT COUNT(*) AS n FROM payment_records WHERE ${where}`).get().n;
const row=(id)=>({...sql.prepare('SELECT total_debt,paid_amount,payment_status,workflow_status,missing_fields,due_date,paid_at FROM payment_records WHERE id=?').get(id)});
const base={period:'Eylül 2026',ownerName:'Demo Sorumlu',bankName:'Demo Banka',accountName:'Demo Hesap'};
const post=(body,user='boss')=>api.payments.POST(req(user,'/api/payments','POST',{...base,...body}));
const patch=(id,body,user='boss',org='a')=>api.payment.PATCH(req(user,'/api/payments/'+id,'PATCH',{...base,...body},org),ctx(id));
async function created(body){const r=await post(body);assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return (await r.json()).id;}

await test('POST: borç boşken ödeme veya "Ödendi" kaydı oluşmaz',async()=>{
  const before=count();
  for(const body of [{totalDebt:'',paidAmount:'500'},{paidAmount:'',paymentStatus:'paid'},{totalDebt:'',paymentStatus:'Kısmi ödendi'}]){
    const r=await post({...body,accountName:'Boş borç'});assert.equal(r.status,400,JSON.stringify(body));
  }
  assert.equal(count(),before);
});
await test('POST: borcu 0 olan kayda ödeme girilemez; durum/tutar uyuşmazlığı reddedilir',async()=>{
  assert.equal((await post({totalDebt:'0',paidAmount:'10'})).status,400);
  assert.equal((await post({totalDebt:'1.000',paidAmount:'400',paymentStatus:'paid'})).status,400);
  assert.equal((await post({totalDebt:'1.000',paidAmount:'400',paymentStatus:'planned'})).status,400);
  assert.equal((await post({totalDebt:'1.000',paidAmount:'1.000',paymentStatus:'overdue'})).status,400);
  const r=await post({totalDebt:'1.000',paidAmount:'2.000'});assert.equal(r.status,400);assert.match((await r.json()).error,/büyük olamaz/);
});
await test('POST: Türkçe tutar ve etiket kabul edilir, eksik alanlar 0 değil "eksik" olarak işaretlenir',async()=>{
  const id=await created({totalDebt:'12.500,75',paidAmount:'2.500',paymentStatus:'Kısmi ödendi'});
  const r=row(id);assert.equal(r.total_debt,12500.75);assert.equal(r.paid_amount,2500);assert.equal(r.payment_status,'partial');
  const missing=JSON.parse(r.missing_fields);assert.ok(missing.includes('minimumPayment'));assert.ok(!missing.includes('totalDebt'));assert.ok(!missing.includes('paidAmount'));
});
await test('POST: geçersiz sayı Türkçe alan adıyla reddedilir',async()=>{
  const r=await post({totalDebt:'abc'});assert.equal(r.status,400);assert.match((await r.json()).error,/^Toplam borç geçerli bir sayı/);
});
await test('PATCH: satır düzenlemesinde boş borç + "Ödendi" reddedilir, kayıt değişmez (asıl hata)',async()=>{
  const id=await created({totalDebt:'1.000',paidAmount:''});const before=row(id);
  for(const body of [{totalDebt:'',paidAmount:'500',paymentStatus:'paid'},{totalDebt:'',paidAmount:'',paymentStatus:'paid'},{totalDebt:'0',paidAmount:'10'},{totalDebt:'1000',paidAmount:'300',paymentStatus:'planned'}]){
    const r=await patch(id,body);assert.equal(r.status,400,JSON.stringify(body));
  }
  assert.deepEqual(row(id),before);
  const ok=await patch(id,{totalDebt:'1000',paidAmount:'1000'});assert.equal(ok.status,200);assert.equal(row(id).payment_status,'paid');
});
await test('PATCH: yetki ve firma kapsamı korunur; olmayan kaydın onayı 404',async()=>{
  const id=await created({totalDebt:'500'});
  assert.equal((await patch(id,{totalDebt:'1'},'finance')).status,403,'finans üyesi yönetici değil');
  const foreign=await patch(id,{totalDebt:'1'},'outsider','b');assert.equal(foreign.status,404,'başka firmanın kaydı');
  assert.equal(row(id).total_debt,500);
  assert.equal((await api.payment.PATCH(req('boss','/api/payments/yok','PATCH',{action:'approve'}),ctx('yok'))).status,404);
  assert.equal((await api.payment.PATCH(req('boss','/api/payments/'+id,'PATCH',{action:'approve'}),ctx(id))).status,200);
});
await test('Onay akışı: finans üyesinin kaydı "submitted", yönetici onayıyla "approved"',async()=>{
  const r=await post({totalDebt:'750',accountName:'Finans girişi'},'finance');assert.equal(r.status,201);const {id,workflowStatus}=await r.json();
  assert.equal(workflowStatus,'submitted');
  assert.equal((await api.payment.PATCH(req('finance','/api/payments/'+id,'PATCH',{action:'approve'}),ctx(id))).status,403);
  assert.equal((await api.payment.PATCH(req('boss','/api/payments/'+id,'PATCH',{action:'approve'}),ctx(id))).status,200);
  assert.equal(row(id).workflow_status,'approved');
});
await test('Gider: geçersiz, negatif, boş ve sıfır tutar reddedilir; özet bozulmaz',async()=>{
  const e=(amount)=>api.expenses.POST(req('boss','/api/expenses','POST',{period:'Gider Testi',ownerName:'Demo',category:'Fatura',description:'Sentetik gider',amount}));
  for(const bad of ['abc','-500','',0,'12abc',null])assert.equal((await e(bad)).status,400,String(bad));
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM expenses WHERE period='Gider Testi'").get().n,0);
  assert.equal((await e('1.250,50')).status,201);
  assert.equal(sql.prepare("SELECT amount FROM expenses WHERE period='Gider Testi'").get().amount,1250.5);
  assert.equal(sql.prepare("SELECT expense_total FROM organization_period_summaries WHERE organization_id='a' AND period='Gider Testi'").get().expense_total,1250.5);
});
await test('Gider: firma üyesi olmayan kullanıcı yazamaz',async()=>{
  const r=await api.expenses.POST(req('outsider','/api/expenses','POST',{period:'X',ownerName:'X',category:'X',description:'X',amount:'10'},'a'));assert.equal(r.status,403);
});
await test('Excel içe aktarma uçtan uca: boş hücre eksik kalır, tarihler korunur, tekrar yükleme çift kayıt açmaz',async()=>{
  const sheetRow={'Dönem':'Ekim 2026','Kişi':'Demo Sorumlu','Banka':'Excel Banka','Hesap':'Excel Hesap','Toplam Limit':5000,'Toplam Borç':1200,'Ödenen Tutar':'','Kalan Borç':1200,'Aylık Ödeme':300,'Asgari Ödeme':'','Ödeme Durumu':'Planlandı','Son Ödeme':'2026-11-05','Ödendiği Tarih':'','Not':'Sentetik'};
  const payload=api.finance.paymentImportPayload(sheetRow,'Varsayılan');
  for(let i=0;i<2;i++){const r=await api.payments.POST(req('boss','/api/payments','POST',payload));assert.ok([200,201].includes(r.status));}
  assert.equal(count("bank_name='Excel Banka'"),1,'upsert tekrar yüklemede çift kayıt açmamalı');
  const r=sql.prepare("SELECT total_debt,paid_amount,payment_status,due_date,paid_at,missing_fields FROM payment_records WHERE bank_name='Excel Banka'").get();
  assert.equal(r.total_debt,1200);assert.equal(r.payment_status,'planned');assert.equal(r.due_date,'2026-11-05');assert.equal(r.paid_at,null);
  const missing=JSON.parse(r.missing_fields);assert.ok(missing.includes('paidAmount')&&missing.includes('minimumPayment'),'boş hücreler eksik olarak işaretlenmeli');
  const bad=api.finance.paymentImportPayload({...sheetRow,'Hesap':'Hatalı','Toplam Borç':'','Ödenen Tutar':500},'X');
  const rejected=await api.payments.POST(req('boss','/api/payments','POST',bad));assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/toplam borcu girin/);
});
