// Birim çalışma alanları: gerçek rota, bellek içi veri tabanı, yalnız sentetik kişiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('departments',{dep:'./app/api/departments/route.ts',wf:'./lib/department-catalog.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');
await h.user('ceo','a','member','ceo');
await h.user('ik','a','member','hr');
await h.user('fin','a','member','finance');
await h.user('emp','a','member','employee');
await h.user('emp2','a','member','employee');
await h.user('mgrIk','a','member','manager');
await h.user('mgrOps','a','member','manager');
await h.user('rival','b','owner','owner');
sql.prepare("UPDATE organization_member_access SET department='İnsan ve organizasyon' WHERE user_id IN ('mgrIk','emp')").run();
sql.prepare("UPDATE organization_member_access SET department='Operasyon yönetimi' WHERE user_id='mgrOps'").run();

const post=(u,body,org='a')=>api.dep.POST(req(u,'/api/departments','POST',body,org));
const get=(u,q='',org='a')=>api.dep.GET(req(u,'/api/departments'+q,'GET',undefined,org));
const row=(id)=>sql.prepare('SELECT stage_key,status,version,outcome FROM department_processes WHERE id=?').get(id);

await test('katalog: 13 birim, her sürecin aşamaları benzersiz, zorunlu alanlar tanımlı alanlardan',()=>{
  const {DEPARTMENTS}=api.wf;assert.equal(DEPARTMENTS.length,13);
  const slugs=new Set(DEPARTMENTS.map(d=>d.slug));assert.equal(slugs.size,13);
  for(const d of DEPARTMENTS)for(const t of d.templates){
    const keys=t.stages.map(s=>s.key);assert.equal(new Set(keys).size,keys.length,`${d.slug}/${t.key} aşama tekrarı`);
    for(const s of t.stages)for(const r of s.requires??[])assert.ok(t.fields.some(f=>f.key===r),`${d.slug}/${t.key}/${s.key} → ${r}`);
    assert.ok(t.outcomes.length>0);
  }
});

await test('görünürlük: yönetim tüm birimleri, İK yalnız kendi birimini yönetir, finans İK sürecini göremez',async()=>{
  const all=(await (await get('boss')).json()).departments;assert.equal(all.length,13);assert.ok(all.every(d=>d.role==='manage'));
  const ik=(await (await get('ik')).json()).departments;assert.equal(ik.find(d=>d.slug==='ik').role,'manage');assert.equal(ik.find(d=>d.slug==='finans').role,'member');
  const r=await get('fin','?slug=ik');assert.equal(r.status,200);const body=await r.json();assert.equal(body.role,'member');
  assert.ok(body.templates.every(t=>t.selfService),'üye yalnız çalışan taleplerini görür');
  // Başka firma kimliği: kendi firmasına düşer (ya da reddedilir); a firmasının süreçleri asla dönmez.
  const rival=await get('rival','?slug=ik','a');if(rival.status===200)assert.notEqual((await rival.json()).organization.id,'a','başka firma');else assert.equal(rival.status,403);
});

let hire;
await test('işe alım: kadro onayı yönetimde; İK atlayamaz; zorunlu alan olmadan teklif aşaması geçilmez',async()=>{
  assert.equal((await post('emp',{action:'create',slug:'ik',template:'ise-alim',title:'Yazılımcı',data:{pozisyon:'Yazılımcı',birim:'Ar-Ge'}})).status,403,'çalışan işe alım başlatamaz');
  assert.equal((await post('ik',{action:'create',slug:'ik',template:'ise-alim',title:'Yazılımcı',data:{pozisyon:'Yazılımcı'}})).status,400,'zorunlu birim eksik');
  assert.equal((await post('ik',{action:'create',slug:'ik',template:'ise-alim',title:'Yazılımcı',data:{pozisyon:'Yazılımcı',birim:'Ar-Ge',hack:'x'}})).status,400,'bilinmeyen alan');
  const c=await post('ik',{action:'create',slug:'ik',template:'ise-alim',title:'Yazılımcı alımı',data:{pozisyon:'Yazılımcı',birim:'Ar-Ge'}});
  assert.equal(c.status,201);hire=(await c.json()).id;
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:1})).status,200);
  assert.equal(row(hire).stage_key,'kadro-onay');
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:2})).status,403,'İK kadro onayı veremez');
  {const r=await post('ceo',{action:'advance',slug:'ik',id:hire,version:2});assert.equal(r.status,200,JSON.stringify(await r.json()));}
  for(const v of [3,4,5]){const r=await post('ik',{action:'advance',slug:'ik',id:hire,version:v});assert.equal(r.status,200,JSON.stringify(await r.clone().json())+row(hire).stage_key);}
  assert.equal(row(hire).stage_key,'teklif');
  const blocked=await post('ik',{action:'advance',slug:'ik',id:hire,version:6});assert.equal(blocked.status,400);assert.match((await blocked.json()).error,/Seçilen aday/);
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:6,data:{aday:'Sentetik Aday'}})).status,200);
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:7,outcome:'İşe alındı'})).status,400,'başlama tarihi zorunlu');
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:7,data:{baslama:'2026-11-02'},outcome:'Yanlış sonuç'})).status,400);
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:7,data:{baslama:'2026-11-02'},outcome:'İşe alındı'})).status,200);
  assert.deepEqual({...row(hire)},{stage_key:'giris',status:'done',version:8,outcome:'İşe alındı'});
  assert.equal((await post('ik',{action:'advance',slug:'ik',id:hire,version:8})).status,409,'kapanmış süreç');
  const ev=(await (await get('boss',`?slug=ik&process=${hire}`)).json()).events;
  assert.equal(ev[0].action,'create');assert.ok(ev.some(e=>e.action==='approve'&&e.actor_name==='ceo'));assert.equal(ev.at(-1).action,'done');
});

