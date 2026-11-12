// T9: teknisyen telefondan saha fotoğrafı ekleyebiliyor; tarama hizmeti olmadan yalnız yeniden kodlanmış WebP kabul edilir.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

// Gerçek bir 1x1 kayıpsız WebP (VP8L).
const WEBP=Uint8Array.from(Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==','base64'));
const objects=new Map();
const h=await createHarness('field-photo',{jobs:'./app/api/service/jobs/route.ts',uploads:'./app/api/uploads/route.ts',photo:'./lib/photo-policy.ts'});
globalThis.__teksanorTestEnv.UPLOADS={head:async()=>null,put:async(k,v)=>{objects.set(k,v);},delete:async(k)=>{objects.delete(k);},get:async()=>null};
const {api,sql,req,tokens}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');
const job=(await (await api.jobs.POST(req('boss','/api/service/jobs','POST',{action:'create',title:'Pompa',customerName:'Demo müşteri',assignedUserId:'tech'},'a'))).json()).id;
const upload=(u,bytes,{type='image/webp',name='saha.webp',kind='photo',recordId=job}={})=>{const fd=new FormData();fd.set('file',new File([bytes],name,{type}));fd.set('recordType','work_order');fd.set('recordId',recordId);fd.set('kind',kind);
  return api.uploads.POST(new Request('https://test.local/api/uploads',{method:'POST',headers:{Cookie:'teksanor_session='+tokens[u],'X-Organization-Id':'a',Origin:'https://test.local'},body:fd}));};

test('WebP doğrulama: başlık, boyut ve sondaki ek veri',()=>{
  assert.deepEqual(api.photo.webpSize(WEBP.buffer),{width:1,height:1});
  assert.equal(api.photo.acceptPhoto('image/webp',WEBP.length,WEBP.buffer).ok,true);
  const tail=new Uint8Array([...WEBP,0x3c,0x73,0x63]);assert.equal(api.photo.webpSize(tail.buffer),null,'sonda gizli veri reddedilir');
  assert.equal(api.photo.acceptPhoto('image/jpeg',10,WEBP.buffer).ok,false);
});

await test('işin teknisyeni fotoğraf ekler; tarama hizmeti olmadan da çalışır ve denetime yazılır',async()=>{
  const r=await upload('tech',WEBP);assert.equal(r.status,201);
  const row=sql.prepare("SELECT scan_status,record_type,record_id FROM attachments WHERE uploaded_by='tech'").get();
  assert.deepEqual({...row},{scan_status:'reencoded_image',record_type:'work_order',record_id:job});
  assert.equal(objects.size,1);
  assert.equal(sql.prepare("SELECT count(*) n FROM audit_logs WHERE action='photo_uploaded'").get().n,1);
});

await test('reddedilenler: işe atanmamış çalışan, WebP olmayan dosya, foto dışı yükleme taramasız geçemez',async()=>{
  assert.equal((await upload('other',WEBP)).status,403);
  assert.equal((await upload('tech',WEBP,{type:'image/png',name:'a.png'})).status,400);
  assert.equal((await upload('tech',new Uint8Array([...WEBP,1,2,3]))).status,400);
  assert.equal((await upload('tech',WEBP,{kind:'document'})).status,503,'tarama hizmeti yoksa normal belge yüklemesi kapalı kalır');
});

test('servis ekranında telefon kamerasıyla fotoğraf ekleme',()=>{
  const panel=readFileSync('app/servis/photo-panel.tsx','utf8');
  assert.match(panel,/capture="environment"/);
  assert.match(panel,/"image\/webp",0\.8/);
  assert.match(readFileSync('app/servis/page.tsx','utf8'),/<PhotoPanel /);
});
