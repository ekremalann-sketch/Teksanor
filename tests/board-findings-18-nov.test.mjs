// 18 Kasım pano bulguları (Tasarım + Çözüm Mimarı T1/T2/T3/T6/T7/T8). Gerçek rotalar, sentetik veri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('board-18',{jobs:'./app/api/service/jobs/route.ts',tracking:'./app/api/service/tracking/route.ts',queue:'./lib/offline-queue.ts'});
const {sql,api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');
const post=(u,body)=>api.jobs.POST(req(u,'/api/service/jobs','POST',body,'a'));
const ver=id=>sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id).version;
const view=code=>api.tracking.GET(new Request('https://test.local/api/service/tracking?code='+encodeURIComponent(code)));

await test('T6: saat aralığı, "Yola çıktım / Vardım", müşteri takip sayfasında görünür',async()=>{
 const id=(await (await post('boss',{action:'create',title:'Sentetik klima',customerName:'Örnek Müşteri',assignedUserId:'tech'})).json()).id;
 let r=await post('boss',{action:'schedule',id,version:ver(id),scheduledDate:'2026-12-01',assignedUserId:'tech',timeWindow:'12:00-09:00'});assert.equal(r.status,400);
 r=await post('boss',{action:'schedule',id,version:ver(id),scheduledDate:'2026-12-01',assignedUserId:'tech',timeWindow:'09:00-12:00'});assert.equal(r.status,200);
 const {code}=await (await api.tracking.POST(req('boss','/api/service/tracking','POST',{jobId:id},'a'))).json();
 assert.equal((await post('tech',{action:'travel',id,version:ver(id),step:'on_way'})).status,400,'onaysız işte yola çıkış yok');
 sql.prepare("UPDATE service_jobs SET stage='quote_approved' WHERE id=?").run(id);
 assert.equal((await post('other',{action:'travel',id,version:ver(id),step:'on_way'})).status,404,'sorumlu olmayan iş görünmez');
 const v=ver(id);
 assert.equal((await post('tech',{action:'travel',id,version:v,step:'on_way'})).status,200);
 assert.equal(ver(id),v,'sürüm değişmez (onaylar bozulmaz)');
 let d=await (await view(code)).json();assert.equal(d.status,'Teknisyen yolda');assert.equal(d.timeWindow,'09:00-12:00');
 assert.equal((await post('tech',{action:'travel',id,version:v,step:'on_way'})).status,409,'ikinci kez yok');
 assert.equal((await post('tech',{action:'travel',id,version:v,step:'arrived'})).status,200);
 d=await (await view(code)).json();assert.equal(d.status,'Teknisyen adreste');assert.ok(!JSON.stringify(d).includes('tech'),'personel adı yok');
 assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE entity_id=? AND action IN ('on_way','arrived')").get(id).n,2);
});

test('T1: çevrimdışı kuyruk — yalnız durum/not ve yola çıkış; sırayla gönderir, aynı işin sürümünü izler, ağ hatasında durur, reddi bildirir',async()=>{
 const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const q=api.queue;
 assert.equal(q.enqueue('u','o',{action:'share',id:'j'},'x'),false,'paylaşım sıraya girmez (çevrimiçi)');
 assert.ok(q.enqueue('u','o',{action:'update',id:'j1',version:3,stage:'in_progress'},'a'));
 assert.ok(q.enqueue('u','o',{action:'update',id:'j1',version:3,stage:'completed',outcome:'Bitti'},'b'));
 assert.ok(q.enqueue('u','o',{action:'travel',id:'j2',version:7,step:'arrived'},'c'));
 let calls=[];let res=await q.flushQueue('u','o',async b=>{calls.push(b);if(calls.length===2)throw new Error('ağ');return {ok:true};});
 assert.equal(res.sent.length,1);assert.equal(res.remaining,2,'ağ hatasında kalanlar sırada');
 calls=[];res=await q.flushQueue('u','o',async b=>{calls.push(b);return b.action==='travel'?{ok:false,error:'Kayıt değişti'}:{ok:true};});
 assert.equal(calls[0].version,4,'yarıda kalan gönderimden sonra da güncel sürüm (3 + 1)');
 assert.equal(res.rejected.length,1);assert.equal(res.remaining,0);
 q.enqueue('u','o',{action:'update',id:'j3',version:1,stage:'in_progress'},'a');q.enqueue('u','o',{action:'update',id:'j3',version:1,stage:'completed'},'b');
 calls=[];await q.flushQueue('u','o',async b=>{calls.push(b);return {ok:true};});
 assert.deepEqual(calls.map(c=>c.version),[1,2],'aynı iş: ikinci update bir üst sürümle');
 delete globalThis.localStorage;
});

test('ekran ve metin bulguları',()=>{
 const servis=readFileSync('app/servis/page.tsx','utf8'),css=readFileSync('app/servis/service.css','utf8');
 assert.match(servis,/accepted:"Müşteri onayladı"/);assert.match(servis,/Yola çıktım/);assert.match(servis,/İmza ve fotoğraf için bağlantı gerekir/);
 assert.match(css,/\.service-actions\.service-wide\{position:sticky;bottom:0/,'Kaydet telefonda altta sabit');
 assert.match(css,/min-height:48px/,'saha hedefi 48 px');
 assert.doesNotMatch(readFileSync('app/globals.css','utf8'),/font-size: *(8|9|10|11)px/,'12 px altı yazı yok');
 const asset=readFileSync('components/modules/AssetMaintenanceModules.tsx','utf8');
 assert.match(asset,/QR etiketi<\/a><details><summary>Diğer işlemler<\/summary>/);assert.match(asset,/aria-label=\{`\$\{a\.name\} ekipmanını sil`\}/);
 assert.ok(asset.indexOf('project-card-grid')<asset.indexOf('<AssetTypesPanel'),'tür yönetimi kartların altında');
 assert.match(readFileSync('components/home/FlowsCard.tsx','utf8'),/1 saatten kısa/);
 assert.match(readFileSync('app/servis/onay/page.tsx','utf8'),/href="\/gizlilik"/);
 assert.match(readFileSync('app/servis/onay/page.tsx','utf8'),/süresi dolmuş/);
 const priv=readFileSync('app/gizlilik/page.tsx','utf8');
 for(const t of ['Veriler nerede tutulur','Alt işleyenler','Cloudflare','Resend','Yapay zekâ ve verileriniz'])assert.match(priv,new RegExp(t));
 assert.match(readFileSync('app/servis/plan/page.tsx','utf8'),/Öneriyi seç/);
});
