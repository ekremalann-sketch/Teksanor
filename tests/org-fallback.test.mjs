import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
// Eski/başkasına ait localStorage firma kimliği kalıcı kilitlenmeye yol açmamalı; üye olunmayan firmaya ise asla erişim verilmemeli.
const h=await createHarness('org-fallback',{dashboard:'./app/api/dashboard/route.ts',projects:'./app/api/projects/route.ts',tenancy:'./lib/tenancy.ts'});
await h.user('ali','orgA','owner','owner');
await h.user('veli','orgB','owner','owner');

await test('Üye olunmayan firma istenirse okuma isteği kullanıcının kendi ilk firmasına düşer',async()=>{
 const r=await h.api.dashboard.GET(h.req('ali','/api/dashboard','GET',undefined,'orgB'));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.organization.id,'orgA');
 assert.ok(!body.organizations.some(o=>o.id==='orgB'));
});
await test('Silinmiş/bilinmeyen firma kimliği de ilk üyeliğe düşer',async()=>{
 const r=await h.api.dashboard.GET(h.req('ali','/api/dashboard','GET',undefined,'org_yok'));
 assert.equal(r.status,200);assert.equal((await r.json()).organization.id,'orgA');
});
await test('Yazma isteği başka firmaya düşmez: 403 döner, veri yazılmaz',async()=>{
 const r=await h.api.projects.POST(h.req('ali','/api/projects','POST',{name:'Deneme projesi'},'orgB'));
 assert.equal(r.status,403);
 assert.equal(h.sql.prepare("SELECT COUNT(*) c FROM projects").get().c,0);
});
await test('Hiç üyeliği olmayan kullanıcı hâlâ reddedilir',async()=>{
 h.sql.prepare("UPDATE organization_members SET active=0 WHERE user_id='veli'").run();
 const r=await h.api.dashboard.GET(h.req('veli','/api/dashboard','GET',undefined,'orgB'));
 assert.equal(r.status,403);
});
