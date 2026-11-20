// Firma iş tanımları: firma kendi birimini ve süreç türünü tanımlar; süreç aşamaları, onay rolleri,
// ret (geri gönder veya kapat + başka birimde süreç aç) ve firma ayrımı sunucuda uygulanır. Yalnız sentetik veri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('org-workflows',{dep:'./app/api/departments/route.ts',ow:'./app/api/organization-workflows/route.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');
await h.user('admin','a','admin','company_admin');
await h.user('ceo','a','member','ceo');
await h.user('fin','a','member','finance');
await h.user('emp','a','member','employee');
await h.user('rival','b','owner','owner');
const ow=(u,body,org='a')=>api.ow.POST(req(u,'/api/organization-workflows','POST',body,org));
const owGet=(u,org='a')=>api.ow.GET(req(u,'/api/organization-workflows','GET',undefined,org));
const dep=(u,body,org='a')=>api.dep.POST(req(u,'/api/departments','POST',body,org));
const depGet=(u,q='',org='a')=>api.dep.GET(req(u,'/api/departments'+q,'GET',undefined,org));
const row=(id)=>sql.prepare('SELECT stage_key,status,version,outcome FROM department_processes WHERE id=?').get(id);

let depSlug;
await test('firma birimi: yalnız sahip/yönetici tanımlar; hazır birim adıyla çakışamaz; diğer firma görmez',async()=>{
  assert.equal((await ow('emp',{action:'department.save',department:{name:'Depo ve lojistik'}})).status,403);
  assert.equal((await ow('ceo',{action:'department.save',department:{name:'Depo ve lojistik'}})).status,403,'üst yönetim görüntüler, değiştirmez');
  assert.equal((await ow('boss',{action:'department.save',department:{name:'Satın alma ve tedarik'}})).status,400,'hazır birimle aynı ad');
  const r=await ow('boss',{action:'department.save',department:{name:'Depo ve lojistik',short:'Depo',mission:'Mal kabul, stok ve sevkiyat',owners:['manager','owner']}});
  assert.equal(r.status,201);depSlug=(await r.json()).slug;assert.match(depSlug,/^f-depo-ve-lojistik/);
  const stored=sql.prepare('SELECT owners FROM organization_departments WHERE slug=?').get(depSlug);assert.deepEqual(JSON.parse(stored.owners),['manager'],'yönetim profilleri sahip listesine yazılmaz');
  const rival=await (await owGet('rival','b')).json();assert.ok(!rival.departments.some(d=>d.slug===depSlug),'firma ayrımı');
  const list=(await (await depGet('boss')).json()).departments;assert.ok(list.some(d=>d.slug===depSlug&&d.custom));
});

let key;
await test('süreç türü: aşama, onay rolü, zorunlu alan, ret davranışı ve kapanınca başka birimde süreç açma tanımlanır',async()=>{
  const bad=await ow('boss',{action:'template.save',slug:depSlug,template:{label:'Sevkiyat',stages:[{label:'Talep'}],outcomes:['Sevk edildi']}});
  assert.equal(bad.status,400,'tek aşama yetmez');
  const badReject=await ow('boss',{action:'template.save',slug:depSlug,template:{label:'Sevkiyat',stages:[{label:'Talep',rejectTo:'talep'},{label:'Onay',approvers:['ceo']}],outcomes:['Tamam']}});
  assert.equal(badReject.status,400,'onay olmayan aşamada ret tanımı');
  const t={label:'Sevkiyat onayı',summary:'Müşteriye çıkan sevkiyatın kontrol ve onayı',selfService:true,
    fields:[{label:'Müşteri',type:'text',required:true},{label:'Tutar',type:'number'},{label:'Araç',type:'choice',options:'Kamyonet, Tır'}],
    stages:[{label:'Sevk talebi',todo:'Sevk bilgisini girin',key:'talep'},{label:'Depo kontrolü',requires:['arac'],slaDays:1,key:'kontrol'},{label:'Finans onayı',approvers:['finance','ceo'],rejectTo:'kontrol',key:'finans-onay'},{label:'Yönetim onayı',approvers:['ceo'],key:'yonetim-onay'},{label:'Sevk',key:'sevk'}],
    outcomes:['Sevk edildi','Vazgeçildi'],
    next:[{slug:'finans',template:'odeme-talebi',when:['Reddedildi']},{slug:'satis',template:'firsat',when:['Sevk edildi']}]};
  const nextOk=(await (await owGet('boss')).json()).departments.find(d=>d.slug==='satis')?.templates.some(x=>x.key==='firsat');
  if(!nextOk) t.next=[{slug:'finans',template:'odeme-talebi',when:['Reddedildi']}];
  const r=await ow('boss',{action:'template.save',slug:depSlug,template:t});
  assert.equal(r.status,201,JSON.stringify(await r.clone().json()));key=(await r.json()).key;
  const view=await (await depGet('emp','?slug='+depSlug)).json();
  assert.ok(view.templates.some(x=>x.key===key&&x.custom),'çalışan self-service süreç türünü görür');
  assert.equal((await ow('boss',{action:'template.save',slug:'ik',key:'ise-alim',template:t})).status,403,'hazır süreç türü değiştirilemez');
});

