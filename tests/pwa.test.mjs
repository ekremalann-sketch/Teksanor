// Çevrimdışı kabuğu: service worker'ı sahte tarayıcı ortamında çalıştırıp davranışı doğrular.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function load({online=true}={}){
  const listeners={},stored=new Map(),puts=[];
  const cache={addAll:async(list)=>list.forEach(u=>stored.set(u,new Response('pre:'+u))),put:async(r,res)=>{puts.push(new URL(r.url).pathname);stored.set(new URL(r.url).pathname,res);}};
  const self={location:new URL('https://teksanor.test/'),addEventListener:(t,f)=>listeners[t]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const context={self,URL,Response,Promise,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true,match:async(r)=>stored.get(typeof r==='string'?r:new URL(r.url).pathname)},
    fetch:async(r)=>{if(!online)throw new TypeError('offline');return new Response('net:'+new URL(r.url).pathname);}};
  vm.runInNewContext(source,context);
  const dispatch=(request)=>{let responded=null;listeners.fetch({request,respondWith:(p)=>responded=p});return responded;};
  return {listeners,stored,puts,dispatch,install:()=>new Promise(r=>listeners.install({waitUntil:(p)=>p.then(r)}))};
}
const req=(path,{mode='cors',method='GET'}={})=>({url:'https://teksanor.test'+path,mode,method});

test('API ve POST istekleri service worker tarafından hiç ele alınmaz (önbelleğe girmez)',()=>{
  const sw=load();
  assert.equal(sw.dispatch(req('/api/service/jobs')),null);
  assert.equal(sw.dispatch(req('/api/auth/status',{mode:'navigate'})),null);
  assert.equal(sw.dispatch(req('/servis',{method:'POST'})),null);
  assert.equal(sw.dispatch({url:'https://baska.site/x.js',mode:'cors',method:'GET'}),null);
});
test('sayfa gezinmesi önce ağdan gelir ve HTML saklanmaz; bağlantı yoksa çevrimdışı sayfası',async()=>{
  const on=load();await on.install();
  assert.equal(await (await on.dispatch(req('/panel',{mode:'navigate'}))).text(),'net:/panel');
  assert.equal(on.puts.length,0,'oturumlu sayfa önbelleğe yazılmamalı');
  const off=load({online:false});await off.install();
  assert.equal(await (await off.dispatch(req('/servis',{mode:'navigate'}))).text(),'pre:/offline');
});
test('yalnız hash\'li derleme dosyaları önbelleğe alınır',async()=>{
  const sw=load();
  await sw.dispatch(req('/_next/static/chunks/page-abc.js'));await new Promise(r=>setTimeout(r,0));
  assert.deepEqual(sw.puts,['/_next/static/chunks/page-abc.js']);
  assert.equal(sw.dispatch(req('/assets/teksanor-logo.png')),null);
});
test('çevrimdışı sayfası betik içermez ve dizine eklenmez; kayıt yalnız güvenli bağlamda',async()=>{
  const html=await readFile(new URL('../public/offline.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<script/i);assert.match(html,/noindex/);
  const reg=await readFile(new URL('../components/ServiceWorkerRegister.tsx',import.meta.url),'utf8');
  assert.match(reg,/isSecureContext/);
  assert.match(await readFile(new URL('../app/layout.tsx',import.meta.url),'utf8'),/<ServiceWorkerRegister \/>/);
});
