// Stok ekranı: fiyatlar, kritik seviye, CSV (gerçek rotalar, sentetik veri).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('service-stock',{parts:'./app/api/service/parts/route.ts'});
const {api,req}=h;
await h.user('boss','a','owner','owner');await h.user('tech','a','member','employee');await h.user('outsider','b','owner','owner');
let n=0;const rid=()=>`stok-${Date.now()}-${++n}`;
const post=(body,user='boss',org='a')=>api.parts.POST(req(user,'/api/service/parts','POST',body,org));
const list=(user='boss',q='',org='a')=>api.parts.GET(req(user,'/api/service/parts'+q,'GET',undefined,org));

await test('fiyat, barkod ve kritik seviye kaydedilir; kritik parçalar üstte ve sayılır',async()=>{
 const a=(await (await post({action:'part-create',code:'FLT-1',name:'Sentetik filtre',unitCostCents:1000})).json()).id;
 const b=(await (await post({action:'part-create',code:'GAZ-1',name:'Sentetik gaz',unitCostCents:5000})).json()).id;
 assert.equal((await post({action:'part-receive',partId:a,quantity:10,requestId:rid()})).status,200);
 assert.equal((await post({action:'part-receive',partId:b,quantity:2,requestId:rid()})).status,200);
 assert.equal((await post({action:'part-update',partId:b,name:'Sentetik gaz R32',barcode:'8690000000001',unitCostCents:5000,salePriceCents:7500,criticalLevel:3})).status,200);
 const d=await (await list()).json();
 assert.equal(d.critical,1);assert.equal(d.parts[0].code,'GAZ-1');
 assert.equal(d.parts[0].sale_price_cents,7500);assert.equal(d.parts[0].barcode,'8690000000001');assert.equal(d.parts[0].name,'Sentetik gaz R32');
});

await test('CSV indirme ve formül enjeksiyonu koruması',async()=>{
 await post({action:'part-create',code:'=CMD',name:'Sentetik',unitCostCents:1});
 const r=await list('boss','?format=csv');assert.equal(r.status,200);const t=await r.text();
 assert.match(t,/Kod;Ad;Barkod;Depoda/);assert.match(t,/'=CMD/);
});

await test('yetki ve doğrulama',async()=>{
 const d=await (await list()).json();const id=d.parts[0].id;
 assert.equal((await list('tech')).status,403);
 assert.equal((await post({action:'part-update',partId:id,name:'x',unitCostCents:1,salePriceCents:1,criticalLevel:1},'tech')).status,403);
 assert.equal((await post({action:'part-update',partId:id,name:'x',unitCostCents:1,salePriceCents:1,criticalLevel:1},'outsider','b')).status,404);
 assert.equal((await post({action:'part-update',partId:id,name:'x',unitCostCents:-1,salePriceCents:1,criticalLevel:1})).status,400);
 assert.equal((await post({action:'part-update',partId:id,name:'',unitCostCents:1,salePriceCents:1,criticalLevel:1})).status,400);
 assert.equal((await (await list('outsider','',  'b')).json()).parts.length,0);
});