await test('izin talebi: çalışan kendi talebini açar ve yalnız kendininkini görür; kendi talebini onaylayamaz; birim yöneticisi onaylar',async()=>{
  const c=await post('emp',{action:'create',slug:'ik',template:'izin',title:'Yıllık izin',data:{tur:'Yıllık',baslangic:'2026-12-01',bitis:'2026-12-05'}});
  assert.equal(c.status,201);const id=(await c.json()).id;
  await post('emp2',{action:'create',slug:'ik',template:'izin',title:'Mazeret',data:{tur:'Mazeret',baslangic:'2026-12-10',bitis:'2026-12-10'}});
  const mine=(await (await get('emp','?slug=ik')).json()).processes;assert.equal(mine.length,1);assert.equal(mine[0].id,id);
  assert.equal((await get('emp2',`?slug=ik&process=${id}`)).status,404,'başkasının talebi görünmez');
  assert.equal((await post('emp',{action:'advance',slug:'ik',id,version:1})).status,403,'çalışan ilerletemez');
  assert.equal((await post('emp',{action:'update',slug:'ik',id,version:1,data:{vekil:'Sentetik Vekil'}})).status,200,'ilk aşamada düzeltebilir');
  assert.equal((await post('ik',{action:'advance',slug:'ik',id,version:2})).status,200);
  assert.equal((await post('emp',{action:'update',slug:'ik',id,version:3,data:{vekil:'X'}})).status,403,'işleme alınınca düzeltemez');
  assert.equal((await post('mgrOps',{action:'advance',slug:'ik',id,version:3})).status,404,'başka birimin yöneticisi süreci göremez');
  assert.equal((await post('mgrIk',{action:'advance',slug:'ik',id,version:3})).status,200,'kendi biriminin yöneticisi onaylar');
  const self=await post('ik',{action:'create',slug:'ik',template:'izin',title:'İK izni',data:{tur:'Yıllık',baslangic:'2026-12-20',bitis:'2026-12-21'}});const sid=(await self.json()).id;
  await post('ik',{action:'advance',slug:'ik',id:sid,version:1});
  const r=await post('ik',{action:'advance',slug:'ik',id:sid,version:2});assert.equal(r.status,403);assert.match((await r.json()).error,/Kendi talebinizi/);
});

