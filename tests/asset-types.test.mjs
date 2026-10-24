import test from 'node:test';import assert from 'node:assert/strict';import {createHarness} from './helpers/harness.mjs';
// Firma tanımlı ekipman türleri: firma neyi takip ediyorsa kendisi ekler; türün bakım sıklığı yeni varlıkta plana dönüşür.
// Yetki: varlık modülünde düzenleme hakkı olmayan ekleyemez; başka firmanın türleri görünmez.
const h=await createHarness('asset-types',{types:'./app/api/asset-types/route.ts',assets:'./app/api/assets/route.ts',maint:'./app/api/maintenance/route.ts'});const {api,req,sql}=h;
await h.user('owner','a','owner','owner');await h.user('tech','a','member','employee');await h.user('fin','a','member','finance');await h.user('other','b','owner','owner');
let typeId;
await test('Tür ekleme: firma kendi türünü ekler, aynı ad tekrar eklenemez, düzenleme yetkisi olmayan ekleyemez',async()=>{
 const r=await api.types.POST(req('owner','/api/asset-types','POST',{name:'Jeneratör',frequencyType:'month',frequencyValue:3,checklistText:'Yağ seviyesi\nYük testi'},'a'));
 assert.equal(r.status,200,await r.clone().text());typeId=(await r.json()).id;
 assert.equal((await api.types.POST(req('owner','/api/asset-types','POST',{name:'jeneratör'},'a'))).status,409);
 assert.equal((await api.types.POST(req('owner','/api/asset-types','POST',{name:'J'},'a'))).status,400);
 assert.equal((await api.types.POST(req('tech','/api/asset-types','POST',{name:'Klima'},'a'))).status,403,'çalışan profili ekleyemez');
 assert.equal((await api.types.GET(req('fin','/api/asset-types','GET',undefined,'a'))).status,403,'varlık modülünü görmeyen listeleyemez');
 const list=await (await api.types.GET(req('owner','/api/asset-types','GET',undefined,'a'))).json();
 assert.deepEqual(list.assetTypes.map(t=>t.name),['Jeneratör']);
 const other=await (await api.types.GET(req('other','/api/asset-types','GET',undefined,'b'))).json();
 assert.equal(other.assetTypes.length,0,'başka firma görmez');
});
await test('Varlık: türü seçilince bakım planı türün sıklığı ve kontrol listesiyle açılır; istenmezse açılmaz',async()=>{
 const r=await api.assets.POST(req('owner','/api/assets','POST',{name:'Jeneratör 250 kVA',category:'Jeneratör',autoPlan:true,responsibleName:'Teknisyen A'},'a'));
 const b=await r.json();assert.equal(r.status,200);assert.ok(b.planId);
 const plan=sql.prepare('SELECT * FROM maintenance_plans WHERE id=?').get(b.planId);
 assert.equal(plan.frequency_type,'month');assert.equal(plan.frequency_value,3);assert.match(plan.checklist_text,/Yük testi/);assert.equal(plan.title,'Jeneratör periyodik bakımı');assert.ok(plan.next_due_date>new Date().toISOString().slice(0,10));
 const r2=await api.assets.POST(req('owner','/api/assets','POST',{name:'Jeneratör 2',category:'Jeneratör'},'a'));assert.equal((await r2.json()).planId,null);
 const list=await (await api.types.GET(req('owner','/api/asset-types','GET',undefined,'a'))).json();assert.equal(list.assetTypes[0].asset_count,2);
});
await test('Tür kaldırılınca varlıklar silinmez; başka firma türü silemez',async()=>{
 assert.equal((await api.types.DELETE(req('other',`/api/asset-types?id=${typeId}`,'DELETE',undefined,'b'))).status,404);
 assert.equal((await api.types.DELETE(req('owner',`/api/asset-types?id=${typeId}`,'DELETE',undefined,'a'))).status,200);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM assets WHERE category='Jeneratör'").get().n,2);
});
