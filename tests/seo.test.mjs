import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PUBLIC_PAGES,pageMeta,structuredData} from '../lib/seo.ts';

test('herkese açık her sayfanın kendine özgü başlığı ve açıklaması var',()=>{
  const titles=new Set(PUBLIC_PAGES.map(p=>p.title));assert.equal(titles.size,PUBLIC_PAGES.length,'başlıklar tekrar etmemeli');
  for(const p of PUBLIC_PAGES){assert.ok(p.description.length>=60&&p.description.length<=200,`${p.path} açıklama uzunluğu`);
    const file=p.path==='/'?'app/layout.tsx':`app${p.path}/page.tsx`;
    assert.match(readFileSync(file,'utf8'),p.path==='/'?/PUBLIC_PAGES\[0\]/:new RegExp(`metaFor\\("${p.path}"\\)`),file);}
});
test('sitemap.xml herkese açık sayfaların tamamını içerir, özel sayfaları içermez',()=>{
  const xml=readFileSync('public/sitemap.xml','utf8');
  for(const p of PUBLIC_PAGES)assert.ok(xml.includes(`<loc>https://teksanor.pages.dev${p.path}</loc>`),p.path);
  for(const hidden of ['/panel','/servis','/giris','/hesap'])assert.ok(!xml.includes(`pages.dev${hidden}`),hidden);
});
test('özel sayfalar arama motoruna kapalı; müşteri onay bağlantısı önizleme kartı üretmez',()=>{
  assert.deepEqual(pageMeta('x','y','/p',{index:false}).robots,{index:false,follow:false});
  for(const f of ['app/servis/layout.tsx','app/hesap-guvenligi/layout.tsx','app/hesap-kurtarma/layout.tsx','app/servis/onay/layout.tsx'])assert.match(readFileSync(f,'utf8'),/index: false/,f);
  assert.match(readFileSync('app/servis/onay/layout.tsx','utf8'),/openGraph: undefined/);
  assert.match(readFileSync('public/robots.txt','utf8'),/Disallow: \/api\//);
});
test('paylaşım görseli, simgeler, manifest ve security.txt mevcut',()=>{
  for(const f of ['public/og/teksanor-og.png','public/icon-192.png','public/icon-512.png','public/manifest.webmanifest','public/.well-known/security.txt'])assert.ok(existsSync(f),f);
  const sec=readFileSync('public/.well-known/security.txt','utf8');assert.match(sec,/^Contact: https:/m);
  assert.ok(new Date(sec.match(/^Expires: (.+)$/m)[1])>new Date(),'security.txt süresi dolmamış olmalı');
  assert.equal(structuredData()['@graph'][0]['@type'],'Organization');
});