let pid;
await test('akış: zorunlu alan, onay rolü; finans reddi süreci tanımlı aşamaya geri gönderir',async()=>{
  const c=await dep('emp',{action:'create',slug:depSlug,template:key,title:'Sentetik sevkiyat',data:{musteri:'Sentetik Ltd'}});
  assert.equal(c.status,201,JSON.stringify(await c.clone().json()));pid=(await c.json()).id;
  assert.equal((await dep('emp',{action:'advance',slug:depSlug,id:pid,version:1})).status,403,'üye ilerletemez');
  assert.equal((await dep('boss',{action:'advance',slug:depSlug,id:pid,version:1})).status,200);
  assert.equal((await dep('boss',{action:'advance',slug:depSlug,id:pid,version:2})).status,400,'araç seçilmeden kontrol geçilmez');
  assert.equal((await dep('boss',{action:'advance',slug:depSlug,id:pid,version:2,data:{arac:'Uçak'}})).status,400,'listede olmayan seçenek');
  assert.equal((await dep('boss',{action:'advance',slug:depSlug,id:pid,version:2,data:{arac:'Tır'}})).status,200);
  assert.equal(row(pid).stage_key,'finans-onay');
  assert.equal((await dep('boss',{action:'reject',slug:depSlug,id:pid,version:3,note:'x'})).status,403,'sahip bu aşamanın onay rolünde değil');
  assert.equal((await dep('fin',{action:'block',slug:depSlug,id:pid,version:3,note:'x'})).status,403,'finans bu birimde yalnız onay kararı verir');
  const sum=await (await depGet('fin')).json();assert.ok(sum.awaitingMe.some(x=>x.id===pid),'iş onay için finansa düşer');
  assert.equal((await dep('fin',{action:'reject',slug:depSlug,id:pid,version:3})).status,400,'gerekçe zorunlu');
});

await test('ret: onay yetkilisi gerekçeyle reddeder; tanımlıysa önceki aşamaya, değilse kapanır ve bağlı süreç başka birimde açılır',async()=>{
  assert.equal((await dep('fin',{action:'reject',slug:depSlug,id:pid,version:3,note:'Fiyat teyidi eksik'})).status,200,'başka birimdeki onay rolü reddeder');
  assert.deepEqual([row(pid).stage_key,row(pid).status],['kontrol','active'],'depo kontrolüne geri döndü');
  assert.equal((await dep('boss',{action:'advance',slug:depSlug,id:pid,version:4})).status,200);
  assert.equal((await dep('ceo',{action:'advance',slug:depSlug,id:pid,version:5})).status,200,'finans onayı');
  assert.equal(row(pid).stage_key,'yonetim-onay');
  assert.equal((await dep('boss',{action:'reject',slug:depSlug,id:pid,version:6,note:'x'})).status,403);
  const r=await dep('ceo',{action:'reject',slug:depSlug,id:pid,version:6,note:'Bütçe dışı'});
  assert.equal(r.status,200);const body=await r.json();
  assert.equal(row(pid).status,'done');assert.equal(row(pid).outcome,'Reddedildi');
  assert.equal(body.started.length,1,'yalnız "Reddedildi" bağlantısı açıldı');assert.equal(body.started[0].slug,'finans');
  const opened=sql.prepare("SELECT department_slug, template_key, status FROM department_processes WHERE id=?").get(body.started[0].id);
  assert.deepEqual({...opened},{department_slug:'finans',template_key:'odeme-talebi',status:'active'});
  assert.ok(sql.prepare("SELECT 1 FROM audit_logs WHERE action='reject' AND entity_id=?").get(pid),'denetim izi');
  assert.equal((await dep('ceo',{action:'reject',slug:depSlug,id:pid,version:7,note:'tekrar'})).status,409,'kapanan süreç değişmez');
});