await test('bekletme, geri gönderme, iptal ve eşzamanlı ilerletme',async()=>{
  const c=await post('boss',{action:'create',slug:'satin-alma',template:'talep',title:'Sentetik laptop',data:{urun:'Laptop',miktar:'2'}});const id=(await c.json()).id;
  assert.equal((await post('boss',{action:'block',slug:'satin-alma',id,version:1})).status,400,'neden zorunlu');
  assert.equal((await post('boss',{action:'block',slug:'satin-alma',id,version:1,note:'Teknik şart bekleniyor'})).status,200);
  assert.equal((await post('boss',{action:'advance',slug:'satin-alma',id,version:2})).status,409);
  assert.equal((await post('boss',{action:'unblock',slug:'satin-alma',id,version:2})).status,200);
  const [a,b]=await Promise.all([post('boss',{action:'advance',slug:'satin-alma',id,version:3}),post('ceo',{action:'advance',slug:'satin-alma',id,version:3})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  assert.equal((await post('boss',{action:'back',slug:'satin-alma',id,version:4})).status,400,'geri gönderme nedeni');
  assert.equal((await post('boss',{action:'back',slug:'satin-alma',id,version:4,note:'Teknik şart eksik'})).status,200);
  assert.equal(row(id).stage_key,'talep');
  assert.equal((await post('boss',{action:'cancel',slug:'satin-alma',id,version:5,note:'İhtiyaç kalmadı'})).status,200);
  assert.equal(row(id).status,'cancelled');
});

await test('özet: gecikme ve onay bekleyen sayıları; başka firma süreçleri karışmaz',async()=>{
  const c=await post('fin',{action:'create',slug:'finans',template:'odeme-talebi',title:'Sentetik kira',data:{alici:'Demo AŞ',tutar:'12.500,50',dayanak:'FTR-1'}});
  assert.equal(c.status,201);const id=(await c.json()).id;
  sql.prepare("UPDATE department_processes SET stage_entered_at=datetime('now','-5 days') WHERE id=?").run(id);
  await post('rival',{action:'create',slug:'finans',template:'odeme-talebi',title:'Rakip',data:{alici:'X',tutar:'1',dayanak:'Y'}},'b');
  const fin=(await (await get('boss')).json()).departments.find(d=>d.slug==='finans');
  assert.equal(fin.open,1);assert.equal(fin.overdue,1);assert.equal(fin.attention[0].title,'Sentetik kira');
  assert.equal((await post('fin',{action:'create',slug:'finans',template:'odeme-talebi',title:'Hatalı',data:{alici:'X',tutar:'abc',dayanak:'Y'}})).status,400);
  assert.equal((await post('boss',{action:'create',slug:'yok',template:'x',title:'x'})).status,404);
});

await test('örnek süreçler: yalnız firma yöneticisi, yalnız boş firmada',async()=>{
  await h.user('newowner','c','owner','owner');await h.user('cemp','c','member','employee');
  assert.equal((await post('cemp',{action:'demo.seed'},'c')).status,403);
  const r=await post('newowner',{action:'demo.seed'},'c');assert.equal(r.status,201);
  const n=sql.prepare("SELECT COUNT(*) AS n FROM department_processes WHERE organization_id='c'").get().n;assert.equal(n,8);
  assert.equal((await post('newowner',{action:'demo.seed'},'c')).status,409);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM department_processes WHERE organization_id='c' AND title NOT LIKE '[Örnek]%'").get().n,0);
});

await test('süreç ağı: en az 100 süreç türü, tüm bağlantılar var olan sürece ve sonuca işaret eder',async()=>{
  const {DEPARTMENTS}=api.wf;const all=DEPARTMENTS.flatMap(d=>d.templates.map(t=>({d,t})));
  assert.ok(all.length>=100,`süreç sayısı ${all.length}`);
  let links=0;
  for(const {d,t} of all)for(const n of t.next??[]){links++;
    const target=DEPARTMENTS.find(x=>x.slug===n.slug)?.templates.find(x=>x.key===n.template);assert.ok(target,`${d.slug}/${t.key} → ${n.slug}/${n.template}`);
    for(const w of n.when??[])assert.ok(t.outcomes.includes(w),`${d.slug}/${t.key} sonucu yok: ${w}`);}
  assert.ok(links>=50,`bağlantı ${links}`);
  const net=await (await get('boss','?view=network')).json();assert.equal(net.links.length,links);assert.equal(net.templateCount,all.length);
});

await test('süreç ağı: işe alım "İşe alındı" ile kapanınca İK işe giriş süreci kendiliğinden açılır; "Vazgeçildi" açmaz',async()=>{
  const before=sql.prepare("SELECT COUNT(*) n FROM department_processes WHERE template_key='ise-giris' AND organization_id='a'").get().n;
  assert.ok(before>=1,'önceki testte kapanan işe alım işe giriş açmış olmalı');
  const ev=sql.prepare("SELECT e.note FROM department_process_events e JOIN department_processes p ON p.id=e.process_id WHERE p.template_key='ise-giris' AND p.organization_id='a'").get();
  assert.match(ev.note,/Otomatik başlatıldı/);
  // Vazgeçildi ile kapanan alım yeni süreç açmaz.
  const c=await post('boss',{action:'create',slug:'ik',template:'ise-alim',title:'Vazgeçilen alım',data:{pozisyon:'Teknisyen',birim:'Operasyon'}});const id=(await c.json()).id;
  const tpl=api.wf.DEPARTMENTS.find(d=>d.slug==='ik').templates.find(t=>t.key==='ise-alim');
  for(let v=1;v<tpl.stages.length;v++){const r=await post('boss',{action:'advance',slug:'ik',id,version:v,data:{aday:'Sentetik',baslama:'2026-12-01'}});assert.equal(r.status,200);}
  const last=await post('boss',{action:'advance',slug:'ik',id,version:tpl.stages.length,outcome:tpl.outcomes.find(o=>o!=='İşe alındı')});
  const body=await last.json();assert.equal(last.status,200,JSON.stringify(body));assert.deepEqual(body.started,[]);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM department_processes WHERE template_key='ise-giris' AND organization_id='a'").get().n,before);
});

await test('süreç ağı: işe giriş kapanınca BT, zimmet ve eğitim süreçleri başka firmaya sızmadan açılır',async()=>{
  const bCount=()=>sql.prepare("SELECT COUNT(*) n FROM department_processes WHERE organization_id='b'").get().n;const b0=bCount();
  const p=sql.prepare("SELECT id,version FROM department_processes WHERE template_key='ise-giris' AND organization_id='a' AND status='active'").get();
  const tpl=api.wf.DEPARTMENTS.find(d=>d.slug==='ik').templates.find(t=>t.key==='ise-giris');
  const data=Object.fromEntries(tpl.fields.map(f=>[f.key,f.type==='date'?'2026-12-01':f.type==='number'?'1':f.options?f.options[0]:'Sentetik']));
  let v=p.version;for(let i=0;i<tpl.stages.length-1;i++){const r=await post('boss',{action:'advance',slug:'ik',id:p.id,version:v++,data});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));}
  const r=await post('boss',{action:'advance',slug:'ik',id:p.id,version:v,data,outcome:tpl.outcomes[0]});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));
  assert.deepEqual(body.started.map(s=>`${s.slug}/${s.template}`).sort(),['bt/yeni-calisan','ik/egitim','ik/zimmet']);
  assert.equal(bCount(),b0,'başka firmada süreç açılmaz');
});

