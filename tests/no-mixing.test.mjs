import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
// Teksanor arayüzünde hastane ürünü (Klinorbis) terimleri ve gerçekçi kişisel veri bulunmamalı.
async function* walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())yield* walk(p);else if(/\.(tsx?|css|html|json|webmanifest)$/.test(e.name))yield p;}}
test('app, components, lib ve public içinde hastane/Klinorbis terimi yok',async()=>{
 for(const root of ['app','components','lib','public']){for await(const file of walk(root)){
  const text=await readFile(file,'utf8');
  assert.ok(!/klinorbis|\bhasta\b|hasta |hastane|hekim|patient/i.test(text),`${file} hastane terimi içeriyor`);
 }}
});
test('örnek işletme verisinde gerçek operatör önekli telefon ve gerçekçi ad-soyad yok',async()=>{
 const text=await readFile('lib/demo-company.ts','utf8');
 assert.ok(!/05\d\d \d{3} \d\d \d\d/.test(text),'gerçek GSM önekli telefon');
 for(const name of ['Murat Arslan','Elif Kaya','Mehmet Aydın','Selin Öztürk','Zeynep Demir','Arslan Klima','İzmir'])assert.ok(!text.includes(name),name);
 assert.match(text,/Teknisyen A \(örnek\)/);
});
test('varsayılan firma tohumunda kişisel ad yok; kimlik geriye uyumlu',async()=>{
 const text=await readFile('lib/db.ts','utf8');
 assert.ok(!text.includes("'Alan Group'"));assert.match(text,/'Teksanor Yönetim'/);assert.match(text,/DEFAULT_ORGANIZATION_ID = "org_alan_group"/);
});