await test('eşzamanlı ret ve onay: yalnız biri geçer',async()=>{
  const c=await dep('boss',{action:'create',slug:depSlug,template:key,title:'Yarış',data:{musteri:'X',arac:'Tır'}});const id=(await c.json()).id;
  await dep('boss',{action:'advance',slug:depSlug,id,version:1});await dep('boss',{action:'advance',slug:depSlug,id,version:2});
  const [a,b]=await Promise.all([dep('ceo',{action:'advance',slug:depSlug,id,version:3}),dep('ceo',{action:'reject',slug:depSlug,id,version:3,note:'ret'})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
});

await test('tanım değişikliği: açık süreçlerin bulunduğu aşama silinemez; pasif süreç türüyle yeni kayıt açılmaz; sürüm kontrolü',async()=>{
  const list=(await (await owGet('admin')).json()).departments.find(d=>d.slug===depSlug).templates.find(t=>t.key===key);
  const shrunk={...list,stages:list.stages.filter(s=>s.key!=='yonetim-onay'&&s.key!=='kontrol').map(s=>({...s,rejectTo:undefined}))};
  assert.equal((await ow('admin',{action:'template.save',slug:depSlug,key,version:list.version,template:shrunk})).status,409,'açık süreç kontrol/yönetim aşamasında');
  const renamed={...list,label:'Sevkiyat onayı (güncel)'};
  assert.equal((await ow('admin',{action:'template.save',slug:depSlug,key,version:list.version,template:renamed})).status,200);
  assert.equal((await ow('admin',{action:'template.save',slug:depSlug,key,version:list.version,template:renamed})).status,409,'eski sürümle ikinci kayıt reddedilir');
  assert.equal((await ow('admin',{action:'template.toggle',slug:depSlug,key,version:list.version+1,active:false})).status,200);
  assert.equal((await dep('emp',{action:'create',slug:depSlug,template:key,title:'Yeni',data:{musteri:'X'}})).status,404,'pasif süreç türü yeni kayıt açmaz');
  assert.ok((await (await depGet('boss','?slug='+depSlug+'&process='+pid)).json()).process,'eski kayıt okunmaya devam eder');
});

await test('birim silme: süreç kaydı varsa silinmez; boş birim silinir; başka firma silemez',async()=>{
  assert.equal((await ow('boss',{action:'department.delete',slug:depSlug})).status,409);
  const r=await ow('boss',{action:'department.save',department:{name:'Geçici birim'}});const s=(await r.json()).slug;
  assert.equal((await ow('rival',{action:'department.delete',slug:s},'b')).status,404);
  assert.equal((await ow('boss',{action:'department.delete',slug:s})).status,200);
});

await test('kötü niyetli girdi: HTML etiketi temizlenir, başka kökenden istek reddedilir',async()=>{
  const r=await ow('boss',{action:'department.save',department:{name:'<script>Bakım</script> ekibi'}});
  assert.equal(r.status,201);const slug=(await r.json()).slug;
  assert.doesNotMatch(sql.prepare('SELECT name FROM organization_departments WHERE slug=?').get(slug).name,/[<>]/);
  const x=await api.ow.POST(new Request('https://test.local/api/organization-workflows',{method:'POST',headers:{Cookie:'teksanor_session='+h.tokens.boss,'X-Organization-Id':'a','Content-Type':'application/json',Origin:'https://kotu.example'},body:JSON.stringify({action:'department.save',department:{name:'X birimi'}})}));
  assert.equal(x.status,403);
});