await test('süreç ağı veri aktarımı: işe alımdaki aday ve başlama tarihi işe giriş sürecine taşınır', async () => {
  const c = await post('boss', { action: 'create', slug: 'ik', template: 'ise-alim', title: 'Aktarım testi', data: { pozisyon: 'Teknisyen', birim: 'Operasyon' } });
  const id = (await c.json()).id;
  const tpl = api.wf.DEPARTMENTS.find(d => d.slug === 'ik').templates.find(t => t.key === 'ise-alim');
  for (let v = 1; v < tpl.stages.length; v++) { const r = await post('boss', { action: 'advance', slug: 'ik', id, version: v, data: { aday: 'Sentetik Aday Bir', baslama: '2026-12-07' } }); assert.equal(r.status, 200); }
  const r = await post('boss', { action: 'advance', slug: 'ik', id, version: tpl.stages.length, outcome: 'İşe alındı' });
  const body = await r.json(); assert.equal(r.status, 200, JSON.stringify(body));
  const child = body.started.find(s => s.template === 'ise-giris');
  const data = JSON.parse(sql.prepare('SELECT data FROM department_processes WHERE id = ?').get(child.id).data);
  assert.equal(data.calisan, 'Sentetik Aday Bir'); assert.equal(data.baslama, '2026-12-07');
});

await test('tek işlem: aynı sürümle gelen iki ilerletme isteğinden biri 409 alır; olay ve takip süreçleri bir kez yazılır', async () => {
  const c = await post('boss', { action: 'create', slug: 'ik', template: 'ise-alim', title: 'Yarış testi', data: { pozisyon: 'Teknisyen', birim: 'Operasyon' } });
  const id = (await c.json()).id;
  const [a, b] = await Promise.all([post('boss', { action: 'advance', slug: 'ik', id, version: 1 }), post('ik', { action: 'advance', slug: 'ik', id, version: 1 })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM department_process_events WHERE process_id = ? AND action IN ('advance','approve')").get(id).n, 1);
  assert.equal(row(id).version, 2);
});

await test('kendi talebini onaylama: firma sahibi de başka onay yetkilisi varken kendi izin talebini onaylayamaz', async () => {
  const c = await post('boss', { action: 'create', slug: 'ik', template: 'izin', title: 'Sahibin izni', data: { tur: 'Yıllık', baslangic: '2026-12-01', bitis: '2026-12-03' } });
  const id = (await c.json()).id;
  assert.equal((await post('boss', { action: 'advance', slug: 'ik', id, version: 1 })).status, 200);
  const self = await post('boss', { action: 'advance', slug: 'ik', id, version: 2 });
  assert.equal(self.status, 403);
  assert.equal((await post('ceo', { action: 'advance', slug: 'ik', id, version: 2 })).status, 200, 'başka yönetici onaylar');
});

await test('performans raporu: aşama beklemeleri ve süreç süreleri; çalışan göremez', async () => {
  const r = await get('boss', '?view=report'); assert.equal(r.status, 200);
  const rep = await r.json();
  assert.ok(rep.totals.started >= 5 && rep.totals.done >= 2);
  const hire = rep.templates.find(t => t.key === 'ise-alim'); assert.ok(hire && hire.done >= 1 && hire.avgDays !== null);
  assert.ok(rep.bottlenecks.length > 0 && rep.bottlenecks.every(b => b.samples > 0));
  assert.equal((await get('emp', '?view=report')).status, 403);
  const ik = await (await get('ik', '?view=report')).json(); assert.ok(ik.departments.every(d => d.slug === 'ik'), 'İK yalnız yönettiği birimi görür');
});
