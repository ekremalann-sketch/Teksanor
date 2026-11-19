// TG1: güvenlik açığı bildirme (security.txt), /guvenlik adresi, güncel kontrol tablosu; çevrimdışı kuyruk süresi ve çıkışta silinmesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';
const h=await createHarness('tg1',{queue:'./lib/offline-queue.ts'});

test('security.txt RFC 9116 alanları ve geçerlilik süresi',()=>{
  const t=readFileSync('public/.well-known/security.txt','utf8');
  assert.match(t,/^Contact: https:\/\//m);assert.match(t,/^Policy: https:\/\/teksanor\.pages\.dev\/guven#acik-bildirme$/m);
  const exp=new Date(t.match(/^Expires: (.+)$/m)[1]);assert.ok(exp>new Date(),'süresi dolmamış');assert.ok(exp-new Date()<400*864e5,'en çok ~1 yıl');
  assert.doesNotMatch(t,/@gmail|@hotmail/,'kişisel e-posta yok');
});

test('güven merkezi güncel: foto denetimi, haftalık izleme, bildirme bölümü; /guvenlik aynı sayfa',()=>{
  const s=readFileSync('components/EnterpriseContent.tsx','utf8');
  assert.match(s,/id="acik-bildirme"/);assert.match(s,/Bağımlılık ve sır izleme/);assert.doesNotMatch(s,/R2 bağlantısı kapalı; yükleme üretimde kullanılamaz/);
  assert.match(readFileSync('app/guvenlik/page.tsx','utf8'),/TrustPage/);
});

test('çevrimdışı kuyruk: 24 saatten eski kayıt okunmaz; çıkışta tüm kuyruklar silinir',()=>{
  const store=new Map();const ls={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i]??null,get length(){return store.size;}};
  globalThis.localStorage=ls;const q=h.api.queue;
  q.enqueue('u','o',{action:'update',id:'j',version:1},'a');
  assert.equal(q.readQueue('u','o').length,1);
  assert.equal(q.readQueue('u','o',Date.now()+25*3600e3).length,0,'süresi geçen kayıt yok sayılır');
  store.set('baska-anahtar','x');q.clearQueues(ls);
  assert.equal([...store.keys()].filter(k=>k.startsWith('teksanor-offline-queue:')).length,0);assert.ok(store.has('baska-anahtar'));
  assert.match(readFileSync('lib/org-client.ts','utf8'),/clearQueues\(localStorage\)/);
  delete globalThis.localStorage;
});
