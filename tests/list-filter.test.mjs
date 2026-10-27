import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
const {api}=await createHarness('list-filter',{filter:'./lib/list-filter.ts'});
test('Excel ve tablo aynı arama ve durum filtresini uygular',()=>{
 const rows=[{id:'1',title:'İZMİR klima',department:'Servis',status:'open'},{id:'2',title:'İzmir bakım',department:'Servis',status:'done'},{id:'3',title:'Ankara',department:'Servis',status:'open'}];
 assert.deepEqual(api.filter.filterList(rows,'tasks','izmir','open').map(r=>r.id),['1']);
 assert.deepEqual(api.filter.filterList(rows,'tasks','','done').map(r=>r.id),['2']);
 assert.equal(api.filter.filterList(rows,'tasks','bulunamadı').length,0);
});
test('İK, müşteri ve varlık araması yalnız ekranda kullanılan alanları tarar',()=>{
 assert.equal(api.filter.filterList([{full_name:'Merve',department:'İK',private_note:'hidden'}],'hr','hidden').length,0);
 assert.equal(api.filter.filterList([{name:'Klinik',company_name:'İzmir'}],'crm','izmir').length,1);
 assert.equal(api.filter.filterList([{name:'Kompresör',asset_code:'A-1'}],'assets','A-1').length,1);
});

test("Excel kapsamı yalnız ekranın uyguladığı filtreleri belirtir", async () => {
  const { listScope } = await import("../lib/list-filter.ts");
  assert.equal(listScope("tasks", " klima ", "done", "all", { done: "Tamamlandı" }), 'Arama: "klima" · Durum: Tamamlandı');
  assert.equal(listScope("projects", "klima", "done", "all", {}), "");
  assert.equal(listScope("payments", "klima", "all", "2026-10", {}), "Dönem: 2026-10");
});
